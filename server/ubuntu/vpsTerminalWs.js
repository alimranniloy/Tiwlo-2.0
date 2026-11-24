import crypto from 'node:crypto';
import { acceptWebSocketUpgrade } from './host-daemon/rfc6455.mjs';
import { openHostDropletSshBridgeWs, openHostDropletTerminalWs } from './hostProvisionerClient.js';
import { CloudDB } from '../db/cloud.js';
import { MasterDB } from '../db/multiTenant.js';
import { getCandidateSessionTokens } from '../security/sessionMetadata.js';

const TERMINAL_TICKET_TTL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const SSH_BRIDGE_RATE_WINDOW_MS = 60_000;
const SSH_BRIDGE_MAX_PER_MIN = 30;
const SSH_BRIDGE_MAX_CONCURRENT_PER_IP = 16;
const pendingTickets = new Map();
const sshBridgeAttemptsByIp = new Map();
const sshBridgeConcurrentByIp = new Map();

function getClientIpFromReq(req) {
  const cfIp = req.headers?.['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return String(req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function checkAndTrackSshBridgeRate(ip) {
  const now = Date.now();
  const currentActive = sshBridgeConcurrentByIp.get(ip) || 0;
  if (currentActive >= SSH_BRIDGE_MAX_CONCURRENT_PER_IP) {
    return { allowed: false, statusCode: 429, reason: 'Too many active SSH bridge sessions from this IP.' };
  }
  let entry = sshBridgeAttemptsByIp.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + SSH_BRIDGE_RATE_WINDOW_MS };
    sshBridgeAttemptsByIp.set(ip, entry);
  } else {
    entry.count += 1;
    if (entry.count > SSH_BRIDGE_MAX_PER_MIN) {
      return { allowed: false, statusCode: 429, reason: 'Too many SSH bridge connection attempts. Wait 60 seconds.' };
    }
  }
  sshBridgeConcurrentByIp.set(ip, currentActive + 1);
  return {
    allowed: true,
    release: () => {
      const next = Math.max(0, (sshBridgeConcurrentByIp.get(ip) || 1) - 1);
      if (next === 0) sshBridgeConcurrentByIp.delete(ip);
      else sshBridgeConcurrentByIp.set(ip, next);
    }
  };
}

function attachBidirectionalWsRelay({ clientWs, upstreamWs, binary = false, onClose = null }) {
  const heartbeat = setInterval(() => {
    if (clientWs.isClosed || upstreamWs.isClosed) {
      clearInterval(heartbeat);
      return;
    }
    clientWs.ping();
    upstreamWs.ping();
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  let cleaned = false;
  const teardown = (code = 1000, reason = 'Closed') => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(heartbeat);
    try { if (!upstreamWs.isClosed) upstreamWs.close(code, reason); } catch {}
    try { if (!clientWs.isClosed) clientWs.close(code, reason); } catch {}
    try { if (typeof onClose === 'function') onClose(); } catch {}
  };

  upstreamWs.on('message', ({ data }) => {
    if (clientWs.isClosed) return;
    if (binary) {
      clientWs.sendBinary(Buffer.isBuffer(data) ? data : Buffer.from(data));
    } else {
      clientWs.sendText(typeof data === 'string' ? data : data.toString('utf8'));
    }
  });

  clientWs.on('message', ({ data }) => {
    if (upstreamWs.isClosed) return;
    if (binary) {
      upstreamWs.sendBinary(Buffer.isBuffer(data) ? data : Buffer.from(data));
    } else {
      upstreamWs.sendText(typeof data === 'string' ? data : data.toString('utf8'));
    }
  });

  upstreamWs.on('close', () => teardown(1000, 'Host session ended'));
  upstreamWs.on('error', () => teardown(1011, 'Upstream error'));
  clientWs.on('close', () => teardown(1000, 'Client closed'));
  clientWs.on('error', () => teardown(1011, 'Client socket error'));
}

function purgeExpiredTickets() {
  const now = Date.now();
  for (const [key, entry] of pendingTickets.entries()) {
    if (!entry || entry.expiresAt <= now) {
      pendingTickets.delete(key);
    }
  }
}

export function issueVpsTerminalTicket({ userId, dropletId }) {
  if (!userId || !dropletId) {
    throw new Error('userId and dropletId are required');
  }
  purgeExpiredTickets();
  const ticket = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + TERMINAL_TICKET_TTL_MS;
  pendingTickets.set(ticket, {
    userId: String(userId),
    dropletId: String(dropletId),
    expiresAt
  });
  return {
    ticket,
    expiresInSeconds: Math.floor(TERMINAL_TICKET_TTL_MS / 1000)
  };
}

export function consumeVpsTerminalTicket(ticket, expectedDropletId) {
  purgeExpiredTickets();
  if (typeof ticket !== 'string' || !ticket) return null;
  const entry = pendingTickets.get(ticket);
  if (!entry) return null;
  pendingTickets.delete(ticket);
  if (entry.expiresAt <= Date.now()) return null;
  if (String(entry.dropletId) !== String(expectedDropletId)) return null;
  return entry;
}

function parseCookiesFromHeader(rawCookie) {
  const out = {};
  if (typeof rawCookie !== 'string' || !rawCookie) return out;
  for (const part of rawCookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function writeHttpRejection(socket, statusCode, message) {
  try {
    if (!socket.destroyed) {
      const body = JSON.stringify({ error: message });
      socket.write(
        [
          `HTTP/1.1 ${statusCode} ${statusCode === 401 ? 'Unauthorized' : statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : 'Error'}`,
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(body)}`,
          'Connection: close',
          '\r\n'
        ].join('\r\n') + body
      );
      socket.destroy();
    }
  } catch {}
}

/**
 * Attaches owner-authenticated browser terminal WebSocket upgrades
 * (`/api/cloud/droplets/:id/terminal`), public Cloudflare Port-443 SSH bridge
 * upgrades (`/ssh/:dropletId` and `/api/cloud/ssh-bridge/:dropletId`), and
 * custom VPS domain WebSocket upgrades without exposing extra router ports.
 */
export function attachVpsTerminalWebSocket(httpOrHttpsServer, deps = {}) {
  if (!httpOrHttpsServer || typeof httpOrHttpsServer.on !== 'function') return;

  const getDropletById = typeof deps.getDropletById === 'function'
    ? deps.getDropletById
    : (id) => CloudDB.getDropletById(id);
  const openTerminalWs = typeof deps.openTerminalWs === 'function'
    ? deps.openTerminalWs
    : openHostDropletTerminalWs;
  const openSshBridgeWs = typeof deps.openSshBridgeWs === 'function'
    ? deps.openSshBridgeWs
    : openHostDropletSshBridgeWs;
  const handleCustomDomainUpgrade = typeof deps.onCustomDomainUpgrade === 'function'
    ? deps.onCustomDomainUpgrade
    : null;

  httpOrHttpsServer.on('upgrade', async (req, socket, head) => {
    let urlObj;
    try {
      urlObj = new URL(req.url || '/', 'http://localhost');
    } catch {
      return;
    }

    const termMatch = urlObj.pathname.match(/^\/api\/cloud\/droplets\/([a-zA-Z0-9_-]+)\/terminal$/);
    const sshMatch = urlObj.pathname.match(/^\/(?:api\/cloud\/ssh-bridge|ssh)\/([a-zA-Z0-9_-]+)\/?$/);

    if (sshMatch) {
      const dropletId = sshMatch[1];
      const clientIp = getClientIpFromReq(req);
      const rate = checkAndTrackSshBridgeRate(clientIp);
      if (!rate.allowed) {
        return writeHttpRejection(socket, rate.statusCode || 429, rate.reason);
      }

      let handedOff = false;
      try {
        const droplet = await getDropletById(dropletId);
        if (!droplet) {
          return writeHttpRejection(socket, 404, 'Droplet not found');
        }
        if (String(droplet.status || '').toLowerCase() !== 'active') {
          return writeHttpRejection(socket, 409, `Droplet is ${droplet.status}; power it on to connect.`);
        }
        const requestedUser = String(urlObj.searchParams.get('user') || '').trim();
        if (requestedUser && droplet.sshGatewayUser && requestedUser !== droplet.sshGatewayUser) {
          return writeHttpRejection(socket, 403, 'SSH gateway username does not match this VPS instance.');
        }

        const upstreamWs = await openSshBridgeWs(dropletId, {
          gatewayUser: droplet.sshGatewayUser || requestedUser || ''
        });
        const clientWs = acceptWebSocketUpgrade(req, socket, head);
        if (!clientWs) {
          upstreamWs.close(1011, 'Upgrade failed');
          return;
        }
        handedOff = true;
        attachBidirectionalWsRelay({
          clientWs,
          upstreamWs,
          binary: true,
          onClose: rate.release
        });
      } catch (err) {
        writeHttpRejection(socket, err?.statusCode || 503, err?.message || 'Unable to open SSH bridge');
      } finally {
        if (!handedOff) {
          rate.release();
        }
      }
      return;
    }

    if (!termMatch) {
      if (handleCustomDomainUpgrade) {
        await handleCustomDomainUpgrade(req, socket, head, urlObj);
      }
      return;
    }

    const dropletId = termMatch[1];
    try {
      let authedUserId = null;
      const ticketParam = urlObj.searchParams.get('ticket');
      if (ticketParam) {
        const consumed = consumeVpsTerminalTicket(ticketParam, dropletId);
        if (consumed) {
          const user = await MasterDB.getUserById?.(consumed.userId).catch(() => null);
          if (user?.isBanned) {
            return writeHttpRejection(socket, 403, 'Account suspended.');
          }
          authedUserId = consumed.userId;
        }
      }

      if (!authedUserId) {
        const fakeReq = {
          headers: req.headers || {},
          cookies: parseCookiesFromHeader(req.headers?.cookie || '')
        };
        const candidates = getCandidateSessionTokens(fakeReq);
        for (const token of candidates) {
          const resolved = await MasterDB.getSession(token, fakeReq).catch(() => null);
          if (resolved?.user) {
            if (resolved.user.isBanned) {
              return writeHttpRejection(socket, 403, 'Account suspended.');
            }
            authedUserId = resolved.user.id;
            break;
          }
        }
      }

      if (!authedUserId) {
        return writeHttpRejection(socket, 401, 'Unauthorized');
      }

      const droplet = await getDropletById(dropletId);
      if (!droplet || droplet.userId !== authedUserId) {
        return writeHttpRejection(socket, 404, 'Droplet not found');
      }
      if (String(droplet.status || '').toLowerCase() !== 'active') {
        return writeHttpRejection(socket, 409, `Droplet is ${droplet.status}; power it on to connect.`);
      }

      const cols = Math.min(500, Math.max(20, Number.parseInt(urlObj.searchParams.get('cols') || '120', 10) || 120));
      const rows = Math.min(200, Math.max(5, Number.parseInt(urlObj.searchParams.get('rows') || '32', 10) || 32));

      const upstreamWs = await openTerminalWs(dropletId, { cols, rows });
      const clientWs = acceptWebSocketUpgrade(req, socket, head);
      if (!clientWs) {
        upstreamWs.close(1011, 'Upgrade failed');
        return;
      }

      attachBidirectionalWsRelay({ clientWs, upstreamWs, binary: false });
    } catch (err) {
      writeHttpRejection(socket, err?.statusCode || 503, err?.message || 'Unable to connect to droplet terminal');
    }
  });
}

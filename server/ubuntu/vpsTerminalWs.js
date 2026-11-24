import crypto from 'node:crypto';
import { acceptWebSocketUpgrade } from './host-daemon/rfc6455.mjs';
import { openHostDropletTerminalWs } from './hostProvisionerClient.js';
import { CloudDB } from '../db/cloud.js';
import { MasterDB } from '../db/multiTenant.js';
import { getCandidateSessionTokens } from '../security/sessionMetadata.js';

const TERMINAL_TICKET_TTL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 25_000;
const pendingTickets = new Map();

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
 * Attaches owner-authenticated WebSocket SSH terminal upgrades (`/api/cloud/droplets/:id/terminal`)
 * cleanly over HTTPS/Caddy Port 443 without exposing additional router ports.
 */
export function attachVpsTerminalWebSocket(httpOrHttpsServer) {
  if (!httpOrHttpsServer || typeof httpOrHttpsServer.on !== 'function') return;

  httpOrHttpsServer.on('upgrade', async (req, socket, head) => {
    let urlObj;
    try {
      urlObj = new URL(req.url || '/', 'http://localhost');
    } catch {
      return;
    }

    const match = urlObj.pathname.match(/^\/api\/cloud\/droplets\/([a-zA-Z0-9_-]+)\/terminal$/);
    if (!match) return;

    const dropletId = match[1];
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

      const droplet = await CloudDB.getDropletById(dropletId);
      if (!droplet || droplet.userId !== authedUserId) {
        return writeHttpRejection(socket, 404, 'Droplet not found');
      }
      if (String(droplet.status || '').toLowerCase() !== 'active') {
        return writeHttpRejection(socket, 409, `Droplet is ${droplet.status}; power it on to connect.`);
      }

      const cols = Math.min(500, Math.max(20, Number.parseInt(urlObj.searchParams.get('cols') || '120', 10) || 120));
      const rows = Math.min(200, Math.max(5, Number.parseInt(urlObj.searchParams.get('rows') || '32', 10) || 32));

      const upstreamWs = await openHostDropletTerminalWs(dropletId, { cols, rows });
      const clientWs = acceptWebSocketUpgrade(req, socket, head);
      if (!clientWs) {
        upstreamWs.close(1011, 'Upgrade failed');
        return;
      }

      const heartbeat = setInterval(() => {
        if (clientWs.isClosed || upstreamWs.isClosed) {
          clearInterval(heartbeat);
          return;
        }
        clientWs.ping();
        upstreamWs.ping();
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref?.();

      upstreamWs.on('message', ({ data }) => {
        if (!clientWs.isClosed) {
          clientWs.sendText(typeof data === 'string' ? data : data.toString('utf8'));
        }
      });

      clientWs.on('message', ({ data }) => {
        if (!upstreamWs.isClosed) {
          upstreamWs.sendText(typeof data === 'string' ? data : data.toString('utf8'));
        }
      });

      const teardown = (code = 1000, reason = 'Closed') => {
        clearInterval(heartbeat);
        if (!upstreamWs.isClosed) upstreamWs.close(code, reason);
        if (!clientWs.isClosed) clientWs.close(code, reason);
      };

      upstreamWs.on('close', () => teardown(1000, 'Host session ended'));
      upstreamWs.on('error', () => teardown(1011, 'Upstream terminal error'));
      clientWs.on('close', () => teardown(1000, 'Browser closed'));
    } catch (err) {
      writeHttpRejection(socket, err?.statusCode || 503, err?.message || 'Unable to connect to droplet terminal');
    }
  });
}

import http from 'node:http';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import { openHostDropletTcpTunnelWs, resolveHostAgentHttpConfig } from './hostProvisionerClient.js';

const HOST_CACHE_TTL_MS = 4000;
const MAX_HOST_CACHE_ENTRIES = 500;
const hostBindingCache = new Map();

function normalizeRequestHostname(rawHost) {
  return String(rawHost || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

function isPlatformControlHost(hostname) {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === 'app') {
    return true;
  }
  const exactReserved = new Set(
    [
      ...PLATFORM_CONFIG.managedDomains,
      PLATFORM_CONFIG.primaryDomain,
      PLATFORM_CONFIG.storeDomain,
      PLATFORM_CONFIG.freeSubdomainDomain,
      PLATFORM_CONFIG.dashboardHost,
      PLATFORM_CONFIG.authDomain,
      PLATFORM_CONFIG.pickDashboardHost,
      getSubdomain(PLATFORM_CONFIG.wwwSubdomain),
      getSubdomain(PLATFORM_CONFIG.authSubdomain),
      getSubdomain(PLATFORM_CONFIG.tpanelSubdomain),
      getSubdomain(PLATFORM_CONFIG.dns1Subdomain),
      getSubdomain(PLATFORM_CONFIG.dns2Subdomain),
      getSubdomain(PLATFORM_CONFIG.mailSubdomain),
      getSubdomain(PLATFORM_CONFIG.mtaSubdomain),
      getSubdomain(PLATFORM_CONFIG.driveSubdomain),
      `api.${PLATFORM_CONFIG.primaryDomain}`,
      `pick.${PLATFORM_CONFIG.primaryDomain}`,
      `www.${PLATFORM_CONFIG.freeSubdomainDomain}`
    ]
      .filter(Boolean)
      .map((h) => String(h).trim().toLowerCase())
  );
  return exactReserved.has(hostname);
}

export function invalidateVpsWebProxyCache(hostname = null) {
  if (!hostname) {
    hostBindingCache.clear();
    return;
  }
  const clean = normalizeRequestHostname(hostname);
  hostBindingCache.delete(clean);
  if (clean.startsWith('www.')) {
    hostBindingCache.delete(clean.slice(4));
  } else {
    hostBindingCache.delete(`www.${clean}`);
  }
}

export async function resolveDropletWebProxyBinding(rawHost) {
  const host = normalizeRequestHostname(rawHost);
  if (!host || isPlatformControlHost(host) || !isPgActive()) {
    return null;
  }

  const cached = hostBindingCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.binding;
  }

  const hostCandidates = host.startsWith('www.') ? [host, host.slice(4)] : [host];
  let binding = null;

  try {
    // 1. Direct per-droplet domain binding
    const { rows: dropletDomainRows } = await queryPg(
      `SELECT dd.id, dd.droplet_id, dd.hostname, dd.target_port, dd.proxy_enabled, dd.status,
              d.name AS droplet_name, d.status AS droplet_status
       FROM cloud_droplet_domains dd
       JOIN cloud_droplets d ON d.id = dd.droplet_id
       WHERE dd.hostname = ANY($1::text[])
         AND dd.proxy_enabled = TRUE
         AND dd.status IN ('active', 'verified')
       ORDER BY CASE WHEN dd.hostname = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [hostCandidates, host]
    );
    if (dropletDomainRows[0]) {
      const r = dropletDomainRows[0];
      binding = {
        source: 'cloud_droplet_domains',
        hostname: r.hostname,
        dropletId: r.droplet_id,
        dropletName: r.droplet_name,
        dropletStatus: String(r.droplet_status || '').toLowerCase(),
        targetPort: Number(r.target_port) || 80
      };
    }

    // 2. Fallback to system_custom_domains directly linked to a droplet
    if (!binding) {
      const { rows: customRows } = await queryPg(
        `SELECT scd.id, scd.droplet_id, scd.domain, scd.target_port, scd.proxy_enabled, scd.status,
                d.name AS droplet_name, d.status AS droplet_status
         FROM system_custom_domains scd
         JOIN cloud_droplets d ON d.id = scd.droplet_id
         WHERE scd.domain = ANY($1::text[])
           AND scd.droplet_id IS NOT NULL
           AND scd.proxy_enabled = TRUE
           AND scd.status IN ('verified', 'active')
         ORDER BY CASE WHEN scd.domain = $2 THEN 0 ELSE 1 END
         LIMIT 1`,
        [hostCandidates, host]
      );
      if (customRows[0]) {
        const r = customRows[0];
        binding = {
          source: 'system_custom_domains',
          hostname: r.domain,
          dropletId: r.droplet_id,
          dropletName: r.droplet_name,
          dropletStatus: String(r.droplet_status || '').toLowerCase(),
          targetPort: Number(r.target_port) || 80
        };
      }
    }
  } catch (err) {
    console.warn('[VpsWebProxy] Lookup error:', err?.message || err);
    return null;
  }

  if (hostBindingCache.size >= MAX_HOST_CACHE_ENTRIES) {
    hostBindingCache.clear();
  }
  hostBindingCache.set(host, {
    binding,
    expiresAt: Date.now() + (binding ? HOST_CACHE_TTL_MS : 1500)
  });
  return binding;
}

async function handleWellKnownVerify(host, reqPath, res) {
  const prefix = '/.well-known/tiwlo-vps-verify/';
  if (!reqPath.startsWith(prefix)) return false;
  const token = decodeURIComponent(reqPath.slice(prefix.length).split('?')[0] || '').trim();
  if (!token || !isPgActive()) {
    res.status(404).type('text/plain').send('Not Found');
    return true;
  }
  const { rows } = await queryPg(
    `SELECT 1 FROM cloud_droplet_domains WHERE hostname = $1 AND verification_token = $2
     UNION ALL
     SELECT 1 FROM system_custom_domains WHERE domain = $1 AND verification_token = $2
     LIMIT 1`,
    [host, token]
  ).catch(() => ({ rows: [] }));
  if (rows.length > 0) {
    res.status(200).type('text/plain').send(token);
  } else {
    res.status(404).type('text/plain').send('Mismatch');
  }
  return true;
}

function escapeSimpleHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sendProxyStatusPage(res, statusCode, title, message) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeSimpleHtml(title)}</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;padding:24px}.box{max-width:460px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px}.code{font-size:12px;font-weight:700;letter-spacing:.06em;color:#64748b;text-transform:uppercase}h1{margin:8px 0 10px;font-size:20px}p{margin:0;color:#475569;font-size:14px;line-height:1.6}</style></head><body><div class="box"><div class="code">HTTP ${statusCode}</div><h1>${escapeSimpleHtml(title)}</h1><p>${escapeSimpleHtml(message)}</p></div></body></html>`;
  res.status(statusCode).type('html').send(html);
}

/**
 * Reverse-proxies inbound HTTP/HTTPS requests for custom domains and .uids.app subdomains
 * bound to a VPS droplet straight to the container port through host daemon isolation.
 */
export async function vpsWebProxyMiddleware(req, res, next) {
  const host = normalizeRequestHostname(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host || isPlatformControlHost(host)) {
    return next();
  }

  if (req.path?.startsWith('/.well-known/tiwlo-vps-verify/')) {
    try {
      const handled = await handleWellKnownVerify(host, req.originalUrl || req.path, res);
      if (handled) return;
    } catch {
      return res.status(500).end();
    }
  }

  const binding = await resolveDropletWebProxyBinding(host);
  if (!binding) {
    return next();
  }

  if (binding.dropletStatus !== 'active') {
    return sendProxyStatusPage(
      res,
      503,
      'VPS Instance Offline',
      `${host} is connected to VPS "${binding.dropletName || binding.dropletId}", which is currently ${binding.dropletStatus}. Power it on in your Tiwlo Cloud dashboard.`
    );
  }

  let daemonCfg;
  try {
    daemonCfg = resolveHostAgentHttpConfig();
  } catch {
    return sendProxyStatusPage(res, 503, 'Host Proxy Unavailable', 'The VPS host daemon bridge is not currently configured.');
  }

  const outgoingHeaders = { ...req.headers };
  delete outgoingHeaders.connection;
  delete outgoingHeaders['keep-alive'];
  delete outgoingHeaders['transfer-encoding'];
  outgoingHeaders['x-tiwlo-daemon-auth'] = `Bearer ${daemonCfg.secret}`;
  outgoingHeaders['x-tiwlo-proxy-port'] = String(binding.targetPort);
  outgoingHeaders['x-tiwlo-proxy-path'] = req.originalUrl || req.url || '/';
  outgoingHeaders['x-tiwlo-proxy-host'] = String(req.headers.host || host);
  outgoingHeaders['x-tiwlo-proxy-proto'] = req.protocol || (req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0].trim() : 'https');

  const clientIp = req.ip || String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  if (clientIp && !outgoingHeaders['x-real-ip']) {
    outgoingHeaders['x-real-ip'] = clientIp;
  }

  const proxyReq = http.request(
    {
      hostname: daemonCfg.hostname,
      port: daemonCfg.port,
      path: `/host/v1/droplets/${encodeURIComponent(binding.dropletId)}/http-proxy`,
      method: req.method || 'GET',
      headers: outgoingHeaders,
      timeout: 32000
    },
    (proxyRes) => {
      const upstreamErrCode = proxyRes.headers['x-tiwlo-upstream-error'];
      if (proxyRes.statusCode === 502 && upstreamErrCode) {
        proxyRes.resume();
        return sendProxyStatusPage(
          res,
          502,
          'No Web Server Listening in VPS',
          `${host} is connected to VPS "${binding.dropletName || binding.dropletId}" (port ${binding.targetPort}), but nothing inside the container answered on port ${binding.targetPort} (${upstreamErrCode}). Start Nginx, Caddy, Apache, or your web app on port ${binding.targetPort}.`
        );
      }
      const cleanHeaders = { ...proxyRes.headers };
      delete cleanHeaders['transfer-encoding'];
      res.writeHead(proxyRes.statusCode || 200, cleanHeaders);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy(Object.assign(new Error('VPS web gateway timeout'), { code: 'ETIMEDOUT' }));
  });

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      sendProxyStatusPage(
        res,
        502,
        'VPS Upstream Unreachable',
        `Unable to reach VPS "${binding.dropletName || binding.dropletId}" at port ${binding.targetPort}.`
      );
    } else {
      try { res.destroy(); } catch {}
    }
  });

  req.pipe(proxyReq);
}

/**
 * Handles WebSocket / HTTP-Upgrade requests on custom domains mapped to a VPS droplet.
 */
export async function handleVpsWebProxyUpgrade(req, socket, head) {
  const host = normalizeRequestHostname(req.headers['x-forwarded-host'] || req.headers.host);
  const binding = await resolveDropletWebProxyBinding(host);
  if (!binding || binding.dropletStatus !== 'active') {
    return false;
  }

  try {
    const upstreamWs = await openHostDropletTcpTunnelWs(binding.dropletId, { port: binding.targetPort });
    const headerLines = [`${req.method || 'GET'} ${req.url || '/'} HTTP/1.1`];
    for (let i = 0; i < (req.rawHeaders || []).length; i += 2) {
      const k = req.rawHeaders[i];
      const v = req.rawHeaders[i + 1];
      if (k !== undefined && v !== undefined) {
        headerLines.push(`${k}: ${v}`);
      }
    }
    const rawUpgradeBuf = Buffer.from(`${headerLines.join('\r\n')}\r\n\r\n`, 'latin1');
    upstreamWs.sendBinary(head && head.length ? Buffer.concat([rawUpgradeBuf, head]) : rawUpgradeBuf);

    upstreamWs.on('message', ({ data }) => {
      if (!socket.destroyed) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        socket.write(buf);
      }
    });
    socket.on('data', (chunk) => {
      if (!upstreamWs.isClosed) {
        upstreamWs.sendBinary(chunk);
      }
    });
    const cleanup = () => {
      try { if (!upstreamWs.isClosed) upstreamWs.close(1000, 'Closed'); } catch {}
      try { if (!socket.destroyed) socket.destroy(); } catch {}
    };
    upstreamWs.on('close', cleanup);
    upstreamWs.on('error', cleanup);
    socket.on('close', cleanup);
    socket.on('error', cleanup);
    return true;
  } catch {
    try {
      socket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      socket.destroy();
    } catch {}
    return true;
  }
}

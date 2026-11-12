import { readState } from '../db/stateDocuments.js';
/**
 * Tiwlo Enterprise Authoritative DNS Server
 * 
 * High-performance, anti-DDoS, authoritative nameserver for Tiwlo Platform.
 * Serves configured Tiwlo domains plus domains delegated to Tiwlo nameservers.
 *
 * Security Features:
 * - Authoritative Only (Recursion Available = false) -> Prevents Open Resolver abuse
 * - Anti-DNS Amplification / Flood Rate Limiting (RRL)
 * - Refuses unauthorized recursive queries (RCODE: REFUSED)
 * - Resilient error-handling for malformed packets
 */

import dns2 from 'dns2';
import fs from 'fs';
import path from 'path';
import { isIPv4, isIPv6 } from 'node:net';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';
import { isPgActive, queryPg, testPgConnection } from '../db/postgres.js';

const { Packet } = dns2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
export const DNS_CONFIG = {
  // Provider-independent public origin addresses. Optional legacy DNS_*
  // overrides are retained for installations with a separate edge or mail host.
  PUBLIC_EDGE_IP: process.env.DNS_PUBLIC_EDGE_IP || PLATFORM_CONFIG.serverIpv4,
  PUBLIC_EDGE_IPV6: process.env.DNS_PUBLIC_EDGE_IPV6 || PLATFORM_CONFIG.serverIpv6,
  PUBLIC_DNS_IP: process.env.DNS_PUBLIC_IP || PLATFORM_CONFIG.serverIpv4,
  PUBLIC_DNS_IPV6: process.env.DNS_PUBLIC_IPV6 || PLATFORM_CONFIG.serverIpv6,
  PUBLIC_MAIL_IP: process.env.DNS_PUBLIC_MAIL_IP || PLATFORM_CONFIG.serverIpv4,
  PUBLIC_MAIL_IPV6: process.env.DNS_PUBLIC_MAIL_IPV6 || PLATFORM_CONFIG.serverIpv6,
  PRIMARY_DOMAIN: PLATFORM_CONFIG.primaryDomain,
  STORE_DOMAIN: PLATFORM_CONFIG.storeDomain,
  MANAGED_DOMAINS: PLATFORM_CONFIG.managedDomains,
  DASHBOARD_HOST: (() => {
    try {
      return new URL(process.env.VITE_DASHBOARD_URL || 'https://uids.tiwlo.com').hostname.toLowerCase();
    } catch {
      return 'uids.tiwlo.com';
    }
  })(),
  AUTH_HOST: PLATFORM_CONFIG.authDomain,
  NS1: getSubdomain(PLATFORM_CONFIG.dns1Subdomain),
  NS2: getSubdomain(PLATFORM_CONFIG.dns2Subdomain),
  ADMIN_EMAIL: PLATFORM_CONFIG.adminEmail,
  MAIL_HOST: getSubdomain(PLATFORM_CONFIG.mtaSubdomain),
  SECURITY_EMAIL: PLATFORM_CONFIG.securityEmail,
  PORT: parseInt(process.env.DNS_PORT || '53', 10),
  HOST: process.env.DNS_HOST || '0.0.0.0',
  DEFAULT_TTL: PLATFORM_CONFIG.dnsTtl,
  NS_TTL: PLATFORM_CONFIG.dnsNsTtl,
  SOA_TTL: PLATFORM_CONFIG.dnsSoaTtl,
  SERIAL: 2026092801,
  // Rate limiting (RRL)
  MAX_QUERIES_PER_SEC: 60,
  BAN_DURATION_MS: 30000
};

function isPlatformHost(queryDomain) {
  return [DNS_CONFIG.DASHBOARD_HOST, DNS_CONFIG.AUTH_HOST].some(host =>
    queryDomain === host || queryDomain.endsWith(`.${host}`)
  );
}

function addARecord(response, name, address, ttl = DNS_CONFIG.DEFAULT_TTL) {
  if (!isIPv4(address)) return;
  response.answers.push({
    name,
    type: Packet.TYPE.A,
    class: Packet.CLASS.IN,
    ttl,
    address
  });
}

function addAaaaRecord(response, name, address, ttl = DNS_CONFIG.DEFAULT_TTL) {
  if (!isIPv6(address)) return;
  response.answers.push({
    name,
    type: Packet.TYPE.AAAA,
    class: Packet.CLASS.IN,
    ttl,
    address
  });
}

// ==========================================
// IN-MEMORY RATE LIMITING (RRL Protection)
// ==========================================
const rateLimitMap = new Map();

function isRateLimited(clientIp) {
  if (!clientIp) return false;
  const now = Date.now();
  let entry = rateLimitMap.get(clientIp);

  if (!entry) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + 1000, bannedUntil: 0 });
    return false;
  }

  if (entry.bannedUntil > now) {
    return true; // Still banned
  }

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + 1000;
    return false;
  }

  entry.count++;
  if (entry.count > DNS_CONFIG.MAX_QUERIES_PER_SEC) {
    entry.bannedUntil = now + DNS_CONFIG.BAN_DURATION_MS;
    console.warn(`⚠️ [DNS RRL] Rate limit triggered for IP: ${clientIp}. Banning for 30s.`);
    return true;
  }

  return false;
}

// Garbage collection for rate limiting map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (data.resetTime < now && data.bannedUntil < now) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// ==========================================
// DYNAMIC DOMAIN RESOLVER LOGIC
// ==========================================
const authorityCache = new Map();
async function findAuthoritativeZone(queryDomain) {
  const host = String(queryDomain || '').toLowerCase().replace(/\.$/, '');
  const platformDomain = DNS_CONFIG.MANAGED_DOMAINS
    .filter(domain => host === domain || host.endsWith(`.${domain}`))
    .sort((left, right) => right.length - left.length)[0];
  if (platformDomain) return { domain: platformDomain, platform: true };
  if (!isPgActive()) return null;

  const cached = authorityCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.zone;

  const labels = host.split('.');
  const candidates = labels.map((_label, index) => labels.slice(index).join('.'))
    .filter(domain => domain.includes('.'));
  const { rows } = await queryPg(
    `SELECT domain, verification_token, status
     FROM system_custom_domains
     WHERE domain = ANY($1::text[])
       AND status IN ('pending_verification', 'verified', 'active')
     ORDER BY LENGTH(domain) DESC
     LIMIT 1`,
    [candidates]
  );
  const zone = rows[0] ? {
    domain: rows[0].domain,
    platform: false,
    verified: ['verified', 'active'].includes(rows[0].status),
    active: rows[0].status === 'active',
    verificationToken: rows[0].verification_token
  } : null;
  authorityCache.set(host, { zone, expiresAt: Date.now() + (zone ? 10000 : 2000) });
  return zone;
}

// ==========================================
// CORE DNS PACKET HANDLER
// ==========================================
async function handleDnsRequest(request, send, rinfo) {
  const clientIp = rinfo?.address || 'unknown';

  // 1. Anti-DDoS / RRL Check
  if (isRateLimited(clientIp)) {
    return; // Silently drop to avoid amplification
  }

  try {
    const response = Packet.createResponseFromRequest(request);

    // Strict Authoritative Mode (Zero Recursive Abuse)
    response.header.aa = 1; // Authoritative Answer
    response.header.ra = 0; // Recursion Available: NO

    if (!request.questions || request.questions.length === 0) {
      response.header.rcode = Packet.RCODE.FORMERR;
      return send(response);
    }

    const [question] = request.questions;
    const rawName = question.name || '';
    const queryDomain = rawName.toLowerCase().replace(/\.$/, '');
    const queryType = question.type;

    // 2. Authoritative check
    const authorityZone = await findAuthoritativeZone(queryDomain);
    if (!authorityZone) {
      // Reject unauthorized recursive queries
      response.header.rcode = Packet.RCODE.REFUSED;
      return send(response);
    }

    response.header.rcode = Packet.RCODE.NOERROR;

    let claimedSubdomain = null;
    if (isPgActive() && queryDomain.endsWith(`.${PLATFORM_CONFIG.freeSubdomainDomain}`)) {
      const labels = queryDomain.split('.');
      const candidates = labels.map((_label, index) => labels.slice(index).join('.'));
      const { rows: domainRows } = await queryPg(
        `SELECT id, domain
         FROM system_free_subdomains
         WHERE domain = ANY($1::text[]) AND status = 'active'
         ORDER BY LENGTH(domain) DESC
         LIMIT 1`,
        [candidates]
      );
      claimedSubdomain = domainRows[0] || null;
      const rows = claimedSubdomain
        ? (await queryPg(
          `SELECT type, name, value, ttl
           FROM system_free_subdomain_records r
           WHERE r.subdomain_id = $1`,
          [claimedSubdomain.id]
        )).rows
        : [];
      for (const record of rows) {
        const recordHost = record.name === '@'
          ? claimedSubdomain.domain
          : record.name.endsWith(`.${claimedSubdomain.domain}`)
            ? record.name
            : `${record.name}.${claimedSubdomain.domain}`;
        if (recordHost !== queryDomain) continue;
        const name = question.name;
        if (record.type === 'A' && queryType === Packet.TYPE.A) {
          addARecord(response, name, record.value, record.ttl);
        } else if (record.type === 'AAAA' && queryType === Packet.TYPE.AAAA) {
          addAaaaRecord(response, name, record.value, record.ttl);
        } else if (record.type === 'CNAME' && queryType === Packet.TYPE.CNAME) {
          response.answers.push({ name, type: Packet.TYPE.CNAME, class: Packet.CLASS.IN, ttl: record.ttl, domain: record.value });
        } else if (record.type === 'TXT' && queryType === Packet.TYPE.TXT) {
          response.answers.push({ name, type: Packet.TYPE.TXT, class: Packet.CLASS.IN, ttl: record.ttl, data: record.value });
        } else if (record.type === 'NS' && queryType === Packet.TYPE.NS) {
          response.answers.push({ name, type: Packet.TYPE.NS, class: Packet.CLASS.IN, ttl: record.ttl, ns: record.value });
        }
      }
      if (response.answers.length > 0) return send(response);
    }

    // 3. Handle DNS Query Types
    switch (queryType) {
      // -------------------------------------------------------------
      // TYPE A (IPv4 Address)
      // -------------------------------------------------------------
      case Packet.TYPE.A: {
        if (queryDomain.endsWith(`.${PLATFORM_CONFIG.freeSubdomainDomain}`) &&
            !claimedSubdomain && !isPlatformHost(queryDomain)) {
          response.header.rcode = Packet.RCODE.NXDOMAIN;
          return send(response);
        }
        const address = queryDomain === DNS_CONFIG.NS1 || queryDomain === DNS_CONFIG.NS2
          ? DNS_CONFIG.PUBLIC_DNS_IP
          : queryDomain === DNS_CONFIG.MAIL_HOST
            ? DNS_CONFIG.PUBLIC_MAIL_IP
            : DNS_CONFIG.PUBLIC_EDGE_IP;
        addARecord(response, question.name, address);
        break;
      }

      case Packet.TYPE.AAAA: {
        if (queryDomain.endsWith(`.${PLATFORM_CONFIG.freeSubdomainDomain}`) &&
            !claimedSubdomain && !isPlatformHost(queryDomain)) {
          response.header.rcode = Packet.RCODE.NXDOMAIN;
          return send(response);
        }
        const address = queryDomain === DNS_CONFIG.NS1 || queryDomain === DNS_CONFIG.NS2
          ? DNS_CONFIG.PUBLIC_DNS_IPV6
          : queryDomain === DNS_CONFIG.MAIL_HOST
            ? DNS_CONFIG.PUBLIC_MAIL_IPV6
            : DNS_CONFIG.PUBLIC_EDGE_IPV6;
        addAaaaRecord(response, question.name, address);
        break;
      }

      // -------------------------------------------------------------
      // TYPE NS (Nameservers)
      // -------------------------------------------------------------
      case Packet.TYPE.NS: {
        if (queryDomain.endsWith(`.${PLATFORM_CONFIG.freeSubdomainDomain}`) &&
            !claimedSubdomain && !isPlatformHost(queryDomain)) {
          response.header.rcode = Packet.RCODE.NXDOMAIN;
          return send(response);
        }
        response.answers.push(
          {
            name: question.name,
            type: Packet.TYPE.NS,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.NS_TTL,
            ns: DNS_CONFIG.NS1
          },
          {
            name: question.name,
            type: Packet.TYPE.NS,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.NS_TTL,
            ns: DNS_CONFIG.NS2
          }
        );
        // Include glue records in additionals
        addARecord(response, DNS_CONFIG.NS1, DNS_CONFIG.PUBLIC_DNS_IP);
        addARecord(response, DNS_CONFIG.NS2, DNS_CONFIG.PUBLIC_DNS_IP);
        addAaaaRecord(response, DNS_CONFIG.NS1, DNS_CONFIG.PUBLIC_DNS_IPV6);
        addAaaaRecord(response, DNS_CONFIG.NS2, DNS_CONFIG.PUBLIC_DNS_IPV6);
        break;
      }

      // -------------------------------------------------------------
      // TYPE SOA (Start of Authority)
      // -------------------------------------------------------------
      case Packet.TYPE.SOA: {
        response.answers.push({
          name: authorityZone.domain,
          type: Packet.TYPE.SOA,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.SOA_TTL,
          primary: DNS_CONFIG.NS1,
          admin: DNS_CONFIG.ADMIN_EMAIL,
          serial: DNS_CONFIG.SERIAL,
          refresh: 7200,
          retry: 3600,
          expiration: 1209600,
          minimum: DNS_CONFIG.SOA_TTL
        });
        break;
      }

      // -------------------------------------------------------------
      // TYPE MX (Mail Exchange)
      // -------------------------------------------------------------
      case Packet.TYPE.MX: {
        if (!authorityZone.platform) break;
        response.answers.push({
          name: question.name,
          type: Packet.TYPE.MX,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          exchange: DNS_CONFIG.MAIL_HOST,
          priority: 10
        });
        addARecord(response, DNS_CONFIG.MAIL_HOST, DNS_CONFIG.PUBLIC_MAIL_IP);
        break;
      }

      // -------------------------------------------------------------
      // TYPE TXT (Text / SPF / DMARC / ACME Verification)
      // -------------------------------------------------------------
      case Packet.TYPE.TXT: {
        const dkimName = `${PLATFORM_CONFIG.dkimSelector}._domainkey.${DNS_CONFIG.PRIMARY_DOMAIN}`;
        if (queryDomain === dkimName) {
          const keyRecordPath = path.join(__dirname, '../data/email', `${PLATFORM_CONFIG.dkimSelector}.txt`);
          if (fs.existsSync(keyRecordPath)) {
            const text = fs.readFileSync(keyRecordPath, 'utf8');
            const value = [...text.matchAll(/"([^"]*)"/g)].map((match) => match[1]).join('');
            if (value) {
              const chunks = value.match(/.{1,240}/g) || [];
              response.answers.push({
                name: question.name,
                type: Packet.TYPE.TXT,
                class: Packet.CLASS.IN,
                ttl: DNS_CONFIG.DEFAULT_TTL,
                data: chunks
              });
            }
          }
          break;
        }

        if (!authorityZone.platform && queryDomain === `_tiwlo-verification.${authorityZone.domain}` && authorityZone.verificationToken) {
          response.answers.push({
            name: question.name,
            type: Packet.TYPE.TXT,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            data: `tiwlo-domain-verification=${authorityZone.verificationToken}`
          });
          break;
        }

        // 1. Dynamic ACME Challenge for Wildcard SSL
        if (queryDomain.startsWith('_acme-challenge') &&
            (authorityZone.platform || authorityZone.active) &&
            (authorityZone.platform || queryDomain.endsWith(`.${authorityZone.domain}`))) {
          try {
            const tokens = await readState('dns', 'acme', {});
            const list = tokens[queryDomain];
            if (list) {
              const tokenArray = Array.isArray(list) ? list : [list];
              tokenArray.forEach(val => {
                response.answers.push({
                  name: question.name,
                  type: Packet.TYPE.TXT,
                  class: Packet.CLASS.IN,
                  ttl: 10,
                  data: String(val)
                });
              });
              break;
            }
          } catch (acmeErr) {
            console.warn('⚠️ [DNS ACME] Error reading ACME tokens:', acmeErr.message);
          }
        }

        if (!authorityZone.platform) break;
        if (queryDomain.startsWith('_dmarc')) {
          response.answers.push({
            name: question.name,
            type: Packet.TYPE.TXT,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            data: `v=DMARC1; p=${PLATFORM_CONFIG.dnsDmarcPolicy}; rua=mailto:${DNS_CONFIG.SECURITY_EMAIL}; pct=100; sp=${PLATFORM_CONFIG.dnsDmarcPolicy}`
          });
        } else {
          response.answers.push({
            name: question.name,
            type: Packet.TYPE.TXT,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            data: `v=spf1 mx${DNS_CONFIG.PUBLIC_MAIL_IP ? ` ip4:${DNS_CONFIG.PUBLIC_MAIL_IP}` : ''} ${PLATFORM_CONFIG.dnsSpfPolicy}`
          });
        }
        break;
      }

      // -------------------------------------------------------------
      // TYPE CNAME
      // -------------------------------------------------------------
      case Packet.TYPE.CNAME: {
        if (!authorityZone.platform) {
          if (queryDomain === `www.${authorityZone.domain}`) {
            response.answers.push({
              name: question.name,
              type: Packet.TYPE.CNAME,
              class: Packet.CLASS.IN,
              ttl: DNS_CONFIG.DEFAULT_TTL,
              domain: authorityZone.domain
            });
          }
          break;
        }
        response.answers.push({
          name: question.name,
          type: Packet.TYPE.CNAME,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          domain: DNS_CONFIG.PRIMARY_DOMAIN
        });
        break;
      }

      // -------------------------------------------------------------
      // TYPE ANY (Amplification Mitigation -> minimal answer)
      // -------------------------------------------------------------
      case Packet.TYPE.ANY: {
        // Do not provide a useful ANY answer that can be amplified.
        break;
      }

      // -------------------------------------------------------------
      default: {
        // Return NOERROR with SOA in authorities
        response.authorities.push({
          name: authorityZone.domain,
          type: Packet.TYPE.SOA,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.SOA_TTL,
          primary: DNS_CONFIG.NS1,
          admin: DNS_CONFIG.ADMIN_EMAIL,
          serial: DNS_CONFIG.SERIAL,
          refresh: 7200,
          retry: 3600,
          expiration: 1209600,
          minimum: DNS_CONFIG.SOA_TTL
        });
        break;
      }
    }

    send(response);
  } catch (err) {
    console.error(`[DNS Error] Failed to handle query from ${clientIp}:`, err.message);
  }
}

// ==========================================
// START DNS SERVER
// ==========================================
export async function startDnsServer() {
  try {
    await testPgConnection();
  } catch (error) {
    console.warn('[DNS] PostgreSQL unavailable; user DNS records will be skipped:', error.message);
  }
  const server = dns2.createServer({
    udp: true,
    tcp: true,
    handle: handleDnsRequest
  });

  server.on('error', (err) => {
    console.error('❌ DNS Server Socket Error:', err);
  });

  try {
    await server.listen({
      udp: { port: DNS_CONFIG.PORT, address: DNS_CONFIG.HOST },
      tcp: { port: DNS_CONFIG.PORT, address: DNS_CONFIG.HOST }
    });

    console.log('====================================================');
    console.log('🚀 TIWLO AUTHORITATIVE DNS SERVER RUNNING');
    console.log(`📡 Interface: ${DNS_CONFIG.HOST}:${DNS_CONFIG.PORT} (UDP/TCP)`);
    console.log(`🌐 Public edge addresses configured: ${DNS_CONFIG.PUBLIC_EDGE_IP || '-'} / ${DNS_CONFIG.PUBLIC_EDGE_IPV6 || '-'}`);
    console.log(`🛡️ Nameserver glue: ${DNS_CONFIG.PUBLIC_DNS_IP || '-'} / ${DNS_CONFIG.PUBLIC_DNS_IPV6 || '-'}`);
    if (!DNS_CONFIG.PUBLIC_EDGE_IP && !DNS_CONFIG.PUBLIC_EDGE_IPV6) {
      console.warn('⚠️ Configure at least one server address (VITE_SERVER_IPV4 or VITE_SERVER_IPV6) before publishing DNS records.');
    }
    console.log(`🏷️  Nameservers: ${DNS_CONFIG.NS1}, ${DNS_CONFIG.NS2}`);
    console.log('🛡️  Security: Authoritative-Only (Anti-Amplification DDoS & RRL Active)');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Failed to start DNS Server on port ' + DNS_CONFIG.PORT + ':', err.message);
    if (err.code === 'EACCES') {
      console.error('👉 TIP: Port 53 requires root privileges or CAP_NET_BIND_SERVICE.');
    }
  }

  return server;
}

// Start DNS Server
startDnsServer();

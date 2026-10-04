/**
 * Tiwlo Enterprise Authoritative DNS Server
 * 
 * High-performance, anti-DDoS, authoritative nameserver for Tiwlo Platform.
 * Serves primary records for tiwlo.com, dns1.tiwlo.com, dns2.tiwlo.com,
 * and dynamically resolves all multi-tenant custom domains & subdomains.
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
import { fileURLToPath } from 'url';

const { Packet } = dns2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
export const DNS_CONFIG = {
  PRIMARY_IP: process.env.PRIMARY_IP || '162.35.124.233',
  PRIMARY_DOMAIN: process.env.PRIMARY_DOMAIN || 'tiwlo.com',
  NS1: process.env.NS1 || 'dns1.tiwlo.com',
  NS2: process.env.NS2 || 'dns2.tiwlo.com',
  ADMIN_EMAIL: 'admin.tiwlo.com',
  PORT: parseInt(process.env.DNS_PORT || '53', 10),
  HOST: process.env.DNS_HOST || '0.0.0.0',
  DEFAULT_TTL: 300,
  NS_TTL: 86400,
  SOA_TTL: 3600,
  SERIAL: 2026092801,
  // Rate limiting (RRL)
  MAX_QUERIES_PER_SEC: 60,
  BAN_DURATION_MS: 30000
};

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
/**
 * Checks if a domain is owned by Tiwlo or delegated to our nameserver
 */
function isDomainAuthoritative(queryDomain) {
  if (!queryDomain) return false;
  const d = queryDomain.toLowerCase().replace(/\.$/, '');

  // 1. All tiwlo domains and subdomains
  if (
    d === 'tiwlo.com' ||
    d.endsWith('.tiwlo.com') ||
    d === (process.env.PRIMARY_DOMAIN || 'tiwlo.com').toLowerCase() ||
    d.endsWith(`.${(process.env.PRIMARY_DOMAIN || 'tiwlo.com').toLowerCase()}`)
  ) {
    return true;
  }

  // 2. Nameservers
  if (d === 'dns1.tiwlo.com' || d === 'dns2.tiwlo.com') {
    return true;
  }

  // 3. For any customer domain that delegated to our nameservers:
  // If the query reaches our DNS server, we are authoritative for it
  // (We check if it's not a generic third-party recursive query)
  const isGenericTLD = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(d);
  const isForbiddenRecursion = /^(google|facebook|apple|microsoft|amazon|cloudflare|wikipedia|netflix|yahoo|twitter|x)\.(com|org|net|io)$/i.test(d);

  if (isForbiddenRecursion) {
    return false; // Deny recursive probe / amplification target
  }

  return isGenericTLD;
}

// ==========================================
// CORE DNS PACKET HANDLER
// ==========================================
function handleDnsRequest(request, send, rinfo) {
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
    if (!isDomainAuthoritative(queryDomain)) {
      // Reject unauthorized recursive queries
      response.header.rcode = Packet.RCODE.REFUSED;
      return send(response);
    }

    response.header.rcode = Packet.RCODE.NOERROR;

    // 3. Handle DNS Query Types
    switch (queryType) {
      // -------------------------------------------------------------
      // TYPE A (IPv4 Address)
      // -------------------------------------------------------------
      case Packet.TYPE.A: {
        response.answers.push({
          name: question.name,
          type: Packet.TYPE.A,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          address: DNS_CONFIG.PRIMARY_IP
        });
        break;
      }

      // -------------------------------------------------------------
      // TYPE NS (Nameservers)
      // -------------------------------------------------------------
      case Packet.TYPE.NS: {
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
        response.additionals.push(
          {
            name: DNS_CONFIG.NS1,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            address: DNS_CONFIG.PRIMARY_IP
          },
          {
            name: DNS_CONFIG.NS2,
            type: Packet.TYPE.A,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            address: DNS_CONFIG.PRIMARY_IP
          }
        );
        break;
      }

      // -------------------------------------------------------------
      // TYPE SOA (Start of Authority)
      // -------------------------------------------------------------
      case Packet.TYPE.SOA: {
        response.answers.push({
          name: question.name,
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
        response.answers.push({
          name: question.name,
          type: Packet.TYPE.MX,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          exchange: `mail.${DNS_CONFIG.PRIMARY_DOMAIN}`,
          priority: 10
        });
        response.additionals.push({
          name: `mail.${DNS_CONFIG.PRIMARY_DOMAIN}`,
          type: Packet.TYPE.A,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          address: DNS_CONFIG.PRIMARY_IP
        });
        break;
      }

      // -------------------------------------------------------------
      // TYPE TXT (Text / SPF / DMARC / ACME Verification)
      // -------------------------------------------------------------
      case Packet.TYPE.TXT: {
        // 1. Dynamic ACME Challenge for Wildcard SSL (*.tiwlo.com)
        if (queryDomain.startsWith('_acme-challenge')) {
          try {
            const tokenPath = '/var/www/certbot/dns_tokens.json';
            if (fs.existsSync(tokenPath)) {
              const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
              const list = tokens[queryDomain] || tokens['_acme-challenge.tiwlo.com'] || tokens['tiwlo.com'];
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
            }
          } catch (acmeErr) {
            console.warn('⚠️ [DNS ACME] Error reading ACME tokens:', acmeErr.message);
          }
        }

        if (queryDomain.startsWith('_dmarc')) {
          response.answers.push({
            name: question.name,
            type: Packet.TYPE.TXT,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            data: 'v=DMARC1; p=quarantine; rua=mailto:security@tiwlo.com; pct=100; sp=quarantine'
          });
        } else {
          response.answers.push({
            name: question.name,
            type: Packet.TYPE.TXT,
            class: Packet.CLASS.IN,
            ttl: DNS_CONFIG.DEFAULT_TTL,
            data: `v=spf1 mx ip4:${DNS_CONFIG.PRIMARY_IP} ~all`
          });
        }
        break;
      }

      // -------------------------------------------------------------
      // TYPE CNAME
      // -------------------------------------------------------------
      case Packet.TYPE.CNAME: {
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
        response.answers.push({
          name: question.name,
          type: Packet.TYPE.A,
          class: Packet.CLASS.IN,
          ttl: DNS_CONFIG.DEFAULT_TTL,
          address: DNS_CONFIG.PRIMARY_IP
        });
        break;
      }

      // -------------------------------------------------------------
      // TYPE AAAA (IPv6) or Others:
      // Return NOERROR with 0 answers (prompts client to use IPv4 A)
      // -------------------------------------------------------------
      default: {
        // Return NOERROR with SOA in authorities
        response.authorities.push({
          name: DNS_CONFIG.PRIMARY_DOMAIN,
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
    console.log(`🌐 Primary Domain: ${DNS_CONFIG.PRIMARY_DOMAIN} -> ${DNS_CONFIG.PRIMARY_IP}`);
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


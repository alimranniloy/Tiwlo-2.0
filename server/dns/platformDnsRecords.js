import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIPv4, isIPv6 } from 'node:net';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLATFORM_DNS_RECORD_TYPES = Object.freeze(['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT']);

const makeId = (value) => `dns_${createHash('sha256').update(String(value)).digest('hex').slice(0, 32)}`;

function addressConfig() {
  return {
    edge4: process.env.DNS_PUBLIC_EDGE_IP || PLATFORM_CONFIG.serverIpv4,
    edge6: process.env.DNS_PUBLIC_EDGE_IPV6 || PLATFORM_CONFIG.serverIpv6,
    dns4: process.env.DNS_PUBLIC_IP || PLATFORM_CONFIG.serverIpv4,
    dns6: process.env.DNS_PUBLIC_IPV6 || PLATFORM_CONFIG.serverIpv6,
    mail4: process.env.DNS_PUBLIC_MAIL_IP || PLATFORM_CONFIG.serverIpv4,
    mail6: process.env.DNS_PUBLIC_MAIL_IPV6 || PLATFORM_CONFIG.serverIpv6
  };
}

export function getDefaultPlatformDnsRecords() {
  const zone = PLATFORM_CONFIG.primaryDomain;
  const { edge4, edge6, dns4, dns6, mail4, mail6 } = addressConfig();
  const ns1 = getSubdomain(PLATFORM_CONFIG.dns1Subdomain, zone);
  const ns2 = getSubdomain(PLATFORM_CONFIG.dns2Subdomain, zone);
  const mailHost = getSubdomain(PLATFORM_CONFIG.mtaSubdomain, zone);
  const records = [];
  const add = (systemKey, name, type, content, ttl = PLATFORM_CONFIG.dnsTtl, priority = null) => {
    if (!content) return;
    records.push({
      id: makeId(`${zone}:${systemKey}`),
      zone,
      name,
      type,
      content: String(content),
      ttl: Number(ttl) || 300,
      priority,
      systemKey
    });
  };
  const addAddress = (prefix, name, ipv4, ipv6) => {
    if (isIPv4(ipv4 || '')) add(`${prefix}:a`, name, 'A', ipv4);
    if (isIPv6(ipv6 || '')) add(`${prefix}:aaaa`, name, 'AAAA', ipv6);
  };

  addAddress('apex', '@', edge4, edge6);
  addAddress('dns1', PLATFORM_CONFIG.dns1Subdomain, dns4, dns6);
  addAddress('dns2', PLATFORM_CONFIG.dns2Subdomain, dns4, dns6);
  addAddress('mail', PLATFORM_CONFIG.mtaSubdomain, mail4, mail6);
  addAddress('server', 'server', edge4, edge6);

  add('ns:primary', '@', 'NS', ns1, PLATFORM_CONFIG.dnsNsTtl);
  add('ns:secondary', '@', 'NS', ns2, PLATFORM_CONFIG.dnsNsTtl);
  add('mx:primary', '@', 'MX', mailHost, PLATFORM_CONFIG.dnsTtl, 10);

  const spfMechanisms = [
    'v=spf1',
    'mx',
    ...(isIPv4(mail4 || '') ? [`ip4:${mail4}`] : []),
    ...(isIPv6(mail6 || '') ? [`ip6:${mail6}`] : []),
    PLATFORM_CONFIG.dnsSpfPolicy
  ];
  add('txt:spf', '@', 'TXT', spfMechanisms.join(' '));
  add('txt:google-site-verification', '@', 'TXT', 'google-site-verification=gNviPOn475ByHIpDN8Ew3_Ln2071le7v3wML5As3ywk');
  add(
    'txt:dmarc',
    '_dmarc',
    'TXT',
    `v=DMARC1; p=${PLATFORM_CONFIG.dnsDmarcPolicy}; rua=mailto:${PLATFORM_CONFIG.securityEmail}; pct=100; sp=${PLATFORM_CONFIG.dnsDmarcPolicy}`
  );

  const dkimRecordPath = path.join(__dirname, '../data/email', `${PLATFORM_CONFIG.dkimSelector}.txt`);
  if (fs.existsSync(dkimRecordPath)) {
    const keyRecord = fs.readFileSync(dkimRecordPath, 'utf8');
    const content = [...keyRecord.matchAll(/"([^"]*)"/g)].map((match) => match[1]).join('');
    if (content) add('txt:dkim', `${PLATFORM_CONFIG.dkimSelector}._domainkey`, 'TXT', content);
  }

  const aliasLabels = new Set([
    PLATFORM_CONFIG.wwwSubdomain,
    'api',
    'pick',
    PLATFORM_CONFIG.authSubdomain,
    PLATFORM_CONFIG.tpanelSubdomain,
    PLATFORM_CONFIG.mailSubdomain,
    PLATFORM_CONFIG.driveSubdomain
  ]);
  for (const label of aliasLabels) {
    if ([PLATFORM_CONFIG.dns1Subdomain, PLATFORM_CONFIG.dns2Subdomain, PLATFORM_CONFIG.mtaSubdomain].includes(label)) continue;
    add(`cname:${label}`, label, 'CNAME', zone);
  }
  add('cname:wildcard', '*', 'CNAME', zone);

  return records;
}

export async function ensurePlatformDnsSchema(database) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS system_platform_dns_records (
      id VARCHAR(64) PRIMARY KEY,
      zone VARCHAR(253) NOT NULL,
      name VARCHAR(253) NOT NULL,
      type VARCHAR(8) NOT NULL CHECK (type IN ('A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT')),
      content TEXT NOT NULL,
      ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl BETWEEN 60 AND 86400),
      priority INTEGER,
      system_key VARCHAR(255),
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(64),
      updated_by VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((type = 'MX' AND priority BETWEEN 0 AND 65535) OR (type <> 'MX' AND priority IS NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_dns_system_key
      ON system_platform_dns_records(zone, system_key)
      WHERE system_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_platform_dns_zone_name
      ON system_platform_dns_records(zone, name, type, enabled);
  `);

  for (const record of getDefaultPlatformDnsRecords()) {
    await database.query(
      `INSERT INTO system_platform_dns_records
         (id, zone, name, type, content, ttl, priority, system_key, is_system, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE)
       ON CONFLICT (zone, system_key) WHERE system_key IS NOT NULL
       DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         content = EXCLUDED.content,
         ttl = EXCLUDED.ttl,
         priority = EXCLUDED.priority,
         updated_at = CURRENT_TIMESTAMP
       WHERE system_platform_dns_records.is_system = TRUE
         AND system_platform_dns_records.enabled = TRUE`,
      [record.id, record.zone, record.name, record.type, record.content, record.ttl, record.priority, record.systemKey]
    );
  }
}

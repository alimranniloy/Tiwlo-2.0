import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import pg from 'pg';
import '../config/loadRootEnv.js';
import { getPgConnectionString } from '../db/postgres.js';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const domain = PLATFORM_CONFIG.primaryDomain;
const mailHost = getSubdomain(PLATFORM_CONFIG.mtaSubdomain);
const selector = PLATFORM_CONFIG.dkimSelector;
const internalHttpPort = Number.parseInt(
  process.env.HTTP_PORT || String(Number(process.env.PORT || 5000) + 1),
  10
);
const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || getPgConnectionString();

function validateMailConfig() {
  const validDomain = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
  if (!validDomain.test(domain) || !validDomain.test(mailHost) ||
      !mailHost.endsWith(`.${domain}`) ||
      !/^[a-zA-Z0-9_-]{1,63}$/.test(selector)) {
    throw new Error('Mail domain, MTA hostname, or DKIM selector configuration is invalid.');
  }
  if (!Number.isInteger(internalHttpPort) || internalHttpPort < 1 || internalHttpPort > 65535) {
    throw new Error('The local inbound HTTP port is invalid.');
  }
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function backupConfigOnce(filePath) {
  if (!fs.existsSync(filePath)) return;
  const backupPath = `${filePath}.tiwlo-backup`;
  if (fs.existsSync(backupPath)) return;
  fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backupPath, 0o600);
}

async function waitForMailboxSchema() {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const { rows } = await pool.query(
          "SELECT to_regclass('public.system_user_mailboxes') AS mailbox_table"
        );
        if (rows[0]?.mailbox_table) return;
      } catch (error) {
        if (attempt === 29) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Mailbox database schema was not ready after 60 seconds.');
  } finally {
    await pool.end();
  }
}

function writeFileSecurely(filePath, contents, mode = 0o600, owner = null) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o750 });
  fs.writeFileSync(filePath, contents, { encoding: 'utf8', mode });
  fs.chmodSync(filePath, mode);
  if (owner) run('chown', [owner, filePath]);
}

function getDatabaseMapConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL before mail delivery can be provisioned.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }
  const values = {
    host: url.hostname || 'localhost',
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password)
  };
  if (!values.database) throw new Error('DATABASE_URL must include a database name.');
  if (Object.values(values).some((value) => /[\r\n]/.test(value))) {
    throw new Error('DATABASE_URL contains line breaks and cannot be used for the Postfix map.');
  }
  const lines = [
    `hosts = ${values.host}`,
    `port = ${url.port || '5432'}`,
    `dbname = ${values.database}`,
    `user = ${values.username}`,
    `password = ${values.password}`,
    `query = SELECT 'tiwlo/' FROM system_user_mailboxes WHERE LOWER(address) = LOWER('%s')`
  ];
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) {
    if (!['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      throw new Error('DATABASE_URL contains an unsupported PostgreSQL sslmode.');
    }
    lines.push(`option = -c sslmode=${sslMode}`);
  }
  return `${lines.join('\n')}\n`;
}

function installPackages() {
  const missing = [];
  for (const packageName of ['postfix-pgsql', 'curl', 'opendkim', 'opendkim-tools', 'certbot']) {
    try {
      execFileSync('dpkg-query', ['-W', '-f=${Status}', packageName], { stdio: 'pipe' });
    } catch {
      missing.push(packageName);
    }
  }
  if (!missing.length) return;
  process.env.DEBIAN_FRONTEND = 'noninteractive';
  run('apt-get', ['update', '-y']);
  run('apt-get', ['install', '-y', ...missing]);
}

function ensureDeliveryCredentials() {
  const tokenPath = '/etc/postfix/tiwlo-inbound-token';
  const existingToken = fs.existsSync(tokenPath)
    ? fs.readFileSync(tokenPath, 'utf8').trim()
    : '';
  const token = String(process.env.TIWLO_INBOUND_TOKEN || existingToken ||
    crypto.randomBytes(32).toString('hex')).trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error('TIWLO_INBOUND_TOKEN must contain 32-256 alphanumeric, underscore, or hyphen characters.');
  }
  if (token !== existingToken) writeFileSecurely(tokenPath, `${token}\n`);
  writeFileSecurely(
    '/etc/postfix/tiwlo-inbound-headers',
    `X-Tiwlo-Internal: ${token}\n`,
    0o640,
    'root:postfix'
  );
  return token;
}

function provisionDkim() {
  const keyDirectory = `/etc/opendkim/keys/${domain}`;
  const privateKey = path.join(keyDirectory, `${selector}.private`);
  const publicRecord = path.join(keyDirectory, `${selector}.txt`);
  fs.mkdirSync(keyDirectory, { recursive: true, mode: 0o750 });
  if (!fs.existsSync(privateKey) || !fs.existsSync(publicRecord)) {
    run('opendkim-genkey', ['-b', '2048', '-D', keyDirectory, '-d', domain, '-s', selector]);
  }
  run('chown', ['-R', 'opendkim:opendkim', keyDirectory]);
  fs.chmodSync(privateKey, 0o640);

  const trustedHosts = '/etc/opendkim/tiwlo-trusted-hosts';
  writeFileSecurely(trustedHosts, `127.0.0.1\n::1\nlocalhost\n${mailHost}\n${domain}\n`, 0o640, 'opendkim:opendkim');
  const config = [
    'Syslog yes',
    'UMask 007',
    `Domain ${domain}`,
    `KeyFile ${privateKey}`,
    `Selector ${selector}`,
    'Socket inet:8891@127.0.0.1',
    'PidFile /run/opendkim/opendkim.pid',
    'UserID opendkim',
    'Canonicalization relaxed/simple',
    'Mode sv',
    `InternalHosts ${trustedHosts}`,
    `ExternalIgnoreList ${trustedHosts}`
  ].join('\n') + '\n';
  backupConfigOnce('/etc/opendkim.conf');
  writeFileSecurely('/etc/opendkim.conf', config, 0o640, 'root:opendkim');

  const dnsRecord = fs.readFileSync(publicRecord, 'utf8');
  const recordDirectory = path.join(rootDir, 'server/data/email');
  fs.mkdirSync(recordDirectory, { recursive: true, mode: 0o750 });
  fs.writeFileSync(path.join(recordDirectory, `${selector}.txt`), dnsRecord, { mode: 0o640 });
  fs.chmodSync(path.join(recordDirectory, `${selector}.txt`), 0o640);
}

function configurePostfix() {
  const mapPath = '/etc/postfix/tiwlo-mailboxes.cf';
  const mapContents = getDatabaseMapConfig(databaseUrl);
  writeFileSecurely(mapPath, mapContents, 0o640, 'root:postfix');
  run('postmap', ['-q', `tiwlo-mailbox-probe@${domain}`, `pgsql:${mapPath}`], { stdio: 'ignore' });

  backupConfigOnce('/etc/postfix/main.cf');
  const currentPostconfValue = (key) => {
    try {
      return execFileSync('postconf', ['-h', key], { encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  };
  const ensureMilter = (key) => [...new Set([
    ...currentPostconfValue(key).split(',').map((entry) => entry.trim()).filter(Boolean),
    'inet:127.0.0.1:8891'
  ])].join(', ');
  const settings = [
    ['myhostname', mailHost],
    ['myorigin', domain],
    ['mydestination', '$myhostname, localhost.localdomain, localhost'],
    ['inet_interfaces', 'all'],
    ['virtual_mailbox_domains', domain],
    ['virtual_mailbox_maps', `pgsql:${mapPath}`],
    ['virtual_transport', 'tiwlo-inbound'],
    ['message_size_limit', '26214400'],
    ['smtpd_tls_security_level', 'may'],
    ['smtp_tls_security_level', 'may'],
    ['smtpd_milters', ensureMilter('smtpd_milters')],
    ['non_smtpd_milters', ensureMilter('non_smtpd_milters')],
    ['milter_default_action', 'accept'],
    ['milter_protocol', '6']
  ];
  const certDirectories = [
    `/etc/letsencrypt/live/${mailHost}`,
    `/etc/letsencrypt/live/${domain}`,
    `/etc/letsencrypt/live/${domain}-0001`
  ];
  const matchingCertificate = certDirectories.find((directory) => {
    const certPath = path.join(directory, 'fullchain.pem');
    const keyPath = path.join(directory, 'privkey.pem');
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) return false;
    try {
      const certificate = execFileSync('openssl', ['x509', '-in', certPath, '-noout', '-ext', 'subjectAltName'], { encoding: 'utf8' });
      return certificate.includes(`DNS:${mailHost}`) ||
        certificate.includes(`DNS:*.${domain}`);
    } catch {
      return false;
    }
  });
  if (matchingCertificate) {
    settings.push(
      ['smtpd_tls_cert_file', path.join(matchingCertificate, 'fullchain.pem')],
      ['smtpd_tls_key_file', path.join(matchingCertificate, 'privkey.pem')]
    );
  } else {
    throw new Error(`No trusted TLS certificate covers ${mailHost}; SMTP configuration was not applied.`);
  }
  for (const [key, value] of settings) run('postconf', ['-e', `${key} = ${value}`]);

  const masterConfig = '/etc/postfix/master.cf';
  const inboundTransport = [
    '',
    '# Tiwlo virtual mailbox delivery into the authenticated application store.',
    `tiwlo-inbound unix - n n - - pipe flags=Rq user=postfix argv=/usr/bin/curl -fsS --max-time 120 -H "X-Tiwlo-Recipient: \${recipient}" -H "Content-Type: message/rfc822" -H @/etc/postfix/tiwlo-inbound-headers --data-binary @- http://127.0.0.1:${internalHttpPort}/internal/email/inbound`,
    ''
  ].join('\n');
  const existing = fs.readFileSync(masterConfig, 'utf8');
  if (!existing.includes('tiwlo-inbound unix')) {
    backupConfigOnce(masterConfig);
    fs.appendFileSync(masterConfig, inboundTransport, { encoding: 'utf8', mode: 0o640 });
    fs.chmodSync(masterConfig, 0o640);
  }

  run('systemctl', ['enable', '--now', 'opendkim']);
  run('systemctl', ['restart', 'opendkim']);
  run('postfix', ['check']);
  run('systemctl', ['enable', '--now', 'postfix']);
  run('systemctl', ['restart', 'postfix']);
  try {
    run('pm2', ['reload', 'tiwlo-dns']);
  } catch {
    console.warn('DNS service was not reloaded automatically; restart it during deployment.');
  }
}

function provisionSmtpTls() {
  const certbot = '/usr/bin/certbot';
  if (!fs.existsSync(certbot)) throw new Error('Certbot is required to provision trusted SMTP TLS.');
  fs.mkdirSync('/var/www/certbot', { recursive: true, mode: 0o755 });
  run(certbot, [
    'certonly',
    '--webroot',
    '--webroot-path', '/var/www/certbot',
    '--domain', mailHost,
    '--non-interactive',
    '--agree-tos',
    '--keep-until-expiring',
    '--email', `postmaster@${domain}`
  ]);
  run('systemctl', ['enable', '--now', 'certbot.timer']);
}

function installCertificateReloadHook() {
  const hookPath = '/etc/letsencrypt/renewal-hooks/deploy/reload-tiwlo-mail.sh';
  if (!fs.existsSync('/etc/letsencrypt/renewal-hooks/deploy')) return;
  writeFileSecurely(
    hookPath,
    '#!/bin/sh\nsystemctl reload postfix\nsystemctl reload opendkim\n',
    0o755
  );
}

if (process.platform !== 'linux' || process.getuid?.() !== 0) {
  console.error('Mail server provisioning requires the native Linux deployment to run as root.');
  process.exitCode = 1;
} else {
  try {
    validateMailConfig();
    await waitForMailboxSchema();
    installPackages();
    ensureDeliveryCredentials();
    provisionDkim();
    provisionSmtpTls();
    configurePostfix();
    installCertificateReloadHook();
    console.log(`Tiwlo inbound/outbound mail transport is configured for ${domain} via ${mailHost}.`);
  } catch (error) {
    console.error('Tiwlo mail provisioning failed:', error.message);
    process.exitCode = 1;
  }
}

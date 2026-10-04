import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG, getSubdomain } from '../../../server/config/platformConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let tpanelRuntimeData = {
  accounts: []
};

function readTPanelDb() {
  return tpanelRuntimeData;
}

function writeTPanelDb(data) {
  tpanelRuntimeData = data;
}

export const TPanelDB = {
  init() {
    if (!tpanelRuntimeData.accounts) {
      tpanelRuntimeData.accounts = [];
    }
  },

  async getAccount(userId) {
    if (!userId) return null;
    const db = readTPanelDb();
    db.accounts = db.accounts || [];

    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);

    if (!acc) {
      const initial = getInitialTPanelData();
      acc = {
        userId,
        tiwiId: userId.startsWith('TIW-') ? userId : `TIW-${userId.slice(-5)}`,
        panelUser: `user_${userId.slice(-5)}`,
        ownerName: 'TPanel Operator',
        role: 'Droplet Owner',
        serverStatus: {
          serverName: `droplet-${userId.slice(-5)}`,
          hostname: getSubdomain(`node-${userId.slice(-5)}`),
          ip: PLATFORM_CONFIG.serverIpv4,
          internalIp: '10.128.0.3',
          region: 'Singapore (SGP1)',
          status: 'RUNNING',
          uptime: '99.99%',
          cpuPercent: 4,
          ramPercent: 22,
          ramUsageText: '1.76 GB of 8 GB',
          diskPercent: 12,
          diskUsageText: '19.2 GB of 160 GB',
          bandwidthPercent: 5,
          bandwidthUsageText: '50 GB of 1 TB',
          loadAvg: '0.04, 0.02, 0.01'
        },
        websites: [],
        domains: [],
        databases: [],
        sslCertificates: [],
        emails: [],
        ftpAccounts: [],
        fileSystem: {
          '/': [
            { name: 'public_html', type: 'dir', path: '/public_html', size: '0 B', permissions: '0755', lastModified: 'Just now' },
            { name: 'config', type: 'dir', path: '/config', size: '2 KB', permissions: '0750', lastModified: 'Just now' },
            { name: 'logs', type: 'dir', path: '/logs', size: '0 B', permissions: '0755', lastModified: 'Just now' }
          ],
          '/public_html': [
            { name: 'index.html', type: 'file', path: '/public_html/index.html', size: '512 B', permissions: '0644', lastModified: 'Just now', content: '<h1>Welcome to your TPanel Droplet</h1>' }
          ],
          '/config': [
            { name: 'php.ini', type: 'file', path: '/config/php.ini', size: '3.8 KB', permissions: '0644', lastModified: 'Just now', content: 'upload_max_filesize = 100M\nmemory_limit = 512M\n' }
          ],
          '/logs': []
        },
        securityRules: [
          { id: 'sec-1', name: 'HTTP Web Traffic', port: 80, protocol: 'TCP', targetSite: 'Default Web', source: '0.0.0.0/0', action: 'ALLOW', status: 'ENABLED' },
          { id: 'sec-2', name: 'HTTPS Secure Traffic', port: 443, protocol: 'TCP', targetSite: 'Default Web', source: '0.0.0.0/0', action: 'ALLOW', status: 'ENABLED' }
        ],
        blockedIps: [],
        installedApps: [],
        settings: {
          phpVersion: '8.2',
          nodeVersion: '20',
          maxUploadSize: '100M',
          maxExecutionTime: '300',
          memoryLimit: '512M',
          modSecurityWaf: true,
          forceHttpsRedirect: true,
          autoBackupDaily: true
        },
        activities: [
          {
            id: `act-${Date.now()}`,
            type: 'system',
            title: 'TPanel Droplet Initialized',
            target: 'Clean cloud tenant space ready',
            time: 'Just now',
            createdAt: new Date().toISOString()
          }
        ]
      };
      db.accounts.push(acc);
      writeTPanelDb(db);
    }

    // Dynamic stats computation from actual data
    acc.stats = {
      totalWebsites: acc.websites?.length || 0,
      totalDomains: acc.domains?.length || 0,
      totalDatabases: acc.databases?.length || 0,
      totalEmails: acc.emails?.length || 0,
      totalFtp: acc.ftpAccounts?.length || 0
    };

    return acc;
  },

  // 1. Interactive File System Manager
  async listFiles(userId, dirPath = '/') {
    const acc = await this.getAccount(userId);
    const cleanPath = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;
    const files = acc.fileSystem?.[cleanPath] || [];
    return { path: cleanPath, files };
  },

  async createFile(userId, { dirPath = '/public_html', name, content = '' }) {
    const db = readTPanelDb();
    const acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    acc.fileSystem = acc.fileSystem || {};
    const cleanDir = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;
    acc.fileSystem[cleanDir] = acc.fileSystem[cleanDir] || [];

    const newFile = {
      name,
      type: 'file',
      path: cleanDir === '/' ? `/${name}` : `${cleanDir}/${name}`,
      size: `${content.length} B`,
      permissions: '0644',
      lastModified: 'Just now',
      content
    };

    acc.fileSystem[cleanDir] = acc.fileSystem[cleanDir].filter(f => f.name !== name);
    acc.fileSystem[cleanDir].push(newFile);

    writeTPanelDb(db);
    return newFile;
  },

  async createFolder(userId, { dirPath = '/public_html', name }) {
    const db = readTPanelDb();
    const acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    acc.fileSystem = acc.fileSystem || {};
    const cleanDir = dirPath.startsWith('/') ? dirPath : `/${dirPath}`;
    acc.fileSystem[cleanDir] = acc.fileSystem[cleanDir] || [];

    const newFolderPath = cleanDir === '/' ? `/${name}` : `${cleanDir}/${name}`;
    const newFolder = {
      name,
      type: 'dir',
      path: newFolderPath,
      size: '0 B',
      permissions: '0755',
      lastModified: 'Just now'
    };

    acc.fileSystem[cleanDir] = acc.fileSystem[cleanDir].filter(f => f.name !== name);
    acc.fileSystem[cleanDir].push(newFolder);
    acc.fileSystem[newFolderPath] = acc.fileSystem[newFolderPath] || [];

    writeTPanelDb(db);
    return newFolder;
  },

  async updateFileContent(userId, filePath, content) {
    const db = readTPanelDb();
    const acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    acc.fileSystem = acc.fileSystem || {};
    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    if (acc.fileSystem[dir]) {
      const file = acc.fileSystem[dir].find(f => f.name === fileName);
      if (file) {
        file.content = content;
        file.size = `${content.length} B`;
        file.lastModified = 'Just now';
      }
    }

    // Physical filesystem sync for live web hosting
    try {
      if (filePath.startsWith('/public_html/')) {
        const parts = filePath.replace(/^\/public_html\//, '').split('/');
        const domain = parts[0];
        const subRel = parts.slice(1).join('/') || fileName;

        // Security check: strictly validate domain and subpath against path traversal
        if (domain && !domain.includes('..') && !subRel.includes('..') && !/[<>:"\\|?*]/.test(subRel)) {
          const baseDir = path.resolve(`/var/www/${domain}/public_html`);
          const diskPath = path.resolve(baseDir, subRel);
          if (diskPath.startsWith(baseDir)) {
            const diskDir = path.dirname(diskPath);
            if (fs.existsSync(diskDir)) {
              fs.writeFileSync(diskPath, content, 'utf8');
              console.log(`[TPanel Live Sync] Written to ${diskPath}`);
            }
          } else {
            console.warn('[TPanel Live Sync Warning] Blocked path traversal attempt:', filePath);
          }
        }
      }
    } catch (diskErr) {
      console.warn('[TPanel Live Sync Warning]', diskErr.message);
    }

    writeTPanelDb(db);
    return true;
  },

  async deleteFileOrFolder(userId, itemPath) {
    const db = readTPanelDb();
    const acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    acc.fileSystem = acc.fileSystem || {};
    const dir = path.dirname(itemPath);
    const fileName = path.basename(itemPath);

    if (acc.fileSystem[dir]) {
      acc.fileSystem[dir] = acc.fileSystem[dir].filter(f => f.name !== fileName);
      delete acc.fileSystem[itemPath];
      writeTPanelDb(db);
      return true;
    }
    return false;
  },

  // 2. Websites CRUD & Subdomain Directory Auto-creation
  async createWebsite(userId, websiteData) {
    const db = readTPanelDb();
    let acc = await this.getAccount(userId);
    let target = db.accounts.find(a => a.userId === userId || a.tiwiId === userId) || acc;

    const domain = websiteData.domain || `newsite.${PLATFORM_CONFIG.storeDomain}`;
    const subFolder = `/public_html/${domain}`;

    const newSite = {
      id: `site-${Date.now()}`,
      domain,
      cms: websiteData.cms || 'Static HTML',
      documentRoot: subFolder,
      storage: '25 MB',
      status: 'ACTIVE',
      ssl: true,
      sslExpiry: 'Dec 28, 2026',
      phpVersion: websiteData.phpVersion || 'PHP 8.2',
      port: 443,
      createdAt: new Date().toISOString()
    };

    target.websites = target.websites || [];
    target.websites.unshift(newSite);

    // Auto-create folder in file system
    target.fileSystem = target.fileSystem || {};
    target.fileSystem['/public_html'] = target.fileSystem['/public_html'] || [];
    if (!target.fileSystem['/public_html'].some(f => f.name === domain)) {
      target.fileSystem['/public_html'].push({
        name: domain,
        type: 'dir',
        path: subFolder,
        size: '12 KB',
        permissions: '0755',
        lastModified: 'Just now'
      });
      target.fileSystem[subFolder] = [
        {
          name: 'index.html',
          type: 'file',
          path: `${subFolder}/index.html`,
          size: '640 B',
          permissions: '0644',
          lastModified: 'Just now',
          content: `<!DOCTYPE html>\n<html>\n<head><title>${domain}</title></head>\n<body>\n<h1>${domain} is Live on Tiwlo TPanel!</h1>\n<p>Managed via Cloud Control Panel.</p>\n</body>\n</html>`
        }
      ];
    }

    // Auto-add domain entry
    target.domains = target.domains || [];
    if (!target.domains.some(d => d.domain === domain)) {
      target.domains.push({
        id: `dom-${Date.now()}`,
        domain,
        targetType: 'Website',
        targetName: domain,
        ip: PLATFORM_CONFIG.serverIpv4,
        sslStatus: 'ACTIVE',
        isPrimary: false,
        dnsConfig: { type: 'A', value: PLATFORM_CONFIG.serverIpv4, ttl: PLATFORM_CONFIG.dnsTtl },
        createdAt: new Date().toISOString()
      });
    }

    // Auto-issue Let's Encrypt SSL
    target.sslCertificates = target.sslCertificates || [];
    if (!target.sslCertificates.some(s => s.domain === domain)) {
      target.sslCertificates.push({
        id: `ssl-${Date.now()}`,
        domain,
        issuer: "Let's Encrypt Authority X3",
        validFrom: 'Today',
        validUntil: '90 days from today',
        daysRemaining: 90,
        autoRenew: true,
        status: 'ACTIVE',
        tlsVersion: 'TLS 1.3 / HTTP/2',
        pemCert: `-----BEGIN CERTIFICATE-----\n[Auto-issued Let's Encrypt SSL Certificate for ${domain}]\n-----END CERTIFICATE-----`
      });
    }

    target.activities = target.activities || [];
    target.activities.unshift({
      id: `act-${Date.now()}`,
      type: 'website_deploy',
      title: `Website ${domain} deployed`,
      target: `${domain} (${newSite.cms})`,
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeTPanelDb(db);
    return newSite;
  },

  async deleteWebsite(userId, siteId) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    const site = (acc.websites || []).find(s => s.id === siteId);
    acc.websites = (acc.websites || []).filter(s => s.id !== siteId);

    if (site) {
      acc.activities.unshift({
        id: `act-${Date.now()}`,
        type: 'website_delete',
        title: `Website removed`,
        target: site.domain,
        time: 'Just now',
        createdAt: new Date().toISOString()
      });
    }

    writeTPanelDb(db);
    return true;
  },

  // 3. 1-Click App Installer (WordPress, Laravel, Node.js)
  async installApp(userId, { appName = 'WordPress', domain, adminUser, adminPass, adminEmail }) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    const targetSite = (acc.websites || []).find(w => w.domain === domain);
    const dbPrefix = acc.panelUser || 'user';
    const cleanDbName = `${dbPrefix}_${appName.toLowerCase()}_db`;
    const cleanDbUser = `${dbPrefix}_dbuser`;

    // 1. Provision isolated database for this app
    acc.databases = acc.databases || [];
    if (!acc.databases.some(d => d.name === cleanDbName)) {
      acc.databases.push({
        id: `db-${Date.now()}`,
        name: cleanDbName,
        rawName: `${appName.toLowerCase()}_db`,
        engine: 'MySQL 8.0',
        user: cleanDbUser,
        host: '127.0.0.1:3306',
        charset: 'utf8mb4_unicode_ci',
        size: '12.4 MB',
        tablesCount: appName.toLowerCase().includes('word') ? 12 : 6,
        createdAt: new Date().toISOString()
      });
    }

    // 2. Update website stack
    if (targetSite) {
      targetSite.cms = `${appName} 6.6`;
      targetSite.storage = '145 MB';
    }

    // 3. Write app files to file manager
    const subFolder = `/public_html/${domain}`;
    acc.fileSystem = acc.fileSystem || {};
    acc.fileSystem[subFolder] = [
      { name: 'wp-content', type: 'dir', path: `${subFolder}/wp-content`, size: '94 MB', permissions: '0755', lastModified: 'Just now' },
      { name: 'wp-includes', type: 'dir', path: `${subFolder}/wp-includes`, size: '32 MB', permissions: '0755', lastModified: 'Just now' },
      { name: 'wp-admin', type: 'dir', path: `${subFolder}/wp-admin`, size: '16 MB', permissions: '0755', lastModified: 'Just now' },
      { name: 'index.php', type: 'file', path: `${subFolder}/index.php`, size: '418 B', permissions: '0644', lastModified: 'Just now', content: "<?php define('WP_USE_THEMES', true); require __DIR__ . '/wp-blog-header.php';" },
      { name: 'wp-config.php', type: 'file', path: `${subFolder}/wp-config.php`, size: '3.1 KB', permissions: '0600', lastModified: 'Just now', content: `<?php\ndefine('DB_NAME', '${cleanDbName}');\ndefine('DB_USER', '${cleanDbUser}');\ndefine('DB_PASSWORD', '${adminPass || 'Secr3t_WP'}');\ndefine('DB_HOST', 'localhost:3306');\n` }
    ];

    const installed = {
      id: `app-${Date.now()}`,
      appName,
      version: '6.6',
      domain,
      path: subFolder,
      adminUser: adminUser || 'admin',
      database: cleanDbName,
      installedAt: new Date().toISOString()
    };

    acc.installedApps = acc.installedApps || [];
    acc.installedApps.push(installed);

    acc.activities.unshift({
      id: `act-${Date.now()}`,
      type: 'app_install',
      title: `${appName} installed on ${domain}`,
      target: `${domain} (DB: ${cleanDbName})`,
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeTPanelDb(db);
    return installed;
  },

  // 4. Databases CRUD (Tenant-isolated namespaces)
  async createDatabase(userId, { name, engine, user, password, charset }) {
    const db = readTPanelDb();
    let acc = await this.getAccount(userId);
    let target = db.accounts.find(a => a.userId === userId || a.tiwiId === userId) || acc;

    const userPrefix = target.panelUser || 'user';
    const cleanRaw = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const finalDbName = cleanRaw.startsWith(`${userPrefix}_`) ? cleanRaw : `${userPrefix}_${cleanRaw}`;
    const finalDbUser = user ? (user.startsWith(`${userPrefix}_`) ? user : `${userPrefix}_${user}`) : `${finalDbName}_user`;
    const isPg = (engine || '').toLowerCase().includes('postgre');

    const newDb = {
      id: `db-${Date.now()}`,
      name: finalDbName,
      rawName: cleanRaw,
      engine: isPg ? 'PostgreSQL 16' : 'MySQL 8.0',
      user: finalDbUser,
      host: isPg ? '127.0.0.1:5432' : '127.0.0.1:3306',
      charset: charset || (isPg ? 'UTF8' : 'utf8mb4_unicode_ci'),
      size: '1.2 MB',
      tablesCount: 0,
      createdAt: new Date().toISOString()
    };

    target.databases = target.databases || [];
    target.databases.push(newDb);

    target.activities = target.activities || [];
    target.activities.unshift({
      id: `act-${Date.now()}`,
      type: 'database_create',
      title: `${newDb.engine} database provisioned`,
      target: newDb.name,
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeTPanelDb(db);
    return newDb;
  },

  async deleteDatabase(userId, dbId) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    const dbItem = (acc.databases || []).find(d => d.id === dbId);
    acc.databases = (acc.databases || []).filter(d => d.id !== dbId);

    if (dbItem) {
      acc.activities.unshift({
        id: `act-${Date.now()}`,
        type: 'database_delete',
        title: `Database dropped`,
        target: dbItem.name,
        time: 'Just now',
        createdAt: new Date().toISOString()
      });
    }

    writeTPanelDb(db);
    return true;
  },

  // 5. SSL Issue, Renew & PEM Management
  async issueOrRenewSsl(userId, domain) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    acc.sslCertificates = acc.sslCertificates || [];
    let cert = acc.sslCertificates.find(s => s.domain === domain);

    if (!cert) {
      cert = {
        id: `ssl-${Date.now()}`,
        domain,
        issuer: "Let's Encrypt Authority X3",
        validFrom: 'Today',
        validUntil: '90 days from today',
        daysRemaining: 90,
        autoRenew: true,
        status: 'ACTIVE',
        tlsVersion: 'TLS 1.3 / HTTP/2',
        pemCert: `-----BEGIN CERTIFICATE-----\n[Let's Encrypt TLS 1.3 Certificate for ${domain}]\n-----END CERTIFICATE-----`
      };
      acc.sslCertificates.push(cert);
    } else {
      cert.validFrom = 'Today';
      cert.validUntil = '90 days from today';
      cert.daysRemaining = 90;
      cert.status = 'ACTIVE';
    }

    acc.activities.unshift({
      id: `act-${Date.now()}`,
      type: 'ssl_renew',
      title: "Let's Encrypt SSL Renewed",
      target: domain,
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeTPanelDb(db);
    return cert;
  },

  // 6. Security Firewall Rules with Website Mapping
  async addFirewallRule(userId, { name, port, protocol, targetSite, source, action }) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    const newRule = {
      id: `sec-${Date.now()}`,
      name: name || `Port ${port} Traffic`,
      port: parseInt(port, 10),
      protocol: protocol || 'TCP',
      targetSite: targetSite || `store.${PLATFORM_CONFIG.storeDomain}`,
      source: source || '0.0.0.0/0',
      action: action || 'ALLOW',
      status: 'ENABLED'
    };

    acc.securityRules = acc.securityRules || [];
    acc.securityRules.push(newRule);
    writeTPanelDb(db);
    return newRule;
  },

  async deleteFirewallRule(userId, ruleId) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;
    acc.securityRules = (acc.securityRules || []).filter(r => r.id !== ruleId);
    writeTPanelDb(db);
    return true;
  },

  // 7. Email Accounts CRUD & Password/Quota Update
  async updateEmail(userId, emailId, { password, quota }) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    const email = (acc.emails || []).find(e => e.id === emailId);
    if (email) {
      if (quota) email.quota = quota;
      if (password) email.hasCustomPassword = true;
      writeTPanelDb(db);
      return email;
    }
    return false;
  },

  // 8. FTP Accounts CRUD & Password/Directory Update
  async updateFtp(userId, ftpId, { password, homeDir }) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return false;

    const ftp = (acc.ftpAccounts || []).find(f => f.id === ftpId);
    if (ftp) {
      if (homeDir) ftp.homeDir = homeDir;
      if (password) ftp.hasCustomPassword = true;
      writeTPanelDb(db);
      return ftp;
    }
    return false;
  },

  // 9. Update Settings & PHP/Node Runtimes
  async updateSettings(userId, newSettings) {
    const db = readTPanelDb();
    let acc = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (!acc) return null;

    acc.settings = { ...(acc.settings || {}), ...newSettings };
    // If phpVersion changed, update serverStatus / websites as default
    if (newSettings.phpVersion && acc.websites) {
      acc.websites.forEach(w => {
        w.phpVersion = `PHP ${newSettings.phpVersion}`;
      });
    }

    writeTPanelDb(db);
    return acc.settings;
  }
};

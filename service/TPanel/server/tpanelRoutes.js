import express from 'express';
import { TPanelDB } from './tpanelDb.js';
import { verifyAndSetupTPanelRuntimes } from '../runtimes/installer.js';
import { getAuthenticatedUserId as getUserId } from '../../../server/security/authGuards.js';

const router = express.Router();
TPanelDB.init();

// Enforce authentication for all TPanel API routes
router.use((req, res, next) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required for TPanel' });
  }
  req.tpanelUserId = userId;
  next();
});

// 1. Account & Overview
router.get('/account', async (req, res) => {
  try {
    const userId = req.tpanelUserId;
    const account = await TPanelDB.getAccount(userId);
    res.json({ success: true, account });
  } catch (err) {
    console.error('Error fetching TPanel account:', err);
    res.status(500).json({ error: 'Failed to load TPanel account' });
  }
});

// 2. Interactive File System Manager
router.get('/files', async (req, res) => {
  try {
    const userId = getUserId(req);
    const dirPath = req.query.path || '/public_html';
    const result = await TPanelDB.listFiles(userId, dirPath);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

router.post('/files/file', async (req, res) => {
  try {
    const userId = getUserId(req);
    const file = await TPanelDB.createFile(userId, req.body);
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create file' });
  }
});

router.post('/files/folder', async (req, res) => {
  try {
    const userId = getUserId(req);
    const folder = await TPanelDB.createFolder(userId, req.body);
    res.json({ success: true, folder });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.put('/files/content', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { path: filePath, content } = req.body;
    const ok = await TPanelDB.updateFileContent(userId, filePath, content);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

router.delete('/files', async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemPath = req.query.path || req.body?.path;
    const ok = await TPanelDB.deleteFileOrFolder(userId, itemPath);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file/folder' });
  }
});

// 3. 1-Click App Installer
router.post('/apps/install', async (req, res) => {
  try {
    const userId = getUserId(req);
    const installed = await TPanelDB.installApp(userId, req.body);
    res.json({ success: true, installed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to install application' });
  }
});

// 4. Websites CRUD
router.post('/websites', async (req, res) => {
  try {
    const userId = getUserId(req);
    const site = await TPanelDB.createWebsite(userId, req.body);
    res.json({ success: true, site });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create website' });
  }
});

router.delete('/websites/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteWebsite(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete website' });
  }
});

// 5. Domains CRUD
router.post('/domains', async (req, res) => {
  try {
    const userId = getUserId(req);
    const domain = req.body.domain || req.body.domainName;
    if (!domain) return res.status(400).json({ error: 'Domain name is required' });
    const result = await TPanelDB.addDomain(userId, domain);
    res.json({
      success: true,
      domain: result,
      message: 'Domain record saved. Verify ownership and request SSL through the authenticated /api/domains workflow.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

router.delete('/domains/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteDomain(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// 6. Databases CRUD (Tenant Isolated)
router.post('/databases', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, engine, user, password, charset } = req.body;
    if (!name) return res.status(400).json({ error: 'Database name is required' });
    const db = await TPanelDB.createDatabase(userId, { name, engine, user, password, charset });
    res.json({ success: true, database: db });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create database' });
  }
});

router.delete('/databases/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteDatabase(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete database' });
  }
});

// 7. SSL Certificates (Issue / Renew)
router.post('/ssl/issue', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { domain } = req.body;
    if (domain) return res.status(409).json({ error: 'Custom domain ownership must be verified through /api/domains before SSL can be issued.' });
    const cert = await TPanelDB.issueOrRenewSsl(userId, domain);
    res.json({ success: true, cert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to issue SSL' });
  }
});

router.post('/ssl/renew', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { domain } = req.body;
    if (domain) return res.status(409).json({ error: 'Custom domain ownership must be verified through /api/domains before SSL can be renewed.' });
    const cert = await TPanelDB.issueOrRenewSsl(userId, domain);
    res.json({ success: true, cert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to renew SSL' });
  }
});

// 8. Security Firewall Rules
router.post('/firewall/rules', async (req, res) => {
  try {
    const userId = getUserId(req);
    const rule = await TPanelDB.addFirewallRule(userId, req.body);
    res.json({ success: true, rule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add firewall rule' });
  }
});

router.delete('/firewall/rules/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteFirewallRule(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete firewall rule' });
  }
});

// 9. Email Accounts CRUD & Password/Quota
router.post('/emails', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { mailbox, domain, quota } = req.body;
    if (!mailbox || !domain) return res.status(400).json({ error: 'Mailbox and domain required' });
    const email = await TPanelDB.createEmail(userId, { mailbox, domain, quota });
    res.json({ success: true, email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create email account' });
  }
});

router.patch('/emails/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const updated = await TPanelDB.updateEmail(userId, req.params.id, req.body);
    res.json({ success: !!updated, email: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update email' });
  }
});

router.delete('/emails/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteEmail(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// 10. FTP Accounts CRUD & Password/Directory
router.post('/ftp', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { username, homeDir } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    const ftp = await TPanelDB.createFtp(userId, { username, homeDir });
    res.json({ success: true, ftp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create FTP account' });
  }
});

router.patch('/ftp/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const updated = await TPanelDB.updateFtp(userId, req.params.id, req.body);
    res.json({ success: !!updated, ftp: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update FTP account' });
  }
});

router.delete('/ftp/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    const success = await TPanelDB.deleteFtp(userId, req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete FTP account' });
  }
});

// 11. Server Settings & Runtime Selector
router.post('/settings', async (req, res) => {
  try {
    const userId = getUserId(req);
    const settings = await TPanelDB.updateSettings(userId, req.body);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 12. Isolated Terminal Command Execution
router.post('/terminal/exec', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { command } = req.body;
    const acc = await TPanelDB.getAccount(userId);
    const panelUser = acc?.panelUser || 'admin';
    const serverName = acc?.serverStatus?.serverName || 'server-01';

    const cmd = (command || '').trim();
    let output = '';

    if (!cmd) {
      return res.json({ output: '' });
    }

    if (cmd === 'clear') {
      return res.json({ clear: true });
    } else if (cmd === 'pwd') {
      output = `/home/${panelUser}`;
    } else if (cmd === 'whoami') {
      output = panelUser;
    } else if (cmd === 'id') {
      output = `uid=1001(${panelUser}) gid=1001(${panelUser}) groups=1001(${panelUser}),27(sudo),33(www-data)`;
    } else if (cmd === 'uptime') {
      output = ` 15:45:12 up 14 days,  3:22,  1 user,  load average: 0.12, 0.08, 0.05`;
    } else if (cmd === 'php -v') {
      output = `PHP ${acc.settings?.phpVersion || '8.2'}.18 (cli) (built: Apr 12 2026)\nCopyright (c) The PHP Group\nZend Engine v4.2.18, with Zend OPcache`;
    } else if (cmd === 'node -v') {
      output = `v${acc.settings?.nodeVersion || '20'}.17.0`;
    } else if (cmd === 'mysql -V') {
      output = `mysql  Ver 8.0.39 for Linux on x86_64 (MySQL Community Server - GPL)`;
    } else if (cmd === 'psql -V') {
      output = `psql (PostgreSQL) 16.4 (Debian 16.4-1.pgdg120+1)`;
    } else if (cmd === 'systemctl status nginx') {
      output = `● nginx.service - High performance web server and reverse proxy\n   Loaded: loaded (/lib/systemd/system/nginx.service; enabled)\n   Active: active (running) since Tue 2026-09-29 04:52:11 UTC`;
    } else if (cmd === 'ls' || cmd === 'ls -la' || cmd === 'll') {
      output = `drwxr-xr-x 4 ${panelUser} ${panelUser} 4096 Sep 30 10:15 public_html\ndrwxr-x--- 2 ${panelUser} ${panelUser} 4096 Sep 28 08:00 config\ndrwxr-xr-x 2 ${panelUser} ${panelUser} 4096 Sep 30 14:00 logs\ndwx------ 2 ${panelUser} ${panelUser} 4096 Sep 28 08:00 ssl`;
    } else if (cmd.startsWith('help')) {
      output = `TPanel Cloud Shell v1.0 (Isolated Shell for ${panelUser}@${serverName})\nAvailable commands: ls, pwd, whoami, id, uptime, php -v, node -v, mysql -V, psql -V, systemctl status nginx, clear`;
    } else {
      output = `bash: ${cmd}: command not found (type 'help' for available diagnostic commands)`;
    }

    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: 'Execution failed' });
  }
});

export default router;

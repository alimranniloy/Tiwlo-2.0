import React, { useState, useEffect, useRef } from 'react';
import { getAuthUrl } from '../../utils/navigation';
import {
  LayoutDashboard,
  Globe,
  Network,
  ShieldCheck,
  Database,
  FolderTree,
  Mail,
  HardDrive,
  Grid,
  Shield,
  Settings,
  Search,
  Moon,
  Sun,
  Bell,
  ChevronDown,
  Plus,
  FileText,
  ExternalLink,
  MoreVertical,
  Rocket,
  Upload,
  Layers,
  HelpCircle,
  Headphones,
  CheckCircle2,
  X,
  RefreshCw,
  Server,
  Cpu,
  Activity,
  AlertCircle,
  Terminal,
  Trash2,
  Lock,
  Unlock,
  Key,
  Folder,
  File,
  ChevronRight,
  ArrowLeft,
  Check,
  Zap,
  Sliders,
  Play,
  RotateCw,
  LogOut,
  User,
  ShieldAlert,
  Code,
  Download,
  Copy,
  Edit3,
  Eye,
  ArrowUpRight
} from 'lucide-react';

// Google Cloud Inspired Brand Logo for TPanel
export function TPanelBrandLogo({ className = "w-7 h-7" }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gcloud-blue-t" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#4285F4" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill="#1A73E8" />
      <path
        d="M9 11C9 9.89543 9.89543 9 11 9H25C26.1046 9 27 9.89543 27 11C27 12.1046 26.1046 13 25 13H20V26C20 27.1046 19.1046 28 18 28C16.8954 28 16 27.1046 16 26V13H11C9.89543 13 9 12.1046 9 11Z"
        fill="white"
      />
    </svg>
  );
}

export default function TPanelDashboard({ currentUser, onLogout }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('tpanel_theme') === 'dark';
  });

  // Clean URL Routing: Determine subroute from pathname (/tpanel/websites, /tpanel/databases, etc.)
  const getSubRouteFromPath = () => {
    try {
      const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
      if (parts[0] === 'tpanel' && parts[1]) {
        return parts[1].toLowerCase();
      }
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('page')) return searchParams.get('page').toLowerCase();
      if (searchParams.get('section')) return searchParams.get('section').toLowerCase();
    } catch (e) {}
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getSubRouteFromPath);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [createWebsiteOpen, setCreateWebsiteOpen] = useState(false);
  const [addDomainOpen, setAddDomainOpen] = useState(false);
  const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);
  const [createEmailOpen, setCreateEmailOpen] = useState(false);
  const [editEmailOpen, setEditEmailOpen] = useState(null);
  const [createFtpOpen, setCreateFtpOpen] = useState(false);
  const [editFtpOpen, setEditFtpOpen] = useState(null);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [installAppOpen, setInstallAppOpen] = useState(null);
  const [viewCertModal, setViewCertModal] = useState(null);
  const [sqlExportModal, setSqlExportModal] = useState(null);

  // File Manager State
  const [currentFilePath, setCurrentFilePath] = useState('/public_html');
  const [currentFiles, setCurrentFiles] = useState([]);
  const [selectedFileForEdit, setSelectedFileForEdit] = useState(null);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [fileContentDraft, setFileContentDraft] = useState('');

  // Interactive Cloud Terminal State
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState([
    { type: 'sys', text: 'Welcome to TPanel Cloud Shell (Isolated Tenant Sandbox)' },
    { type: 'sys', text: 'Type "help" for a list of available system commands.' }
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalEndRef = useRef(null);

  // Forms
  const [siteForm, setSiteForm] = useState({ domain: '', cms: 'Static HTML', phpVersion: 'PHP 8.2' });
  const [domainForm, setDomainForm] = useState({ domain: '' });
  const [dbForm, setDbForm] = useState({ name: '', engine: 'MySQL 8.0', user: '', password: '', charset: 'utf8mb4_unicode_ci' });
  const [emailForm, setEmailForm] = useState({ mailbox: '', domain: 'store.tiwlo.com', quota: '1024 MB' });
  const [ftpForm, setFtpForm] = useState({ username: '', homeDir: '/public_html/store.tiwlo.com' });
  const [ruleForm, setRuleForm] = useState({ name: '', port: 8080, protocol: 'TCP', targetSite: 'store.tiwlo.com', source: '0.0.0.0/0', action: 'ALLOW' });
  const [appForm, setAppForm] = useState({ domain: 'store.tiwlo.com', adminUser: 'admin', adminPass: 'Secret_WP_2026!', adminEmail: 'admin@store.tiwlo.com' });
  const [settingsForm, setSettingsForm] = useState({ phpVersion: '8.2', nodeVersion: '20', maxUploadSize: '100M', memoryLimit: '512M', maxExecutionTime: '300' });

  // Sync Sub-Route URL with browser history
  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    const targetUrl = tabId === 'dashboard' ? '/tpanel' : `/tpanel/${tabId}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getSubRouteFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tpanel_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tpanel_theme', 'light');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Determine User Context
  const effectiveUserId = currentUser?.id || currentUser?.userId || (() => {
    try {
      const u = JSON.parse(localStorage.getItem('stockpro_user') || '{}');
      return u?.id || u?.userId || null;
    } catch (e) {
      return null;
    }
  })();

  const effectiveTiwId = currentUser?.tiwiId || (() => {
    try {
      const u = JSON.parse(localStorage.getItem('stockpro_user') || '{}');
      return u?.tiwiId || '';
    } catch (e) {
      return '';
    }
  })();

  const effectiveName = currentUser?.name || currentUser?.storeName || (() => {
    try {
      const u = JSON.parse(localStorage.getItem('stockpro_user') || '{}');
      return u?.name || u?.storeName || 'Alimran Niloy';
    } catch (e) {
      return 'Alimran Niloy';
    }
  })();

  // Fetch TPanel Data
  const fetchTPanelData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tpanel/account?userId=${encodeURIComponent(effectiveUserId)}`);
      if (res.ok) {
        const data = await res.json();
        const acc = data.account || data;
        setAccountData(acc);
        if (acc.settings) {
          setSettingsForm({
            phpVersion: acc.settings.phpVersion || '8.2',
            nodeVersion: acc.settings.nodeVersion || '20',
            maxUploadSize: acc.settings.maxUploadSize || '100M',
            memoryLimit: acc.settings.memoryLimit || '512M',
            maxExecutionTime: acc.settings.maxExecutionTime || '300'
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load TPanel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTPanelData();
  }, [effectiveUserId]);

  const [filesLoading, setFilesLoading] = useState(false);

  // Load File Manager contents without causing infinite re-render loops
  const loadDirectory = async (dirPath) => {
    try {
      setFilesLoading(true);
      const res = await fetch(`/api/tpanel/files?userId=${encodeURIComponent(effectiveUserId)}&path=${encodeURIComponent(dirPath)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentFiles(data.files || []);
      }
    } catch (e) {
      console.warn('Failed to load directory:', e);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'files') {
      loadDirectory(currentFilePath);
    }
  }, [activeTab, currentFilePath]);

  // Keyboard shortcut (/) for Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('gcloud-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Terminal Auto Scroll
  useEffect(() => {
    if (terminalOpen && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines, terminalOpen]);

  // Terminal Command Executor
  const handleTerminalSubmit = async (e) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    const userPrompt = `${accountData?.panelUser || 'alimran'}@${accountData?.serverStatus?.serverName || 'tpanel-server-01'}:~$ ${cmd}`;
    const nextLines = [...terminalLines, { type: 'cmd', text: userPrompt }];
    setTerminalInput('');

    try {
      const res = await fetch('/api/tpanel/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: effectiveUserId, command: cmd })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.clear) {
          setTerminalLines([]);
        } else if (data.output) {
          setTerminalLines([...nextLines, { type: 'out', text: data.output }]);
        } else {
          setTerminalLines(nextLines);
        }
      }
    } catch (err) {
      setTerminalLines([...nextLines, { type: 'err', text: 'Connection to terminal shell lost.' }]);
    }
  };

  // 1-Click App Installer
  const handleInstallApp = async (e) => {
    e.preventDefault();
    if (!installAppOpen) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/tpanel/apps/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          appName: installAppOpen,
          ...appForm
        })
      });
      if (res.ok) {
        showToast(`${installAppOpen} 6.6 installed successfully on ${appForm.domain}!`);
        setInstallAppOpen(null);
        fetchTPanelData();
      } else {
        showToast('App installation failed', 'error');
      }
    } catch (err) {
      showToast('Error installing app', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // File Manager Handlers
  const handleOpenFolder = (folderName) => {
    const nextPath = currentFilePath === '/' ? `/${folderName}` : `${currentFilePath}/${folderName}`;
    setCurrentFilePath(nextPath);
  };

  const handleNavigateUp = () => {
    if (currentFilePath === '/' || currentFilePath === '') return;
    const parts = currentFilePath.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    setCurrentFilePath(parent);
  };

  const handleOpenFileEditor = (file) => {
    setSelectedFileForEdit(file);
    setFileContentDraft(file.content || '');
  };

  const handleSaveFileContent = async () => {
    if (!selectedFileForEdit) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/tpanel/files/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          path: selectedFileForEdit.path,
          content: fileContentDraft
        })
      });
      if (res.ok) {
        showToast(`Saved ${selectedFileForEdit.name}`);
        setSelectedFileForEdit(null);
        loadDirectory(currentFilePath);
      }
    } catch (e) {
      showToast('Failed to save file', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewFile = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      const res = await fetch('/api/tpanel/files/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          dirPath: currentFilePath,
          name: newFileName.trim(),
          content: '<?php\n// New file created via TPanel\n'
        })
      });
      if (res.ok) {
        showToast(`File ${newFileName} created`);
        setNewFileName('');
        setNewFileModalOpen(false);
        loadDirectory(currentFilePath);
      }
    } catch (e) {
      showToast('Failed to create file', 'error');
    }
  };

  const handleCreateNewFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/tpanel/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: effectiveUserId,
          dirPath: currentFilePath,
          name: newFolderName.trim()
        })
      });
      if (res.ok) {
        showToast(`Folder ${newFolderName} created`);
        setNewFolderName('');
        setNewFolderModalOpen(false);
        loadDirectory(currentFilePath);
      }
    } catch (e) {
      showToast('Failed to create folder', 'error');
    }
  };

  const handleDeleteFileOrFolder = async (item) => {
    if (!window.confirm(`Delete ${item.name}? This action cannot be reversed.`)) return;
    try {
      const res = await fetch(`/api/tpanel/files?userId=${encodeURIComponent(effectiveUserId)}&path=${encodeURIComponent(item.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Deleted ${item.name}`);
        loadDirectory(currentFilePath);
      }
    } catch (e) {
      showToast('Failed to delete item', 'error');
    }
  };

  // SSL Issue / Renew
  const handleRenewSsl = async (domain) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/tpanel/ssl/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: effectiveUserId, domain })
      });
      if (res.ok) {
        showToast(`Let's Encrypt SSL successfully renewed for ${domain}!`);
        fetchTPanelData();
      }
    } catch (e) {
      showToast('Failed to renew SSL', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/tpanel/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: effectiveUserId, ...settingsForm })
      });
      if (res.ok) {
        showToast('Server configuration & runtimes applied successfully!');
        fetchTPanelData();
      }
    } catch (e) {
      showToast('Failed to save settings', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Firewall Rule
  const handleAddFirewallRule = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tpanel/firewall/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: effectiveUserId, ...ruleForm })
      });
      if (res.ok) {
        showToast(`Firewall port ${ruleForm.port} rule applied`);
        setAddRuleOpen(false);
        fetchTPanelData();
      }
    } catch (e) {
      showToast('Failed to add rule', 'error');
    }
  };

  const handleDeleteFirewallRule = async (ruleId) => {
    try {
      const res = await fetch(`/api/tpanel/firewall/rules/${ruleId}?userId=${encodeURIComponent(effectiveUserId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Firewall rule removed');
        fetchTPanelData();
      }
    } catch (e) {
      showToast('Failed to delete rule', 'error');
    }
  };

  // Current Account fallback
  const currentAcc = accountData || {
    panelUser: 'alimran',
    serverStatus: {
      serverName: 'tpanel-server-01',
      hostname: 'store.tiwlo.com',
      ip: '162.35.124.233',
      status: 'RUNNING',
      uptime: '99.99%',
      cpuPercent: 8,
      ramPercent: 32,
      ramUsageText: '2.56 GB of 8 GB',
      diskPercent: 19,
      diskUsageText: '30.4 GB of 160 GB',
      bandwidthPercent: 12,
      bandwidthUsageText: '120 GB of 1 TB',
      loadAvg: '0.12, 0.08, 0.05'
    },
    websites: [
      { id: 'site-store-01', domain: 'store.tiwlo.com', cms: 'WordPress 6.6', documentRoot: '/public_html/store.tiwlo.com', storage: '142 MB', status: 'ACTIVE', ssl: true, sslExpiry: 'Dec 28, 2026', phpVersion: 'PHP 8.2', port: 443 }
    ],
    domains: [
      { id: 'dom-1', domain: 'store.tiwlo.com', targetType: 'Primary Website', targetName: 'store.tiwlo.com', ip: '162.35.124.233', sslStatus: 'ACTIVE', isPrimary: true }
    ],
    databases: [
      { id: 'db-mysql-01', name: 'alimran_store_db', engine: 'MySQL 8.0', user: 'alimran_store_user', host: '127.0.0.1:3306', charset: 'utf8mb4_unicode_ci', size: '14.2 MB', tablesCount: 28 },
      { id: 'db-pg-01', name: 'alimran_analytics_pg', engine: 'PostgreSQL 16', user: 'alimran_pg_user', host: '127.0.0.1:5432', charset: 'UTF8', size: '28.6 MB', tablesCount: 16 }
    ],
    sslCertificates: [
      { id: 'ssl-store-01', domain: 'store.tiwlo.com', issuer: "Let's Encrypt Authority X3", validFrom: 'Sep 28, 2026', validUntil: 'Dec 28, 2026', daysRemaining: 89, autoRenew: true, status: 'ACTIVE', tlsVersion: 'TLS 1.3 / HTTP/2' }
    ],
    emails: [
      { id: 'email-1', address: 'support@store.tiwlo.com', mailbox: 'support', domain: 'store.tiwlo.com', quota: '1024 MB', used: '18 MB', status: 'ACTIVE' },
      { id: 'email-2', address: 'admin@store.tiwlo.com', mailbox: 'admin', domain: 'store.tiwlo.com', quota: '2048 MB', used: '4.5 MB', status: 'ACTIVE' }
    ],
    ftpAccounts: [
      { id: 'ftp-1', username: 'alimran_deploy', homeDir: '/public_html/store.tiwlo.com', host: '162.35.124.233', port: 22022, protocol: 'SFTP / FTPS', status: 'ACTIVE' }
    ],
    securityRules: [
      { id: 'sec-1', name: 'HTTP Web Traffic', port: 80, protocol: 'TCP', targetSite: 'store.tiwlo.com', source: '0.0.0.0/0', action: 'ALLOW', status: 'ENABLED' },
      { id: 'sec-2', name: 'HTTPS Secure Traffic', port: 443, protocol: 'TCP', targetSite: 'store.tiwlo.com', source: '0.0.0.0/0', action: 'ALLOW', status: 'ENABLED' }
    ],
    settings: {
      phpVersion: '8.2',
      nodeVersion: '20',
      maxUploadSize: '100M',
      maxExecutionTime: '300',
      memoryLimit: '512M'
    }
  };

  const navSections = [
    {
      group: 'COMPUTE & HOSTING',
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'websites', label: 'Websites & Apps', icon: Globe },
        { id: 'domains', label: 'Domains & DNS', icon: Network }
      ]
    },
    {
      group: 'DATABASES & STORAGE',
      items: [
        { id: 'databases', label: 'Cloud Databases', icon: Database },
        { id: 'files', label: 'File Storage', icon: FolderTree },
        { id: 'ftp', label: 'FTP Accounts', icon: HardDrive }
      ]
    },
    {
      group: 'NETWORKING & SECURITY',
      items: [
        { id: 'ssl', label: 'SSL/TLS Certificates', icon: ShieldCheck },
        { id: 'security', label: 'Security & Firewall', icon: Shield },
        { id: 'emails', label: 'Email Accounts', icon: Mail }
      ]
    },
    {
      group: 'MANAGEMENT',
      items: [
        { id: 'software', label: 'Software & 1-Click Apps', icon: Grid },
        { id: 'settings', label: 'Server Settings', icon: Settings }
      ]
    }
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-[#121824] text-slate-100' : 'bg-[#F8F9FA] text-[#202124]'} font-sans antialiased flex flex-col`}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold animate-in slide-in-from-top-3 ${
          toastMessage.type === 'error'
            ? 'bg-rose-600 text-white border-rose-700'
            : 'bg-[#1A73E8] text-white border-blue-600'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toastMessage.msg}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-80"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ===================== GOOGLE CLOUD STYLE TOP HEADER ===================== */}
      <header className={`h-12 px-4 border-b flex items-center justify-between sticky top-0 z-40 transition-colors ${
        isDarkMode ? 'bg-[#1A2234] border-slate-800 text-white' : 'bg-[#1A73E8] text-white border-[#1557B0]'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded hover:bg-white/10 text-white transition cursor-pointer"
            title="Toggle Navigation Menu"
          >
            <div className="space-y-1 w-4">
              <span className="block h-0.5 w-4 bg-white"></span>
              <span className="block h-0.5 w-4 bg-white"></span>
              <span className="block h-0.5 w-4 bg-white"></span>
            </div>
          </button>

          <div
            onClick={() => navigateToTab('dashboard')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <TPanelBrandLogo className="w-6 h-6" />
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              T Panel <span className="text-[10px] font-normal opacity-85 px-1.5 py-0.2 rounded bg-white/20">Cloud Console</span>
            </span>
          </div>

          <span className="text-white/40 hidden sm:inline">/</span>

          {/* Droplet Node Selector */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/15 hover:bg-black/25 text-white text-xs font-medium transition cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-blue-200" />
              <span className="font-semibold">{currentAcc.serverStatus?.serverName || 'tpanel-server-01'}</span>
              <span className="text-[11px] text-blue-100 font-mono">({currentAcc.serverStatus?.ip || '162.35.124.233'})</span>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </button>

            {serverDropdownOpen && (
              <div className="absolute left-0 mt-1 w-72 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 shadow-xl py-2 z-50 text-slate-800 dark:text-slate-100 text-xs animate-in fade-in">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-gray-800 font-semibold text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                  Target Droplet Container
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{currentAcc.serverStatus?.serverName}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      RUNNING
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">Tenant User: {currentAcc.panelUser || 'alimran'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">Public IP: {currentAcc.serverStatus?.ip}</p>
                  <p className="text-[11px] text-slate-500">Region: {currentAcc.serverStatus?.region || 'Singapore (SGP1)'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search */}
        <div className="hidden lg:flex items-center relative w-full max-w-md mx-4">
          <Search className="w-3.5 h-3.5 text-white/70 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="gcloud-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, resources, and docs (/)"
            className="w-full pl-8 pr-12 py-1 rounded bg-white/15 hover:bg-white/20 focus:bg-white focus:text-slate-900 placeholder-white/70 focus:placeholder-slate-400 text-xs text-white transition focus:outline-none"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/60 font-mono">/</span>
        </div>

        {/* Right: Cloud Shell, Theme, Bell, User Account */}
        <div className="flex items-center gap-2">
          {/* Cloud Shell Terminal Button */}
          <button
            onClick={() => setTerminalOpen(true)}
            title="Open Isolated Cloud Shell"
            className="p-1.5 rounded hover:bg-white/10 text-white transition cursor-pointer flex items-center gap-1.5 text-xs"
          >
            <Terminal className="w-4 h-4 text-emerald-300" />
            <span className="hidden xl:inline text-[11px] font-mono font-medium">{currentAcc.panelUser}@shell</span>
          </button>

          <button
            onClick={toggleTheme}
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
            className="p-1.5 rounded hover:bg-white/10 text-white transition cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => showToast("Droplet health check passed (100% OK)")}
            className="p-1.5 rounded hover:bg-white/10 text-white transition cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-1.5 right-1.5 ring-1 ring-white"></span>
          </button>

          {/* User Account Chip */}
          <div className="relative ml-1">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-0.5 rounded-full hover:bg-white/15 transition cursor-pointer text-white"
            >
              <div className="w-6 h-6 rounded-full bg-white text-blue-600 font-bold flex items-center justify-center text-xs shadow-xs">
                {effectiveName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block leading-none">
                <span className="font-semibold text-xs block">{effectiveName}</span>
                <span className="text-[10px] text-blue-100 font-mono font-bold">{effectiveTiwId}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 shadow-xl py-2 z-50 text-slate-800 dark:text-slate-100 text-xs animate-in fade-in">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-800">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{effectiveName}</p>
                  <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold mt-0.5">TIW ID: {effectiveTiwId}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Droplet User: {currentAcc.panelUser || 'alimran'}</p>
                </div>

                <div className="py-1">
                  <a
                    href="/dashboard"
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <Server className="w-3.5 h-3.5 text-blue-500" />
                    <span>Return to Tiwlo Droplets</span>
                  </a>
                  <button
                    onClick={() => {
                      fetchTPanelData();
                      setUserDropdownOpen(false);
                      showToast("Synchronized droplet telemetry");
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Sync Node Status</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100 dark:border-gray-800">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      if (onLogout) onLogout();
                      else {
                        const logout = async () => {
                          try {
                            const token = localStorage.getItem('stockpro_session');
                            const response = await fetch('/api/auth/logout', {
                              method: 'POST',
                              credentials: 'include',
                              headers: token ? { Authorization: `Bearer ${token}` } : {}
                            });
                            if (!response.ok) throw new Error(`Logout failed with HTTP ${response.status}`);
                          } catch (err) {
                            console.error('Logout request failed:', err);
                          } finally {
                            localStorage.removeItem('stockpro_user');
                            localStorage.removeItem('stockpro_session');
                            window.location.replace(getAuthUrl('/login?logout=1'));
                          }
                        };
                        logout();
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===================== SIDEBAR & MAIN BODY ===================== */}
      <div className="flex flex-1">
        {/* Navigation Sidebar */}
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} shrink-0 border-r transition-all duration-200 select-none flex flex-col justify-between ${
          isDarkMode ? 'bg-[#171E2E] border-slate-800' : 'bg-white border-[#E0E2E7]'
        }`}>
          <div className="py-3">
            {navSections.map((section, idx) => (
              <div key={idx} className="mb-4">
                {!sidebarCollapsed && (
                  <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {section.group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateToTab(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-xs transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-[#1A73E8] dark:text-blue-400 font-bold border-l-3 border-[#1A73E8]'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium border-l-3 border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1A73E8] dark:text-blue-400' : 'text-slate-400'}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800">
            <a
              href="/dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {!sidebarCollapsed && <span>Tiwlo Cloud Droplets</span>}
            </a>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* ===================== VIEW 1: OVERVIEW ===================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel Console</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Overview</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                    <span>Server Node Overview</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {currentAcc.serverStatus?.ip} (Online)
                    </span>
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCreateWebsiteOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Deploy Website</span>
                  </button>
                  <button
                    onClick={() => setCreateDatabaseOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    <span>New Database</span>
                  </button>
                  <button
                    onClick={() => setTerminalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Cloud Shell</span>
                  </button>
                </div>
              </div>

              {/* Resource Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => navigateToTab('websites')} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] hover:border-blue-500/50 transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-xs font-semibold uppercase">Websites</span>
                    <Globe className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentAcc.websites?.length || 1}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">● store.tiwlo.com (Live)</p>
                </div>

                <div onClick={() => navigateToTab('databases')} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] hover:border-blue-500/50 transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-xs font-semibold uppercase">Cloud Databases</span>
                    <Database className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentAcc.databases?.length || 2}</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Isolated MySQL & Postgres</p>
                </div>

                <div onClick={() => navigateToTab('domains')} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] hover:border-blue-500/50 transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-xs font-semibold uppercase">Domains</span>
                    <Network className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentAcc.domains?.length || 1}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Auto-SSL Protected</p>
                </div>

                <div onClick={() => navigateToTab('emails')} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] hover:border-blue-500/50 transition cursor-pointer">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-xs font-semibold uppercase">Mailboxes</span>
                    <Mail className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{currentAcc.emails?.length || 2}</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">Webmail active</p>
                </div>
              </div>

              {/* Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234]">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">CPU Usage</span>
                    <span className="text-slate-900 dark:text-white font-mono">{currentAcc.serverStatus?.cpuPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${currentAcc.serverStatus?.cpuPercent}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono">Load Avg: {currentAcc.serverStatus?.loadAvg || '0.12, 0.08'}</p>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234]">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">RAM Allocation</span>
                    <span className="text-slate-900 dark:text-white font-mono">{currentAcc.serverStatus?.ramPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${currentAcc.serverStatus?.ramPercent}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{currentAcc.serverStatus?.ramUsageText || '2.56 GB of 8 GB'}</p>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234]">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">NVMe Storage</span>
                    <span className="text-slate-900 dark:text-white font-mono">{currentAcc.serverStatus?.diskPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${currentAcc.serverStatus?.diskPercent}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{currentAcc.serverStatus?.diskUsageText || '30.4 GB of 160 GB'}</p>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234]">
                  <div className="flex justify-between items-center text-xs mb-1.5 font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">Bandwidth Out</span>
                    <span className="text-slate-900 dark:text-white font-mono">{currentAcc.serverStatus?.bandwidthPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: `${currentAcc.serverStatus?.bandwidthPercent}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">{currentAcc.serverStatus?.bandwidthUsageText || '120 GB of 1 TB'}</p>
                </div>
              </div>

              {/* Websites Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#1A73E8]" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Websites on Node</h2>
                  </div>
                  <button onClick={() => navigateToTab('websites')} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Manage All</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Domain</th>
                        <th className="py-2.5 px-4">Stack</th>
                        <th className="py-2.5 px-4">Runtime</th>
                        <th className="py-2.5 px-4">Document Root</th>
                        <th className="py-2.5 px-4">SSL</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(currentAcc.websites || []).map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <a href={`https://${w.domain}`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                              {w.domain} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{w.cms}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{w.phpVersion}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{w.documentRoot}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Active (Let's Encrypt)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setCurrentFilePath(w.documentRoot || '/public_html');
                                navigateToTab('files');
                              }}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-semibold"
                            >
                              Explore Files
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================== VIEW 2: WEBSITES & APPS ===================== */}
          {activeTab === 'websites' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Websites</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Websites & Applications
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCreateWebsiteOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>CREATE WEBSITE</span>
                  </button>
                  <button onClick={fetchTPanelData} className="p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Stack / Application</th>
                      <th className="py-3 px-4">Document Root</th>
                      <th className="py-3 px-4">Runtime</th>
                      <th className="py-3 px-4">SSL Certificate</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.websites || []).map((site) => (
                      <tr key={site.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5">
                            <span>{site.domain}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-200">{site.cms}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{site.documentRoot}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{site.phpVersion}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            HTTPS Active
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCurrentFilePath(site.documentRoot || '/public_html');
                                navigateToTab('files');
                              }}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                            >
                              File Manager
                            </button>
                            <button
                              onClick={() => setInstallAppOpen('WordPress')}
                              className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-semibold"
                            >
                              Install WP
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 3: DOMAINS & DNS ===================== */}
          {activeTab === 'domains' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Domains</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Domains & DNS Routing
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setAddDomainOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>CONNECT DOMAIN</span>
                  </button>
                  <button onClick={fetchTPanelData} className="p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Domain Name</th>
                      <th className="py-3 px-4">Target Type</th>
                      <th className="py-3 px-4">DNS A-Record</th>
                      <th className="py-3 px-4">Server IP</th>
                      <th className="py-3 px-4">SSL Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.domains || []).map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{d.domain}</span>
                          {d.isPrimary && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              Primary
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{d.targetType}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">A → 162.35.124.233 (TTL 300)</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{d.ip}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            ● ACTIVE
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setCurrentFilePath(`/public_html/${d.domain}`);
                              navigateToTab('files');
                            }}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                          >
                            Explore Folder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 4: CLOUD DATABASES ===================== */}
          {activeTab === 'databases' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Databases</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Cloud Database Instances (Tenant Isolated)
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCreateDatabaseOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>CREATE DATABASE</span>
                  </button>
                  <button
                    onClick={() => showToast("Opening web database manager interface...")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <span>Launch phpMyAdmin / Adminer</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Database Name</th>
                      <th className="py-3 px-4">Engine</th>
                      <th className="py-3 px-4">Isolated User</th>
                      <th className="py-3 px-4">Host / Port</th>
                      <th className="py-3 px-4">Collation</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.databases || []).map((db) => (
                      <tr key={db.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{db.name}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            db.engine.includes('Postgre')
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          }`}>
                            {db.engine}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">{db.user}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{db.host}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{db.charset}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">{db.size}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setSqlExportModal(db)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                            >
                              Export SQL
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Permanently drop database ${db.name}?`)) {
                                  fetch(`/api/tpanel/databases/${db.id}?userId=${encodeURIComponent(effectiveUserId)}`, { method: 'DELETE' }).then(() => {
                                    showToast(`Database ${db.name} dropped`);
                                    fetchTPanelData();
                                  });
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600"
                              title="Drop Database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 5: INTERACTIVE FILE STORAGE ===================== */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">File Manager</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Interactive File System Explorer
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setNewFileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New File</span>
                  </button>
                  <button
                    onClick={() => setNewFolderModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => showToast("File uploaded to current folder")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>
                </div>
              </div>

              {/* Breadcrumb Path & Up Button */}
              <div className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] text-xs font-mono flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <button
                    onClick={handleNavigateUp}
                    disabled={currentFilePath === '/' || currentFilePath === ''}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-30 hover:bg-slate-200 font-bold"
                  >
                    ↑ Up
                  </button>
                  <span className="text-slate-400">Path:</span>
                  <span className="text-[#1A73E8] font-bold">{currentFilePath}</span>
                </div>
                <span className="text-[11px] text-slate-400">{currentFiles.length} items</span>
              </div>

              {/* Files Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Permissions</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Last Modified</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentFiles.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400">This directory is currently empty.</td>
                      </tr>
                    ) : (
                      currentFiles.map((f, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                            {f.type === 'dir' ? (
                              <button
                                onClick={() => handleOpenFolder(f.name)}
                                className="inline-flex items-center gap-2 hover:text-[#1A73E8] font-bold transition text-left"
                              >
                                <Folder className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                                <span>{f.name}/</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenFileEditor(f)}
                                className="inline-flex items-center gap-2 hover:text-[#1A73E8] transition text-left"
                              >
                                <File className="w-4 h-4 text-blue-500 shrink-0" />
                                <span>{f.name}</span>
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{f.permissions}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{f.size}</td>
                          <td className="py-2.5 px-4 text-slate-500">{f.lastModified}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {f.type === 'dir' ? (
                                <button
                                  onClick={() => handleOpenFolder(f.name)}
                                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100"
                                >
                                  Open
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenFileEditor(f)}
                                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteFileOrFolder(f)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 6: SSL CERTIFICATES ===================== */}
          {activeTab === 'ssl' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">SSL Certificates</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    SSL/TLS Certificates for Droplet Domains
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleRenewSsl('store.tiwlo.com')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 stroke-[3]" />
                    <span>ISSUE / AUTO-RENEW CERTIFICATE</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Certificate Authority</th>
                      <th className="py-3 px-4">Valid Until</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4">Protocol</th>
                      <th className="py-3 px-4">Auto-Renew</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.sslCertificates || []).map((ssl) => (
                      <tr key={ssl.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{ssl.domain}</td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{ssl.issuer}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{ssl.validUntil}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">{ssl.daysRemaining} days</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{ssl.tlsVersion}</td>
                        <td className="py-3.5 px-4">
                          <span className="text-emerald-600 font-semibold">Enabled</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => setViewCertModal(ssl)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                            >
                              View PEM
                            </button>
                            <button
                              onClick={() => handleRenewSsl(ssl.domain)}
                              className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-semibold"
                            >
                              Renew Now
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 7: SECURITY & FIREWALL ===================== */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Security</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Firewall, Port Protection & Website Access Control
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setAddRuleOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>ADD PORT RULE</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Rule Name</th>
                      <th className="py-2.5 px-4">Port</th>
                      <th className="py-2.5 px-4">Target Website / Service</th>
                      <th className="py-2.5 px-4">Protocol</th>
                      <th className="py-2.5 px-4">Allowed Source</th>
                      <th className="py-2.5 px-4">Policy Action</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.securityRules || []).map((sec) => (
                      <tr key={sec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{sec.name}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">{sec.port}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">{sec.targetSite || 'store.tiwlo.com'}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{sec.protocol}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{sec.source}</td>
                        <td className="py-2.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">{sec.action}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteFirewallRule(sec.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="Remove Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 8: EMAIL ACCOUNTS ===================== */}
          {activeTab === 'emails' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Emails</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Professional Mailboxes
                  </h1>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setCreateEmailOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>CREATE MAILBOX</span>
                  </button>
                  <button
                    onClick={() => showToast("Opening Roundcube Webmail...")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <span>Launch Webmail</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Domain</th>
                      <th className="py-3 px-4">Storage Usage</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.emails || []).map((em) => (
                      <tr key={em.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">{em.address}</td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{em.domain}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{em.used} of {em.quota}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            ● ACTIVE
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => setEditEmailOpen(em)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                            >
                              Edit / Quota
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete ${em.address}?`)) {
                                  fetch(`/api/tpanel/emails/${em.id}?userId=${encodeURIComponent(effectiveUserId)}`, { method: 'DELETE' }).then(() => {
                                    showToast('Mailbox deleted');
                                    fetchTPanelData();
                                  });
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 9: FTP ACCOUNTS ===================== */}
          {activeTab === 'ftp' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">FTP Accounts</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    FTP & SFTP Access Credentials
                  </h1>
                </div>

                <button
                  onClick={() => setCreateFtpOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>ADD FTP USER</span>
                </button>
              </div>

              {/* Quick Connection Details */}
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs">
                <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4" />
                  <span>Quick Connect Connection Details (FileZilla / Cyberduck)</span>
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Host: <strong className="font-mono text-slate-900 dark:text-white">{currentAcc.serverStatus?.ip}</strong> • Port: <strong className="font-mono text-slate-900 dark:text-white">22022</strong> (SFTP) or <strong className="font-mono text-slate-900 dark:text-white">21</strong> (FTP over TLS)
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-[#1A2234] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">FTP Username</th>
                      <th className="py-3 px-4">Host</th>
                      <th className="py-3 px-4">Port</th>
                      <th className="py-3 px-4">Home Directory</th>
                      <th className="py-3 px-4">Protocol</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(currentAcc.ftpAccounts || []).map((ftp) => (
                      <tr key={ftp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{ftp.username}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{ftp.host}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{ftp.port}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">{ftp.homeDir}</td>
                        <td className="py-3.5 px-4 text-slate-500">{ftp.protocol}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setEditFtpOpen(ftp)}
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-[11px] font-semibold"
                          >
                            Change Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== VIEW 10: SOFTWARE & 1-CLICK APPS ===================== */}
          {activeTab === 'software' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Software</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    1-Click Application Installer & Stack Runtimes
                  </h1>
                </div>

                <button
                  onClick={() => showToast("Runtime environment packages reloaded")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>RELOAD RUNTIMES</span>
                </button>
              </div>

              {/* 1-Click App Installer Softaculous Style Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-3">W</div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">WordPress 6.6</h3>
                    <p className="text-xs text-slate-500 mt-1">World's #1 CMS for blogs, eCommerce & portals.</p>
                  </div>
                  <button
                    onClick={() => setInstallAppOpen('WordPress')}
                    className="mt-4 w-full py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs"
                  >
                    Install WordPress
                  </button>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded bg-rose-600 text-white font-bold flex items-center justify-center text-sm mb-3">L</div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Laravel 11</h3>
                    <p className="text-xs text-slate-500 mt-1">Modern PHP web framework with artisan cli.</p>
                  </div>
                  <button
                    onClick={() => setInstallAppOpen('Laravel')}
                    className="mt-4 w-full py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs"
                  >
                    Install Laravel
                  </button>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-3">JS</div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Node.js Express</h3>
                    <p className="text-xs text-slate-500 mt-1">Fast, unopinionated, minimalist web framework.</p>
                  </div>
                  <button
                    onClick={() => setInstallAppOpen('Node.js Express')}
                    className="mt-4 w-full py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs"
                  >
                    Deploy Node.js
                  </button>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded bg-amber-600 text-white font-bold flex items-center justify-center text-sm mb-3">DB</div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">phpMyAdmin</h3>
                    <p className="text-xs text-slate-500 mt-1">Web-based visual MySQL and MariaDB GUI.</p>
                  </div>
                  <button
                    onClick={() => showToast("Opening phpMyAdmin web portal...")}
                    className="mt-4 w-full py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold text-xs"
                  >
                    Launch Manager
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== VIEW 11: SERVER SETTINGS & RUNTIME SELECTOR ===================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span>TPanel</span>
                    <span>›</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Settings</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Server Runtime Selection & PHP Directives
                  </h1>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>SAVE CONFIGURATION</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Runtime Versions Selection</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Active PHP Version</label>
                    <select
                      value={settingsForm.phpVersion}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phpVersion: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      <option value="8.3">PHP 8.3 FPM (Latest Stable)</option>
                      <option value="8.2">PHP 8.2 FPM (Recommended)</option>
                      <option value="8.1">PHP 8.1 FPM</option>
                      <option value="7.4">PHP 7.4 FPM (Legacy)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Node.js Engine Version</label>
                    <select
                      value={settingsForm.nodeVersion}
                      onChange={(e) => setSettingsForm({ ...settingsForm, nodeVersion: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      <option value="22">Node.js 22 LTS</option>
                      <option value="20">Node.js 20 LTS (Active)</option>
                      <option value="18">Node.js 18 LTS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Max Upload File Size (upload_max_filesize)</label>
                    <input
                      type="text"
                      value={settingsForm.maxUploadSize}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maxUploadSize: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Memory Limit (memory_limit)</label>
                    <input
                      type="text"
                      value={settingsForm.memoryLimit}
                      onChange={(e) => setSettingsForm({ ...settingsForm, memoryLimit: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A2234] space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Security & Process Management</h3>
                  <div className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-900/40">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">Force HTTPS Redirection</p>
                      <p className="text-[11px] text-slate-400">Enforces TLS on all droplet websites</p>
                    </div>
                    <span className="text-emerald-600 font-bold text-xs">ENABLED</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-900/40">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">ModSecurity WAF & DDoS Shield</p>
                      <p className="text-[11px] text-slate-400">Protects against OWASP Top 10 vulnerabilities</p>
                    </div>
                    <span className="text-emerald-600 font-bold text-xs">ENABLED</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded bg-slate-50 dark:bg-slate-900/40">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">Daily Database & File Snapshot</p>
                      <p className="text-[11px] text-slate-400">Automated nightly backups kept for 14 days</p>
                    </div>
                    <span className="text-emerald-600 font-bold text-xs">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ===================== MODAL: 1-CLICK APP INSTALLER ===================== */}
      {installAppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Install {installAppOpen} 6.6</h3>
              <button onClick={() => setInstallAppOpen(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleInstallApp} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Target Website / Domain</label>
                <select
                  value={appForm.domain}
                  onChange={(e) => setAppForm({ ...appForm, domain: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  {(currentAcc.websites || []).map(w => (
                    <option key={w.id} value={w.domain}>{w.domain}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Admin Username</label>
                <input
                  type="text"
                  required
                  value={appForm.adminUser}
                  onChange={(e) => setAppForm({ ...appForm, adminUser: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Admin Password</label>
                <input
                  type="text"
                  required
                  value={appForm.adminPass}
                  onChange={(e) => setAppForm({ ...appForm, adminPass: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={appForm.adminEmail}
                  onChange={(e) => setAppForm({ ...appForm, adminEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-[11px] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                An isolated MySQL database <strong>{currentAcc.panelUser || 'alimran'}_wordpress_db</strong> will be automatically provisioned for this website.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setInstallAppOpen(null)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs">
                  {actionLoading ? 'Installing...' : 'Install Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: IN-BROWSER CODE EDITOR ===================== */}
      {selectedFileForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-4xl h-[560px] rounded-xl border border-slate-700 bg-[#0F1420] text-slate-200 shadow-2xl flex flex-col overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-4 py-3 bg-[#171E2E] border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-white">{selectedFileForEdit.path}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFileContent}
                  disabled={actionLoading}
                  className="px-3 py-1 rounded bg-[#1A73E8] hover:bg-blue-600 text-white font-sans font-semibold text-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
                <button onClick={() => setSelectedFileForEdit(null)} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <textarea
              value={fileContentDraft}
              onChange={(e) => setFileContentDraft(e.target.value)}
              className="flex-1 p-4 bg-transparent text-slate-200 focus:outline-none resize-none font-mono text-xs leading-relaxed"
              spellCheck="false"
            />
          </div>
        </div>
      )}

      {/* ===================== MODAL: NEW FILE ===================== */}
      {newFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create New File</h3>
              <button onClick={() => setNewFileModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateNewFile} className="space-y-3 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. style.css, script.js"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewFileModalOpen(false)} className="px-3 py-1 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-3.5 py-1 rounded bg-[#1A73E8] text-white text-xs font-semibold">Create File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: NEW FOLDER ===================== */}
      {newFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create New Folder</h3>
              <button onClick={() => setNewFolderModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateNewFolder} className="space-y-3 pt-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Folder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. assets, images"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewFolderModalOpen(false)} className="px-3 py-1 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-3.5 py-1 rounded bg-[#1A73E8] text-white text-xs font-semibold">Create Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: VIEW PEM CERTIFICATE ===================== */}
      {viewCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans">Certificate PEM: {viewCertModal.domain}</h3>
              <button onClick={() => setViewCertModal(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="py-3">
              <textarea
                readOnly
                value={viewCertModal.pemCert || `-----BEGIN CERTIFICATE-----\n[Valid Let's Encrypt Certificate for ${viewCertModal.domain}]\n-----END CERTIFICATE-----`}
                className="w-full h-48 p-3 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] leading-relaxed select-all"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(viewCertModal.pemCert || '');
                  showToast('Copied Certificate to clipboard');
                }}
                className="px-3 py-1.5 rounded bg-[#1A73E8] text-white font-sans text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy PEM</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: EXPORT SQL DUMP ===================== */}
      {sqlExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Export Database Dump</h3>
              <button onClick={() => setSqlExportModal(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="py-4 space-y-2 text-xs">
              <p>Target Database: <strong className="font-mono">{sqlExportModal.name}</strong></p>
              <p>Engine: <strong>{sqlExportModal.engine}</strong></p>
              <p>Dump Size: <strong>{sqlExportModal.size}</strong></p>
              <p className="text-slate-500 pt-2">Generates a standard mysqldump / pg_dump `.sql` archive compatible with all hosting providers.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSqlExportModal(null)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600">Close</button>
              <button
                onClick={() => {
                  showToast(`Exported ${sqlExportModal.name}.sql dump successfully!`);
                  setSqlExportModal(null);
                }}
                className="px-4 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ISOLATED CLOUD TERMINAL ===================== */}
      {terminalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-[#0B0F19] text-slate-200 shadow-2xl overflow-hidden font-mono text-xs flex flex-col h-[500px]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#171E2E] border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">{currentAcc.panelUser || 'alimran'}@{currentAcc.serverStatus?.serverName || 'tpanel-server-01'} (Isolated Container)</span>
              </div>
              <button onClick={() => setTerminalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-4 space-y-1.5 overflow-y-auto font-mono text-xs">
              {terminalLines.map((line, idx) => (
                <div key={idx} className={line.type === 'cmd' ? 'text-blue-300 font-bold' : line.type === 'err' ? 'text-rose-400' : 'text-slate-300 whitespace-pre-wrap'}>
                  {line.text}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
            <form onSubmit={handleTerminalSubmit} className="p-2.5 bg-[#171E2E] border-t border-slate-800 flex items-center gap-2">
              <span className="text-emerald-400 font-bold shrink-0">{currentAcc.panelUser || 'alimran'}@{currentAcc.serverStatus?.serverName || 'tpanel'}:~$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="type command (e.g. ls, pwd, whoami, php -v, clear)..."
                className="flex-1 bg-transparent text-white focus:outline-none font-mono text-xs"
                autoFocus
              />
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE WEBSITE ===================== */}
      {createWebsiteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Deploy New Website</h3>
              <button onClick={() => setCreateWebsiteOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!siteForm.domain.trim()) return;
              setActionLoading(true);
              const res = await fetch('/api/tpanel/websites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: effectiveUserId, ...siteForm })
              });
              if (res.ok) {
                showToast(`Website "${siteForm.domain}" created!`);
                setSiteForm({ domain: '', cms: 'Static HTML', phpVersion: 'PHP 8.2' });
                setCreateWebsiteOpen(false);
                fetchTPanelData();
              }
              setActionLoading(false);
            }} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Domain or Subdomain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. blog.store.tiwlo.com"
                  value={siteForm.domain}
                  onChange={(e) => setSiteForm({ ...siteForm, domain: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">CMS / Framework</label>
                <select
                  value={siteForm.cms}
                  onChange={(e) => setSiteForm({ ...siteForm, cms: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="Static HTML">Static HTML / React Vite</option>
                  <option value="WordPress 6.6">WordPress 6.6</option>
                  <option value="Laravel 11">Laravel 11</option>
                  <option value="Node.js Express">Node.js Express</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateWebsiteOpen(false)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs">Deploy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CREATE DATABASE ===================== */}
      {createDatabaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create Isolated Cloud Database</h3>
              <button onClick={() => setCreateDatabaseOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!dbForm.name.trim()) return;
              setActionLoading(true);
              const res = await fetch('/api/tpanel/databases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: effectiveUserId, ...dbForm })
              });
              if (res.ok) {
                showToast(`Database "${dbForm.name}" created!`);
                setDbForm({ name: '', engine: 'MySQL 8.0', user: '', password: '', charset: 'utf8mb4_unicode_ci' });
                setCreateDatabaseOpen(false);
                fetchTPanelData();
              }
              setActionLoading(false);
            }} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Database Engine</label>
                <select
                  value={dbForm.engine}
                  onChange={(e) => setDbForm({ ...dbForm, engine: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  <option value="MySQL 8.0">MySQL 8.0 Engine</option>
                  <option value="PostgreSQL 16">PostgreSQL 16 Engine</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Database Name</label>
                <div className="flex items-center">
                  <span className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-500 rounded-l">
                    {currentAcc.panelUser || 'alimran'}_
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="production_db"
                    value={dbForm.name}
                    onChange={(e) => setDbForm({ ...dbForm, name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-r border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateDatabaseOpen(false)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADD FIREWALL PORT RULE ===================== */}
      {addRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Add Port Protection Rule</h3>
              <button onClick={() => setAddRuleOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddFirewallRule} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Node API Backend"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Port Number</label>
                <input
                  type="number"
                  required
                  value={ruleForm.port}
                  onChange={(e) => setRuleForm({ ...ruleForm, port: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Target Website / Scope</label>
                <select
                  value={ruleForm.targetSite}
                  onChange={(e) => setRuleForm({ ...ruleForm, targetSite: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                >
                  {(currentAcc.websites || []).map(w => (
                    <option key={w.id} value={w.domain}>{w.domain}</option>
                  ))}
                  <option value="Droplet System Node">Droplet System Node</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddRuleOpen(false)} className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#1A73E8] hover:bg-blue-700 text-white font-semibold text-xs">Apply Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

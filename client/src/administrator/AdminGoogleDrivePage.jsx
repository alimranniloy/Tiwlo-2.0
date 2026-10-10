import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileJson2,
  HardDrive,
  LoaderCircle,
  ShieldCheck,
  Upload
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('stockpro_session');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminGoogleDrivePage({ showToast }) {
  const fileInputRef = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [storage, setStorage] = useState({ backend: 'postgres' });
  const [sync, setSync] = useState({ direction: 'idle', status: 'idle', processed_files: 0, failed_files: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const processedFiles = Number(sync.processed_files) || 0;
  const totalFiles = Number(sync.total_files) || 0;
  const progressPercent = totalFiles
    ? Math.min(100, Math.round((processedFiles / totalFiles) * 100))
    : 0;
  const driveQuotaFull = sync.last_error?.toLowerCase().includes('quota');

  const fetchAccounts = async () => {
    const response = await fetch(`${API_BASE}/admin/storage/google-drive`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load saved storage accounts.');
    return result;
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const result = await fetchAccounts();
      setAccounts(result.accounts || []);
      setStorage(result.storage || { backend: 'postgres' });
      setSync(result.sync || { direction: 'idle', status: 'idle', processed_files: 0, failed_files: 0 });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchAccounts()
      .then((result) => {
        if (!mounted) return;
        setAccounts(result.accounts || []);
        setStorage(result.storage || { backend: 'postgres' });
        setSync(result.sync || { direction: 'idle', status: 'idle', processed_files: 0, failed_files: 0 });
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (sync.status !== 'running') return undefined;
    const timer = window.setInterval(() => {
      fetchAccounts()
        .then((result) => {
          setAccounts(result.accounts || []);
          setStorage(result.storage || { backend: 'postgres' });
          setSync(result.sync || { direction: 'idle', status: 'idle', processed_files: 0, failed_files: 0 });
        })
        .catch((statusError) => setError(statusError.message));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [sync.status]);

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Choose a Google service-account JSON file first.');
      return;
    }
    if (selectedFile.size > 64 * 1024) {
      setError('Credential file must be 64 KB or smaller.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const credentials = JSON.parse(await selectedFile.text());
      const response = await fetch(`${API_BASE}/admin/storage/google-drive`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credentials, name: displayName, rootFolderId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save the service-account credentials.');

      setSelectedFile(null);
      setDisplayName('');
      setRootFolderId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast?.('Encrypted Drive credentials saved to PostgreSQL.');
      await loadAccounts();
    } catch (saveError) {
      setError(saveError instanceof SyntaxError
        ? 'The selected file is not valid JSON.'
        : saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const activateAccount = async (accountId) => {
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/storage/google-drive/${encodeURIComponent(accountId)}/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not verify and activate this account.');
      showToast?.('Drive folder verified. New uploads will use Google Drive.');
      await loadAccounts();
    } catch (activateError) {
      setError(activateError.message);
    }
  };

  const syncStorage = async (direction) => {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/admin/storage/sync/${direction}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start media sync.');
      setSync(result.sync);
      showToast?.(direction === 'to_drive'
        ? 'Drive backup and sync started. It resumes after a server restart.'
        : 'Server restore started. Drive copies remain until transfer is verified.');
    } catch (migrationError) {
      setError(migrationError.message);
    } finally {
      setSyncing(false);
      await loadAccounts();
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Storage
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Google Drive
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          Add and verify service accounts, select a Drive folder, and migrate media only after size and SHA-256 verification.
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active media storage</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {storage.backend === 'google_drive'
              ? `Google Drive · ${storage.display_name || storage.client_email || 'Active account'}`
              : storage.backend === 'local' ? 'Server SSD' : 'PostgreSQL'}
          </p>
          {storage.backend === 'google_drive' && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Existing media stays in its current storage until migrated. URL paths are preserved.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Media backup and transfer</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Files keep their upload paths and nested folders. Each copy is verified by size and SHA-256 before the source is removed. An interrupted transfer resumes after server restart.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => syncStorage('to_drive')}
              disabled={syncing || sync.status === 'running' || storage.backend !== 'google_drive'}
              className="min-h-10 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncing && sync.direction === 'to_drive' ? 'Starting…' : 'Sync all to Google Drive'}
            </button>
            <button
              type="button"
              onClick={() => syncStorage('to_server')}
              disabled={syncing || sync.status === 'running' || storage.backend !== 'google_drive'}
              className="min-h-10 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {syncing && sync.direction === 'to_server' ? 'Starting…' : 'Transfer all back to server'}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-950">
          <p className="font-medium text-slate-800 dark:text-slate-200">
            Status: {sync.status} {sync.direction !== 'idle' ? `· ${sync.direction === 'to_drive' ? 'server → Drive' : 'Drive → server'}` : ''}
            {sync.status === 'running' ? ' · resumes automatically after reboot' : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Processed: {processedFiles} / {totalFiles} · Failed: {sync.failed_files || 0}
          </p>
          {(sync.status === 'running' || totalFiles > 0) && (
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              role="progressbar"
              aria-label="Media transfer progress"
              aria-valuemin={0}
              aria-valuemax={totalFiles || 1}
              aria-valuenow={processedFiles}
            >
              <div
                className={`h-full rounded-full bg-blue-600 transition-[width] duration-300 ${totalFiles ? '' : 'w-1/3 animate-pulse'}`}
                style={totalFiles ? { width: `${progressPercent}%` } : undefined}
              />
            </div>
          )}
          {sync.status === 'running' && (
            <p className="mt-2 break-words text-xs text-slate-500 dark:text-slate-400">
              {sync.current_file || (totalFiles ? 'Preparing transfer' : 'Scanning files…')}
            </p>
          )}
          {sync.last_error && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">{sync.last_error}</p>
          )}
          {sync.status === 'failed' && driveQuotaFull && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Free up Google Drive storage or add an account with available quota, then retry. Server media files were kept.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add a service account</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              The JSON is sent securely to the admin API and encrypted in PostgreSQL. It is not copied into the repository.
            </p>
          </div>
        </div>

        <form onSubmit={saveAccount} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300 md:col-span-2">
            Shared root folder ID
            <input
              value={rootFolderId}
              onChange={(event) => setRootFolderId(event.target.value)}
              required
              maxLength={200}
              placeholder="ID from the shared Google Drive folder URL"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
              Share this folder with the service-account email as Editor. Tiwlo stores files only in this folder and its category subfolders.
            </span>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Display name <span className="font-normal text-slate-500">(optional)</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={120}
              placeholder="Use the project ID if left blank"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <div className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>Service-account JSON</span>
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950">
              <FileJson2 className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">
                {selectedFile?.name || 'Select a credential file (max 64 KB)'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Select a service-account JSON file"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] || null);
                  setError('');
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                Browse
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={saving || !selectedFile || !rootFolderId.trim()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? 'Saving securely…' : 'Save account'}
            </button>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4" />
              Private key and credential JSON are encrypted at rest.
            </p>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Saved accounts</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} saved
            </p>
          </div>
          <button
            type="button"
            onClick={loadAccounts}
            disabled={loading}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <HardDrive className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">No Drive accounts saved yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add a service-account JSON above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.map((account) => (
              <li key={account.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{account.display_name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">{account.client_email}</p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-500">
                      Folder: {account.root_folder_id} · Project: {account.project_id} · Added {formatDate(account.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {account.is_active ? (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => activateAccount(account.id)}
                      className="min-h-9 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Verify and use
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

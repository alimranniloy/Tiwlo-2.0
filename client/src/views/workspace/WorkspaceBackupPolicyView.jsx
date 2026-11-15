import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  RotateCw,
  Save,
  ShieldCheck,
} from 'lucide-react';

export default function WorkspaceBackupPolicyView({
  onBack,
  showToast,
}) {
  const [policy, setPolicy] = useState({
    enabled: true,
    frequency: 'daily',
    retentionDays: 30,
    preferredWindowUtc: '02:00',
    includeStoreCatalog: true,
    includeOrdersBilling: true,
    includeTeamAudit: true,
    encryptAtRest: true,
    notifyOnFailure: true,
  });
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState('');

  const loadPolicy = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/account/backup-policy', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load backup policy.');
      if (data.policy) setPolicy((prev) => ({ ...prev, ...data.policy }));
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
    } catch (err) {
      setError(err.message || 'Failed to load automated backup policy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/account/backup-policy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save backup policy.');
      if (data.policy) setPolicy((prev) => ({ ...prev, ...data.policy }));
      showToast?.('Automated backup policy saved.');
    } catch (err) {
      setError(err.message || 'Could not update backup policy.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSnapshotNow = async () => {
    setRunningNow(true);
    setError('');
    try {
      const res = await fetch('/api/user/account/backup-policy/run', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Snapshot creation failed.');
      showToast?.('Encrypted account checkpoint recorded.');
      await loadPolicy();
    } catch (err) {
      setError(err.message || 'Failed to create backup checkpoint.');
    } finally {
      setRunningNow(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Workspace</span>
              <span>/</span>
              <span>Automated Backup Policy</span>
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Automated Backup Policy
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Configure retention schedules, included Workspace scopes, and create verified configuration checkpoints.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunSnapshotNow}
          disabled={runningNow || loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#1ED760] px-4 py-2 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50 cursor-pointer"
        >
          {runningNow ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <DatabaseBackup className="h-3.5 w-3.5" />}
          <span>{runningNow ? 'Creating Checkpoint...' : 'Run Checkpoint Now'}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSave} className="lg:col-span-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-4">
            <div>
              <div className="text-sm font-semibold text-neutral-950 dark:text-white">
                Enable Automated Retention Schedule
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Automatically checkpoint store configuration, team access matrix, and account preferences.
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(policy.enabled)}
              onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))}
              className="h-4 w-4 accent-[#1ED760] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Cadence
              </label>
              <select
                value={policy.frequency}
                onChange={(e) => setPolicy((p) => ({ ...p, frequency: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs outline-none cursor-pointer"
              >
                <option value="hourly">Every 6 Hours</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Retention Window
              </label>
              <select
                value={policy.retentionDays}
                onChange={(e) => setPolicy((p) => ({ ...p, retentionDays: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs outline-none cursor-pointer"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Maintenance Window (UTC)
              </label>
              <input
                type="time"
                value={policy.preferredWindowUtc}
                onChange={(e) => setPolicy((p) => ({ ...p, preferredWindowUtc: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Included Datasets</p>
            {[
              { key: 'includeStoreCatalog', label: 'Storefront settings, domains & products metadata' },
              { key: 'includeOrdersBilling', label: 'Invoices, wallet credits & billing records' },
              { key: 'includeTeamAudit', label: 'Team roles, permissions & security audit ledger' },
              { key: 'notifyOnFailure', label: 'Email alert on failed or skipped backup window' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between rounded-lg border border-neutral-100 dark:border-neutral-800/80 px-3.5 py-2.5 text-xs cursor-pointer">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(policy[item.key])}
                  onChange={(e) => setPolicy((p) => ({ ...p, [item.key]: e.target.checked }))}
                  className="h-4 w-4 accent-[#1ED760] rounded cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200/80 dark:border-neutral-800 pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
              PostgreSQL persisted policy
            </span>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-black hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Backup Policy'}</span>
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-neutral-500" />
            Recorded Checkpoints ({snapshots.length})
          </h2>
          {loading ? (
            <p className="text-xs text-neutral-400">Loading checkpoints...</p>
          ) : snapshots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-8 text-center text-xs text-neutral-500">
              No manual or scheduled checkpoints created yet. Click &ldquo;Run Checkpoint Now&rdquo; to record one.
            </div>
          ) : (
            <ul className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {snapshots.map((snap) => (
                <li key={snap.id} className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Archive className="h-3.5 w-3.5 text-[#1ED760]" />
                      {snap.id}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#1ED760]" />
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" /> {snap.scopeSummary || 'Account state checkpoint'}</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 tabular-nums">
                    {snap.createdAt ? new Date(snap.createdAt).toLocaleString() : '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  RotateCw,
  ShieldCheck,
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';
import { getCloudBillingData } from '../../dashboards/cloud/graphql/cloudQueries';

const EXPORT_SCOPES = [
  { id: 'profile', label: 'Account Profile & Preferences', detail: 'User identity details, country, notification rules, and sessions metadata' },
  { id: 'team', label: 'Team & Staff Access Matrix', detail: 'Team members, assigned roles, granular permissions, and audit log' },
  { id: 'activity', label: 'Login Locations & Security Log', detail: 'Authenticated logins, IP history, and security changes' },
  { id: 'workspace', label: 'Active Workspace Services & Stores', detail: 'Connected stores, Marketplace services, and operations ledger' },
  { id: 'billing', label: 'Cloud Wallet & Invoices', detail: 'Wallet credit balance, invoice records, and payment gateway status' },
];

export default function WorkspaceDataExportView({
  currentUser,
  onBack,
  showToast,
}) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [selectedScopes, setSelectedScopes] = useState(['profile', 'team', 'activity', 'workspace', 'billing']);
  const [format, setFormat] = useState('json');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastExportSummary, setLastExportSummary] = useState(null);

  const toggleScope = (id) => {
    setSelectedScopes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const buildCsvRows = (bundle) => {
    const lines = ['section,key_or_id,summary,status_or_detail,timestamp'];
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    if (bundle.profile) {
      lines.push([
        'profile',
        bundle.profile.tiwiId || bundle.profile.id || '',
        bundle.profile.email || '',
        `${bundle.profile.name || ''} (${bundle.profile.country || ''})`,
        bundle.exportedAt,
      ].map(escapeCsv).join(','));
    }
    for (const m of bundle.teamMembers || []) {
      lines.push(['team_member', m.id || m.email, m.name || '', `${m.role || ''} · ${m.status || ''}`, m.invitedAt || ''].map(escapeCsv).join(','));
    }
    for (const log of bundle.activityLog || []) {
      lines.push(['activity', log.id || '', log.action || log.type || '', `${log.ip || ''} ${log.location || ''}`.trim(), log.createdAt || log.timestamp || ''].map(escapeCsv).join(','));
    }
    for (const svc of bundle.workspaceServices || []) {
      lines.push(['workspace_service', svc.id || '', svc.name || '', `${svc.workspaceItemType || ''} · ${svc.status || ''}`, svc.createdAt || ''].map(escapeCsv).join(','));
    }
    for (const inv of bundle.invoices || []) {
      lines.push(['invoice', inv.id || '', inv.description || '', `${inv.currency || 'USD'} ${inv.amount ?? 0} (${inv.status || ''})`, inv.createdAt || ''].map(escapeCsv).join(','));
    }
    return lines.join('\n');
  };

  const handleExport = async () => {
    if (!selectedScopes.length) {
      setError('Select at least one data section to export.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      const bundle = {
        exportedAt: new Date().toISOString(),
        accountId: userId,
        email: currentUser?.email || '',
      };

      const tasks = [];
      if (selectedScopes.includes('profile')) {
        tasks.push(
          fetch('/api/user/account', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : {}))
            .then((d) => { bundle.profile = d.account || d; })
        );
      }
      if (selectedScopes.includes('team')) {
        tasks.push(
          fetch('/api/user/account/team-staff', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : {}))
            .then((d) => {
              bundle.teamMembers = d.members || [];
              bundle.teamAuditLogs = d.auditLogs || [];
            })
        );
      }
      if (selectedScopes.includes('activity')) {
        tasks.push(
          fetch('/api/user/account/activity-log', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : {}))
            .then((d) => { bundle.activityLog = d.logs || []; })
        );
      }
      if (selectedScopes.includes('workspace')) {
        tasks.push(
          WorkspaceAPI.getWorkspace().then((ws) => {
            bundle.workspaceServices = ws?.services || [];
            bundle.workspaceOperations = ws?.operations || [];
          })
        );
      }
      if (selectedScopes.includes('billing') && userId) {
        tasks.push(
          getCloudBillingData(userId)
            .then((b) => {
              bundle.billingAccount = {
                credits: b?.account?.credits,
                currency: b?.account?.currency,
                billingAccountId: b?.account?.billingAccountId,
              };
              bundle.invoices = b?.account?.invoices || [];
            })
            .catch(() => { bundle.invoices = []; })
        );
      }

      await Promise.all(tasks);

      const filenameBase = `tiwlo-export-${new Date().toISOString().slice(0, 10)}`;
      const isCsv = format === 'csv';
      const content = isCsv ? buildCsvRows(bundle) : JSON.stringify(bundle, null, 2);
      const blob = new Blob([content], {
        type: isCsv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.${isCsv ? 'csv' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setLastExportSummary({
        exportedAt: bundle.exportedAt,
        format: format.toUpperCase(),
        records:
          (bundle.teamMembers?.length || 0) +
          (bundle.activityLog?.length || 0) +
          (bundle.workspaceServices?.length || 0) +
          (bundle.invoices?.length || 0) +
          (bundle.profile ? 1 : 0),
        scopesCount: selectedScopes.length,
      });
      showToast?.(`Account archive exported (${format.toUpperCase()}).`);
    } catch (err) {
      setError(err.message || 'Could not export account data.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
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
              <span>Data Export</span>
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Workspace Data Export
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Generate a real portable archive of your authenticated Tiwlo account data directly from live GraphQL sources.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1ED760]" />
          Owner-Scoped Archive
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-neutral-500" />
              Select Data Scopes ({selectedScopes.length}/{EXPORT_SCOPES.length})
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">Choose which datasets to include in your download bundle.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSelectedScopes(
                selectedScopes.length === EXPORT_SCOPES.length ? [] : EXPORT_SCOPES.map((s) => s.id)
              )
            }
            className="text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:underline cursor-pointer"
          >
            {selectedScopes.length === EXPORT_SCOPES.length ? 'Clear all' : 'Select all'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EXPORT_SCOPES.map((scope) => {
            const active = selectedScopes.includes(scope.id);
            return (
              <button
                key={scope.id}
                type="button"
                onClick={() => toggleScope(scope.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer ${
                  active
                    ? 'border-[#1ED760] bg-[#1ED760]/5 dark:bg-[#1ED760]/10'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 hover:border-neutral-300'
                }`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  active ? 'border-[#1ED760] bg-[#1ED760] text-black' : 'border-neutral-300 dark:border-neutral-700'
                }`}>
                  {active && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <div>
                  <div className="text-xs font-semibold text-neutral-950 dark:text-white">{scope.label}</div>
                  <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{scope.detail}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-neutral-200/80 dark:border-neutral-800 pt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mr-1">Format:</span>
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                format === 'json'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <FileJson className="h-3.5 w-3.5" />
              JSON
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                format === 'csv'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || !selectedScopes.length}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1ED760] px-5 py-2.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50 cursor-pointer"
          >
            {exporting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{exporting ? 'Preparing Real Archive...' : `Download ${format.toUpperCase()} Archive`}</span>
          </button>
        </div>
      </div>

      {lastExportSummary && (
        <div className="rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 p-4 text-xs text-neutral-800 dark:text-neutral-200 flex items-center justify-between gap-4">
          <span>
            Last export completed at <strong>{new Date(lastExportSummary.exportedAt).toLocaleString()}</strong> · {lastExportSummary.records} record(s) across {lastExportSummary.scopesCount} dataset(s) ({lastExportSummary.format}).
          </span>
        </div>
      )}
    </div>
  );
}

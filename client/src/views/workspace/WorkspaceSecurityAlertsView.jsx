import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  KeyRound,
  Lock,
  MonitorSmartphone,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

export default function WorkspaceSecurityAlertsView({
  currentUser,
  onBack,
  onNavigate,
  showToast,
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState(null);
  const [accountSummary, setAccountSummary] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [prefs, setPrefs] = useState({
    emailSecurityAlerts: true,
    loginAlerts: true,
    teamInviteAlerts: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [revokingId, setRevokingId] = useState('');

  const loadSecurityData = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [acctRes, tfRes, logRes] = await Promise.all([
        fetch('/api/user/account', { credentials: 'include' }),
        fetch('/api/user/account/two-factor/status', { credentials: 'include' }),
        fetch('/api/user/account/activity-log', { credentials: 'include' }),
      ]);

      const acctData = acctRes.ok ? await acctRes.json().catch(() => ({})) : {};
      const tfData = tfRes.ok ? await tfRes.json().catch(() => ({})) : {};
      const logData = logRes.ok ? await logRes.json().catch(() => ({})) : {};

      if (!acctRes.ok && !tfRes.ok) {
        throw new Error(acctData.error || tfData.error || 'Could not load account security status.');
      }

      setAccountSummary(acctData.account || acctData);
      setTwoFactorStatus(tfData);
      setActivityLogs(Array.isArray(logData.logs) ? logData.logs : []);

      const savedPrefs = acctData?.account?.preferences || acctData?.preferences || {};
      const notif = savedPrefs.notificationPrefs || {};
      setPrefs({
        emailSecurityAlerts: notif.emailSecurityAlerts ?? savedPrefs.securityAlerts ?? true,
        loginAlerts: notif.loginAlerts ?? true,
        teamInviteAlerts: notif.teamInviteAlerts ?? true,
      });
    } catch (err) {
      setError(err.message || 'Failed to load automated security alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSecurityData(false);
  }, [currentUser?.id]);

  const toggleAlertPref = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      const existingPrefs = accountSummary?.preferences || {};
      const res = await fetch('/api/user/account/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...existingPrefs,
          securityAlerts: next.emailSecurityAlerts,
          notificationPrefs: {
            ...(existingPrefs.notificationPrefs || {}),
            ...next,
          },
        }),
      });
      if (!res.ok) throw new Error('Could not save security alert preference.');
      showToast?.('Security alert rules updated.');
    } catch (err) {
      setPrefs(prefs);
      showToast?.(err.message || 'Failed to update preference.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/user/account/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not revoke session.');
      showToast?.('Session revoked.');
      await loadSecurityData(true);
    } catch (err) {
      showToast?.(err.message || 'Revocation failed.', 'error');
    } finally {
      setRevokingId('');
    }
  };

  const sessions = Array.isArray(accountSummary?.sessions) ? accountSummary.sessions : [];
  const hasTwoFactor = Boolean(twoFactorStatus?.twoFactorEnabled || twoFactorStatus?.totpEnabled || currentUser?.twoFactorEnabled);
  const hasTotp = Boolean(twoFactorStatus?.totpEnabled);
  const hasPin = Boolean(accountSummary?.hasSecurityPin);
  const emailVerified = Boolean(accountSummary?.emailVerified ?? currentUser?.emailVerified);

  const checks = [
    {
      label: 'Two-Factor Authentication (2FA)',
      passed: hasTwoFactor,
      detail: hasTotp
        ? 'Authenticator App (TOTP) active'
        : hasTwoFactor
          ? 'Email OTP active — upgrade to Authenticator App recommended'
          : '2FA is disabled. Enable to block unauthorized logins.',
      actionLabel: hasTwoFactor ? 'Manage 2FA' : 'Enable 2FA',
      actionTarget: 'two-factor-auth',
    },
    {
      label: 'Account Security PIN',
      passed: hasPin,
      detail: hasPin ? '4-8 digit confirmation PIN configured' : 'Set a Security PIN for sensitive account edits',
      actionLabel: hasPin ? 'Update PIN' : 'Set PIN',
      actionTarget: 'profile-settings/security',
    },
    {
      label: 'Verified Primary Email',
      passed: emailVerified,
      detail: emailVerified ? (currentUser?.email || 'Verified') : 'Email confirmation pending',
      actionLabel: 'Profile',
      actionTarget: 'profile-settings',
    },
  ];

  const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
  const flaggedEvents = activityLogs.filter((item) => {
    const text = `${item.type || ''} ${item.action || ''} ${item.severity || ''} ${item.message || ''}`.toLowerCase();
    return text.includes('fail') || text.includes('alert') || text.includes('suspicious') || text.includes('revoke') || text.includes('disable');
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Workspace</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Automated Security Alert Center
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Account Posture: <span className="tabular-nums text-emerald-600 dark:text-[#1ED760]">{score}%</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Live login anomaly feed, active session monitoring, and automated security alert rules for your account.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('two-factor-auth')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] px-4 py-2 text-xs font-semibold text-black hover:bg-[#19c354] cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Configure 2FA &amp; QR</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => loadSecurityData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Security Checks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {checks.map((item) => (
          <div key={item.label} className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-neutral-950 dark:text-white">{item.label}</span>
                {item.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1ED760]" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                )}
              </div>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{item.detail}</p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(item.actionTarget)}
                className="self-start rounded-lg border border-neutral-200/80 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
              >
                {item.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Alert Rules + Active Sessions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-neutral-500" />
              Automated Alert Rules
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Instant notifications when security events happen on your account.
            </p>
            <div className="mt-4 space-y-3">
              {[
                { key: 'emailSecurityAlerts', label: 'Unusual activity & password changes' },
                { key: 'loginAlerts', label: 'New device or location sign-ins' },
                { key: 'teamInviteAlerts', label: 'Team invite & role changes' },
              ].map((rule) => (
                <label key={rule.key} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 dark:border-neutral-800/80 bg-[#fafafa] dark:bg-neutral-900/40 px-3 py-2.5 text-xs cursor-pointer">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">{rule.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[rule.key])}
                    disabled={savingPrefs}
                    onChange={() => toggleAlertPref(rule.key)}
                    className="h-4 w-4 accent-[#1ED760] rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-neutral-500" />
              Active Devices ({sessions.length})
            </h2>
            {loading ? (
              <p className="mt-3 text-xs text-neutral-400">Loading active sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="mt-3 text-xs text-neutral-500">Only your current session is active.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-neutral-900 dark:text-white">
                        {s.device || s.userAgent || 'Browser session'}
                        {s.current && (
                          <span className="ml-1.5 rounded bg-[#1ED760]/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500">
                        {s.ip || 'IP unavailable'} {s.lastSeen ? `· ${new Date(s.lastSeen).toLocaleString()}` : ''}
                      </div>
                    </div>
                    {!s.current && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSession(s.id)}
                        disabled={revokingId === s.id}
                        className="shrink-0 rounded-md p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-50"
                        title="Revoke session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security & Login Activity Timeline */}
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
                {flaggedEvents.length > 0 ? (
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
                )}
                Security Events &amp; Login Activity ({activityLogs.length})
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {flaggedEvents.length > 0
                  ? `${flaggedEvents.length} event(s) flagged for review`
                  : 'All recent sign-ins and account events pulled live from GraphQL.'}
              </p>
            </div>
            <Lock className="h-4 w-4 text-neutral-400" />
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading security timeline...</div>
          ) : activityLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-10 text-center text-xs text-neutral-500">
              No security events or login locations recorded for this account yet.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70 max-h-[520px] overflow-y-auto pr-1">
              {activityLogs.map((log, idx) => (
                <div key={log.id || idx} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-900 dark:text-white">
                      {log.action || log.title || log.type || 'Account Event'}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400">
                      {[log.location || log.area, log.ip, log.detail || log.message].filter(Boolean).join(' · ') || 'Authenticated request'}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] text-neutral-400 tabular-nums">
                    {log.createdAt || log.timestamp ? new Date(log.createdAt || log.timestamp).toLocaleString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

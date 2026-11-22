import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Laptop,
  Loader2,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Terminal
} from 'lucide-react';
import { supportFetch } from '../utils/supportFetch';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger
} from '../components/ui/shadcnPrimitives';

function formatTimestamp(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRelativeTime(iso) {
  if (!iso) return 'Just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Active now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function UserSessionsView({
  onBack,
  onSessionsChanged,
  embedded = false,
  showToast
}) {
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    mobileCount: 0,
    desktopCount: 0,
    uniqueIpCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [confirmSignOutOthers, setConfirmSignOutOthers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const response = await supportFetch('/api/user/account/sessions', {
        method: 'GET',
        credentials: 'include'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Could not load active sessions.');
      }
      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      setSessions(nextSessions);
      setSummary(payload.summary || {
        total: nextSessions.length,
        mobileCount: nextSessions.filter((item) => item.platform === 'mobile').length,
        desktopCount: nextSessions.filter((item) => item.platform === 'desktop').length,
        uniqueIpCount: new Set(nextSessions.map((item) => item.ip).filter(Boolean)).size
      });
      onSessionsChanged?.(nextSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load active sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSessionsChanged]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (sessionId = '') => {
    const targetKey = sessionId || 'others';
    setRevokingId(targetKey);
    setError('');
    setSuccessMsg('');
    try {
      const endpoint = sessionId
        ? `/api/user/account/sessions/${encodeURIComponent(sessionId)}`
        : '/api/user/account/sessions';
      const response = await supportFetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Failed to revoke session.');
      }
      const nextSessions = Array.isArray(payload.sessions)
        ? payload.sessions
        : (sessionId
            ? sessions.filter((item) => item.id !== sessionId)
            : sessions.filter((item) => item.isCurrent));
      setSessions(nextSessions);
      setSummary(payload.summary || {
        total: nextSessions.length,
        mobileCount: nextSessions.filter((item) => item.platform === 'mobile').length,
        desktopCount: nextSessions.filter((item) => item.platform === 'desktop').length,
        uniqueIpCount: new Set(nextSessions.map((item) => item.ip).filter(Boolean)).size
      });
      setConfirmSignOutOthers(false);
      onSessionsChanged?.(nextSessions);
      const msg = sessionId ? 'Device signed out.' : 'Signed out all other sessions.';
      setSuccessMsg(msg);
      showToast?.(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session.');
    } finally {
      setRevokingId('');
    }
  };

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((session) => {
      if (platformFilter === 'mobile' && session.platform !== 'mobile') return false;
      if (platformFilter === 'desktop' && session.platform !== 'desktop') return false;
      if (platformFilter === 'current' && !session.isCurrent) return false;
      if (!q) return true;
      const hay = [
        session.device,
        session.deviceName,
        session.appName,
        session.os,
        session.browser,
        session.ip,
        session.userAgent
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, platformFilter, searchQuery]);

  const hasOtherSessions = sessions.some((item) => !item.isCurrent);

  const toggleDetails = (id) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getDeviceIcon = (session) => {
    if (session.platform === 'mobile') return <Smartphone className="size-4" />;
    if (session.platform === 'api') return <Terminal className="size-4" />;
    return <Laptop className="size-4" />;
  };

  return (
    <div className={embedded ? 'space-y-5' : 'mx-auto w-full max-w-5xl space-y-5 pb-12'}>
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to settings">
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                Active Sessions &amp; Devices
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Inspect every mobile device, browser, IP address, and sign-in session across Tiwlo and PICK.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSessions({ silent: true })}
              disabled={refreshing || loading}
            >
              <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
            {hasOtherSessions && (
              <Button
                variant="destructive"
                size="sm"
                disabled={revokingId === 'others'}
                onClick={() => setConfirmSignOutOthers(true)}
              >
                <LogOut className="size-3.5" />
                <span>Sign out other devices</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 font-medium">{successMsg}</div>
        </Alert>
      )}

      {confirmSignOutOthers && (
        <Card className="border-rose-300/80 bg-rose-50/60 dark:border-rose-900/70 dark:bg-rose-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                Sign out all other devices?
              </p>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                This will immediately revoke every mobile app and web session except your current session.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmSignOutOthers(false)}
                disabled={revokingId === 'others'}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={revokingId === 'others'}
                onClick={() => handleRevokeSession('')}
              >
                {revokingId === 'others' && <Loader2 className="size-3.5 animate-spin" />}
                <span>Confirm sign out</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Total Sessions
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {summary.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Mobile Devices
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {summary.mobileCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Web &amp; Desktop
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {summary.desktopCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Unique IPs
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {summary.uniqueIpCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Sessions Directory Card */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-neutral-200/80 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <MonitorSmartphone className="size-4 text-neutral-500" />
            <div>
              <CardTitle>Logged-in Devices</CardTitle>
              <CardDescription>
                Real device names, IP addresses, app channels, and session activity timestamps.
              </CardDescription>
            </div>
          </div>

          {embedded && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadSessions({ silent: true })}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
              {hasOtherSessions && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revokingId === 'others'}
                  onClick={() => setConfirmSignOutOthers(true)}
                >
                  <LogOut className="size-3.5" />
                  <span>Sign out others</span>
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        {/* Search & Platform Filters */}
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 bg-[#fafafa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone model, IP, app, OS..."
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white pr-3 pl-8 text-xs text-neutral-900 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:focus:border-neutral-600"
            />
          </div>

          <Tabs value={platformFilter} onValueChange={setPlatformFilter} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All ({sessions.length})</TabsTrigger>
              <TabsTrigger value="mobile">Mobile ({summary.mobileCount})</TabsTrigger>
              <TabsTrigger value="desktop">Web ({summary.desktopCount})</TabsTrigger>
              <TabsTrigger value="current">Current</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-neutral-500">
              <Loader2 className="size-4 animate-spin text-[#1ED760]" />
              <span>Loading active devices and IP sessions...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 bg-[#fafafa] p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
              <MonitorSmartphone className="mx-auto mb-2 size-6 text-neutral-400" />
              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-200">
                No matching active sessions
              </p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                Try clearing your search or switching device filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
              {filteredSessions.map((session) => {
                const isExpanded = Boolean(expandedIds[session.id]);
                return (
                  <div key={session.id} className="p-4 transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/30">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-[#fafafa] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                          {getDeviceIcon(session)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-bold text-neutral-950 dark:text-white">
                              {session.device || session.deviceName || 'Unknown Device'}
                            </p>
                            {session.isCurrent && (
                              <Badge variant="brand">Current Session</Badge>
                            )}
                            {session.appName && (
                              <Badge variant={session.platform === 'mobile' ? 'info' : 'secondary'}>
                                {session.appName}
                              </Badge>
                            )}
                            {session.os && session.os !== 'Unknown OS' && (
                              <Badge variant="outline">{session.os}</Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">
                            <span className="inline-flex items-center gap-1 font-mono text-neutral-700 dark:text-neutral-300">
                              <Globe className="size-3 text-neutral-400" />
                              {session.ip || 'Unknown IP'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3 text-neutral-400" />
                              {formatRelativeTime(session.lastActiveAt || session.createdAt)}
                            </span>
                            <span>Signed in: {formatTimestamp(session.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDetails(session.id)}
                        >
                          <span>{isExpanded ? 'Hide' : 'Details'}</span>
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </Button>

                        {!session.isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revokingId === session.id}
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            {revokingId === session.id && <Loader2 className="size-3 animate-spin" />}
                            <span>{revokingId === session.id ? 'Signing out...' : 'Sign out'}</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-1 gap-2 rounded-lg bg-[#fafafa] p-3 text-[11px] sm:grid-cols-3 dark:bg-neutral-900/60">
                          <div>
                            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Browser / Client:</span>{' '}
                            <span className="text-neutral-900 dark:text-neutral-100">{session.browser || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Last Active:</span>{' '}
                            <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatTimestamp(session.lastActiveAt)}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-500 dark:text-neutral-400">Expires:</span>{' '}
                            <span className="tabular-nums text-neutral-900 dark:text-neutral-100">{formatTimestamp(session.expiresAt)}</span>
                          </div>
                          <div className="sm:col-span-3">
                            <span className="font-semibold text-neutral-500 dark:text-neutral-400">User-Agent:</span>{' '}
                            <span className="break-all font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                              {session.userAgent || 'Not provided'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import PaginationBar from '../components/PaginationBar';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'gps', label: 'GPS Verified' },
  { id: 'approx', label: 'Approx. IP' },
  { id: 'multi', label: 'Multi-Location' },
  { id: 'flagged', label: 'Travel Anomaly' },
];

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatCapturedAt(value) {
  if (!value) return 'Time unavailable';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function googleMapsUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}

function googleMapZoom(location) {
  if (!location || location.location_source === 'ip' || location.accuracy_meters == null) return 9;
  if (location.accuracy_meters <= 50) return 16;
  return Math.max(8, Math.min(14, Math.floor(17 - Math.log2(location.accuracy_meters / 50))));
}

function formatCoords(lat, lon) {
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return '—';
  return `${nLat}, ${nLon}`;
}

export default function AdminUserLocationsView({ userId, onNavigate }) {
  // List state (server-side search + filter + pagination)
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [summary, setSummary] = useState({
    totalTracked: 0,
    gpsVerified: 0,
    approxIpOnly: 0,
    multiCityOrAnomalies: 0,
    impossibleTravelCount: 0,
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Detail state (right panel or focused view when userId prop is provided)
  const [selectedUserId, setSelectedUserId] = useState(userId || null);
  const [detailUser, setDetailUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [activeLocationIndex, setActiveLocationIndex] = useState(0);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Clipboard feedback
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    setSelectedUserId(userId || null);
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCopy = useCallback(async (value, key) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev));
      }, 1600);
    } catch {
      // Clipboard unavailable
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const params = new URLSearchParams({
        filter: filterMode,
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const response = await fetch(`${API_BASE}/admin/user-locations?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Could not load user locations.');
      }
      const nextUsers = Array.isArray(data.users) ? data.users : [];
      setUsers(nextUsers);
      setTotalUsers(Number(data.pagination?.total ?? data.total ?? nextUsers.length));
      if (data.summary) setSummary(data.summary);
    } catch (err) {
      setListError(err?.message || 'Could not load user locations.');
    } finally {
      setLoadingList(false);
    }
  }, [debouncedQuery, filterMode, page, pageSize]);

  const loadUserDetail = useCallback(async (targetId) => {
    if (!targetId) {
      setDetailUser(null);
      setLocations([]);
      setTelemetry(null);
      setDetailError('');
      return;
    }
    setLoadingDetail(true);
    setDetailError('');
    setActiveLocationIndex(0);
    try {
      const response = await fetch(`${API_BASE}/admin/user-locations/${encodeURIComponent(targetId)}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Could not load this user’s location history.');
      }
      setDetailUser(data.user || null);
      setLocations(Array.isArray(data.locations) ? data.locations : []);
      setTelemetry(data.telemetry || null);
    } catch (err) {
      setDetailError(err?.message || 'Could not load this user’s location history.');
      setDetailUser(null);
      setLocations([]);
      setTelemetry(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      loadList();
    }
  }, [userId, loadList]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserDetail(selectedUserId);
    } else {
      setDetailUser(null);
      setLocations([]);
      setTelemetry(null);
    }
  }, [selectedUserId, loadUserDetail]);

  const activeLocation = useMemo(() => {
    if (!locations.length) return null;
    return locations[Math.min(activeLocationIndex, locations.length - 1)] || locations[0];
  }, [locations, activeLocationIndex]);

  const renderDetailPanel = () => {
    if (!selectedUserId) {
      return (
        <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1ED760]/12 text-[#1ED760]">
            <Compass className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Select a tracked account to inspect telemetry
          </p>
          <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
            Bulk list coordinates are masked to 2 decimals. Selecting an account logs an audited access event and reveals up to 25 exact capture coordinates, map previews, and Haversine jump analysis.
          </p>
        </div>
      );
    }

    if (loadingDetail) {
      return (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-xs text-neutral-500">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#1ED760]" />
          Loading audited capture timeline...
        </div>
      );
    }

    if (detailError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to inspect user location history</p>
                <p className="mt-0.5">{detailError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadUserDetail(selectedUserId)}
              className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    const billingId = detailUser?.tiwi_id || '';
    const coordsText = activeLocation ? formatCoords(activeLocation.latitude, activeLocation.longitude) : '';

    return (
      <div className="space-y-4">
        {/* User Summary + Warning Badges */}
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-950 dark:text-white truncate">
                  {detailUser?.name || 'Account'}
                </h2>
                {telemetry?.impossibleTravelFlag && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
                    <ShieldAlert className="h-3 w-3" />
                    Impossible Travel (&gt;500km / 2h)
                  </span>
                )}
                {telemetry?.multiCityFlag && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    Multi-City ({telemetry.distinctAreasCount} areas · max {telemetry.maxJumpKm} km)
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {detailUser?.email || 'No email'} · ID: <span className="font-mono">{detailUser?.id}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {billingId && (
                <button
                  type="button"
                  onClick={() => handleCopy(billingId, `detail-bill-${billingId}`)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 text-xs font-mono font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                >
                  {copiedKey === `detail-bill-${billingId}` ? (
                    <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                  {billingId}
                </button>
              )}
              <button
                type="button"
                onClick={() => loadUserDetail(selectedUserId)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                Reload
              </button>
            </div>
          </div>

          {telemetry && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/70 px-3 py-2">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">Captures</span>
                <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {telemetry.totalCaptures}
                </span>
              </div>
              <div className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/70 px-3 py-2">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">GPS / IP</span>
                <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {telemetry.gpsVerifiedCount} / {telemetry.approxIpCount}
                </span>
              </div>
              <div className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/70 px-3 py-2">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">Distinct Areas</span>
                <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {telemetry.distinctAreasCount}
                </span>
              </div>
              <div className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/70 px-3 py-2">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500">Max Jump</span>
                <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">
                  {Number(telemetry.maxJumpKm || 0).toLocaleString()} km
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active Map Preview */}
        {activeLocation ? (
          <div className="overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xs">
            <iframe
              title="Selected login capture map"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(`${activeLocation.latitude},${activeLocation.longitude}`)}&z=${googleMapZoom(activeLocation)}&output=embed`}
              className="h-60 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    activeLocation.location_source === 'gps'
                      ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {activeLocation.location_source === 'gps'
                    ? activeLocation.accuracy_meters > 50
                      ? `GPS Verified · ±${Math.round(activeLocation.accuracy_meters)} m`
                      : 'GPS Verified'
                    : 'Approximate IP Location'}
                </span>
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {formatCapturedAt(activeLocation.captured_at)}
                </span>
              </div>

              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {activeLocation.formatted_address || 'Address unavailable'}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Area: <strong className="text-neutral-800 dark:text-neutral-200">{activeLocation.area || '—'}</strong></span>
                <span>Postcode: <strong className="text-neutral-800 dark:text-neutral-200">{activeLocation.postal_code || '—'}</strong></span>
                <span>Plus Code: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{activeLocation.plus_code || '—'}</strong></span>
                <span>Accuracy: <strong className="text-neutral-800 dark:text-neutral-200">{activeLocation.accuracy_meters == null ? 'IP estimate' : `${Math.round(activeLocation.accuracy_meters)} m`}</strong></span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopy(coordsText, `coords-${activeLocationIndex}`)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs font-mono text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                >
                  {copiedKey === `coords-${activeLocationIndex}` ? (
                    <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                  {coordsText}
                </button>
                <a
                  href={googleMapsUrl(activeLocation)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-neutral-950 hover:opacity-90"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center">
            <MapPin className="mx-auto h-7 w-7 text-neutral-400" />
            <p className="mt-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
              No login locations recorded
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              A location is saved only after the user shares GPS or uses an approximate IP-based capture.
            </p>
          </div>
        )}

        {/* Full Audited Capture Timeline (up to 25 captures) */}
        {locations.length > 0 && (
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Audited Capture Timeline ({locations.length})
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Click any capture to focus map preview and inspect Haversine distance jumps.
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
            </div>

            <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800 max-h-[380px] overflow-y-auto">
              {locations.map((loc, idx) => {
                const isActive = idx === activeLocationIndex;
                const coords = formatCoords(loc.latitude, loc.longitude);
                return (
                  <div
                    key={`${loc.captured_at}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveLocationIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveLocationIndex(idx);
                      }
                    }}
                    className={`w-full px-4 py-3 text-left transition cursor-pointer ${
                      isActive
                        ? 'bg-[#1ED760]/8 dark:bg-[#1ED760]/10 border-l-2 border-l-[#1ED760]'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            loc.location_source === 'gps'
                              ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {loc.location_source === 'gps' ? 'GPS' : 'Approx. IP'}
                        </span>
                        {loc.impossibleTravel && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
                            <ShieldAlert className="h-3 w-3" />
                            +{loc.jumpKm} km in {loc.deltaHours}h
                          </span>
                        )}
                        {!loc.impossibleTravel && loc.jumpKm != null && loc.jumpKm >= 50 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            Jump +{loc.jumpKm} km
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-500">
                        {formatCapturedAt(loc.captured_at)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {loc.formatted_address || loc.area || 'Location captured'}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                      <span className="font-mono">{coords}</span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleCopy(coords, `timeline-coord-${idx}`)}
                          className="inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 text-[10px] hover:border-[#1ED760] cursor-pointer"
                        >
                          {copiedKey === `timeline-coord-${idx}` ? (
                            <Check className="h-2.5 w-2.5 text-[#1ED760]" />
                          ) : (
                            <Copy className="h-2.5 w-2.5" />
                          )}
                          Copy
                        </button>
                        <a
                          href={googleMapsUrl(loc)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-[#1ED760] hover:underline"
                        >
                          Maps <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {userId && (
              <button
                type="button"
                onClick={() => onNavigate?.('user-locations')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 hover:border-[#1ED760] dark:text-neutral-300 cursor-pointer"
                aria-label="Back to user locations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1ED760]/12 text-[#1ED760]">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {userId ? detailUser?.name || 'User Location Telemetry' : 'User Locations & Geo-Security'}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {userId
                  ? detailUser?.email || 'Audited 25-capture GPS & IP history'
                  : 'Masked bulk directory with audited per-account Haversine jump & impossible-travel detection.'}
              </p>
            </div>
          </div>

          {!userId && (
            <button
              type="button"
              onClick={() => {
                loadList();
                if (selectedUserId) loadUserDetail(selectedUserId);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Dedicated deep-link view when userId prop is provided */}
      {userId ? (
        renderDetailPanel()
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Tracked Users</span>
                <Users className="h-4 w-4 text-[#1ED760]" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
                {Number(summary.totalTracked || 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>GPS Verified</span>
                <Navigation className="h-4 w-4 text-[#1ED760]" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
                {Number(summary.gpsVerified || 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Approx. IP Only</span>
                <Globe className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
                {Number(summary.approxIpOnly || 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Multi-City / Anomalies</span>
                <ShieldAlert className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
                {Number(summary.multiCityOrAnomalies || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {listError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{listError}</span>
                <button
                  type="button"
                  onClick={loadList}
                  className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs font-medium cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Master-Detail Split Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left Panel: Search, Filter Chips & Paginated List */}
            <div className="xl:col-span-7 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden shadow-xs">
              <div className="space-y-3 border-b border-neutral-200/80 dark:border-neutral-800 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search Name, Email, Billing ID, User ID, Area, Postal Code, Address..."
                    aria-label="Search user locations"
                    className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 pl-9 pr-3 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {FILTER_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        setFilterMode(chip.id);
                        setPage(1);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterMode === chip.id
                          ? 'bg-[#1ED760] text-neutral-950 font-semibold'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingList && users.length === 0 ? (
                <div className="flex items-center justify-center py-14 text-xs text-neutral-500">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#1ED760]" />
                  Loading location directory...
                </div>
              ) : users.length === 0 ? (
                <div className="py-12 px-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  No location records match your current search or filter.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                  {users.map((item) => {
                    const isSelected = selectedUserId === item.user_id;
                    const approxText = formatCoords(
                      item.approxCoords?.latitude ?? item.latitude,
                      item.approxCoords?.longitude ?? item.longitude
                    );
                    return (
                      <div
                        key={item.user_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedUserId(item.user_id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedUserId(item.user_id);
                          }
                        }}
                        className={`flex flex-col gap-2 px-4 py-3.5 transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#1ED760]/8 dark:bg-[#1ED760]/10 border-l-2 border-l-[#1ED760]'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
                                {item.name || 'Account'}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  item.location_source === 'gps'
                                    ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {item.location_source === 'gps' ? 'GPS' : 'Approx. IP'}
                              </span>
                              {item.impossibleTravelFlag && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
                                  <ShieldAlert className="h-3 w-3" />
                                  Travel Anomaly
                                </span>
                              )}
                              {item.multiCityFlag && (
                                <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                  {item.distinctAreasCount} areas
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                              {item.email}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="block text-[11px] tabular-nums text-neutral-500">
                              {formatCapturedAt(item.captured_at)}
                            </span>
                            {item.maxJumpKm > 0 && (
                              <span className="block text-[10px] tabular-nums text-neutral-400">
                                Max jump: {item.maxJumpKm} km
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="truncate text-xs text-neutral-700 dark:text-neutral-300">
                          {item.area ? `${item.area} · ` : ''}
                          {item.formatted_address || 'Address unavailable'}
                        </p>

                        <div
                          className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {item.tiwi_id && (
                              <button
                                type="button"
                                onClick={() => handleCopy(item.tiwi_id, `bill-${item.user_id}`)}
                                className="inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300 hover:border-[#1ED760] cursor-pointer"
                              >
                                {copiedKey === `bill-${item.user_id}` ? (
                                  <Check className="h-2.5 w-2.5 text-[#1ED760]" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5 text-neutral-400" />
                                )}
                                {item.tiwi_id}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopy(approxText, `approx-${item.user_id}`)}
                              className="inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-400 hover:border-[#1ED760] cursor-pointer"
                            >
                              {copiedKey === `approx-${item.user_id}` ? (
                                <Check className="h-2.5 w-2.5 text-[#1ED760]" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 text-neutral-400" />
                              )}
                              Approx: {approxText}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedUserId(item.user_id)}
                            className="text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760] hover:underline cursor-pointer"
                          >
                            Inspect ({item.totalCaptures || 1})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={totalUsers}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(1);
                }}
                itemLabel="tracked users"
              />
            </div>

            {/* Right Panel: Selected User Detail + Map + Audited Capture Timeline */}
            <div className="xl:col-span-5">{renderDetailPanel()}</div>
          </div>
        </>
      )}
    </section>
  );
}

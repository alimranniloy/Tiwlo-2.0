import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function formatCapturedAt(value) {
  if (!value) return 'Time unavailable';
  return new Date(value).toLocaleString();
}

function googleMapsUrl(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}

function googleMapZoom(location) {
  if (location.location_source === 'ip' || location.accuracy_meters == null) return 9;
  if (location.accuracy_meters <= 50) return 16;
  return Math.max(8, Math.min(14, Math.floor(17 - Math.log2(location.accuracy_meters / 50))));
}

export default function AdminUserLocationsView({ userId, onNavigate }) {
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadLocations = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('stockpro_session');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        if (userId) {
          const response = await fetch(`${API_BASE}/admin/user-locations/${encodeURIComponent(userId)}`, {
            credentials: 'include',
            headers
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || 'Could not load this user’s location history.');
          if (active) {
            setUser(data.user);
            setLocations(data.locations);
          }
        } else {
          const response = await fetch(`${API_BASE}/admin/user-locations`, {
            credentials: 'include',
            headers
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || 'Could not load user locations.');
          if (active) setUsers(data.users);
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load user locations.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadLocations();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {userId && (
            <button
              type="button"
              onClick={() => onNavigate?.('user-locations')}
              className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Back to user locations"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-900/40 dark:text-blue-300">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {userId ? user?.name || 'User location history' : 'User locations'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {userId ? user?.email : 'Recent login locations, visible to administrators only.'}
            </p>
          </div>
        </div>
        {!userId && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading locations…
        </div>
      ) : userId ? (
        locations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <MapPin className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">No login locations recorded</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A location is saved only after the user chooses to share it. They may allow GPS or use an approximate IP-based location.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {locations.map((location, index) => (
              <article key={`${location.captured_at}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <iframe
                  title={`Location map ${index + 1}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&z=${googleMapZoom(location)}&output=embed`}
                  className="h-56 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      location.location_source === 'gps'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}>
                      {location.location_source === 'gps'
                        ? location.accuracy_meters > 50
                          ? `Approximate GPS · Google resolved · ±${Math.round(location.accuracy_meters)} m`
                          : 'GPS · Google resolved'
                        : 'Approximate IP location'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatCapturedAt(location.captured_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{location.formatted_address}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Area: {location.area || '—'}</span>
                    <span>Postcode: {location.postal_code || '—'}</span>
                    <span>Plus Code: {location.plus_code || '—'}</span>
                    <span>Accuracy: {location.accuracy_meters == null ? 'IP estimate' : `${Math.round(location.accuracy_meters)} m`}</span>
                    <span className="col-span-2 break-all">Coordinates: {location.latitude}, {location.longitude}</span>
                  </div>
                  {location.location_source === 'ip' && (
                    <p className="text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                      This is a network-based estimate and does not confirm the user’s exact physical location.
                    </p>
                  )}
                  {location.location_source === 'gps' && (
                    <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {location.accuracy_meters > 50
                        ? `Map pin uses reported coordinates; the device estimates up to ${Math.round(location.accuracy_meters)} m uncertainty.`
                        : 'Device-reported GPS; not proof of physical presence.'}
                    </p>
                  )}
                  <a
                    href={googleMapsUrl(location)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8] px-3 py-2 text-xs font-medium text-white hover:bg-[#1765cc]"
                  >
                    Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No login location records are available yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((item) => (
              <button
                type="button"
                key={item.user_id}
                onClick={() => onNavigate?.(`user-locations/${encodeURIComponent(item.user_id)}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name || 'Account'}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.email}</span>
                  <span className="mt-1 block truncate text-xs text-slate-600 dark:text-slate-300">{item.formatted_address}</span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.location_source === 'gps' ? 'GPS' : 'Approx. IP'}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{formatCapturedAt(item.captured_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, KeyRound, Map, Save, Trash2 } from 'lucide-react';
import { requestSensitiveActionGrant } from '../security/reauth.js';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminGoogleMapsSettings({ onBackToDashboard, showToast }) {
  const [settings, setSettings] = useState({ configured: false, keyHint: '' });
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const response = await fetch(`${API_BASE}/admin/google-maps`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.settings) {
          throw new Error(result.error || 'Google Maps settings could not be loaded.');
        }
        if (active) setSettings(result.settings);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSettings();
    return () => { active = false; };
  }, []);

  const saveKey = async (clear = false) => {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(
        headers,
        API_BASE.replace(/\/api\/?$/, '')
      );
      const response = await fetch(`${API_BASE}/admin/google-maps`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(clear ? { clear: true } : { apiKey })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.settings) {
        throw new Error(result.error || 'Google Maps settings could not be saved.');
      }
      setSettings(result.settings);
      setApiKey('');
      showToast?.(clear ? 'Google Maps API key removed.' : 'Google Maps API key saved.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Google Maps API</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Save the Google Maps API key in PostgreSQL for Tiwlo map features. Restrict the key by API and website referrer in Google Cloud.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Map className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">API key configuration</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {loading
                ? 'Checking the saved configuration...'
                : settings.configured
                  ? `A key is saved (${settings.keyHint}). The complete key is never returned to the browser.`
                  : 'No Google Maps API key has been configured yet.'}
            </p>
          </div>
          {!loading && (
            <span className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
              settings.configured
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {settings.configured && <Check className="h-3 w-3" />}
              {settings.configured ? 'Configured' : 'Not configured'}
            </span>
          )}
        </div>

        <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); saveKey(); }}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="google-maps-api-key">
            {settings.configured ? 'Replace API key' : 'Google Maps API key'}
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="google-maps-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={settings.configured ? 'Enter a new key to replace the saved key' : 'Paste your Google Maps API key'}
              maxLength={512}
              disabled={loading || saving}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {settings.configured && (
              <button
                type="button"
                onClick={() => saveKey(true)}
                disabled={loading || saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" /> Remove key
              </button>
            )}
            <button
              type="submit"
              disabled={loading || saving || !apiKey.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save API key'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

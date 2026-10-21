import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Save, ShieldCheck } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub'
};

export default function AdminSocialLoginSettings({ onBackToDashboard, showToast }) {
  const [providers, setProviders] = useState({});
  const [drafts, setDrafts] = useState({
    google: { clientId: '', clientSecret: '', enabled: false },
    github: { clientId: '', clientSecret: '', enabled: false }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const response = await fetch(`${API_BASE}/admin/social-login`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.providers) {
          throw new Error(result.error || 'Social login settings could not be loaded.');
        }
        if (!active) return;
        setProviders(result.providers);
        setDrafts(Object.fromEntries(Object.keys(PROVIDER_LABELS).map(provider => [
          provider,
          {
            clientId: result.providers[provider]?.clientId || '',
            clientSecret: '',
            enabled: result.providers[provider]?.enabled === true
          }
        ])));
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSettings();
    return () => { active = false; };
  }, []);

  const updateDraft = (provider, field, value) => {
    setDrafts(current => ({
      ...current,
      [provider]: { ...current[provider], [field]: value }
    }));
  };

  const saveProvider = async (provider) => {
    setSaving(provider);
    setError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(`${API_BASE}/admin/social-login/${provider}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(drafts[provider])
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.providers) {
        throw new Error(result.error || `${PROVIDER_LABELS[provider]} settings could not be saved.`);
      }
      setProviders(result.providers);
      setDrafts(current => ({
        ...current,
        [provider]: {
          ...current[provider],
          clientId: result.providers[provider].clientId,
          clientSecret: '',
          enabled: result.providers[provider].enabled
        }
      }));
      showToast?.(`${PROVIDER_LABELS[provider]} login settings saved.`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving('');
    }
  };

  const copyCallback = async (provider, callbackUrl) => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(provider);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('Clipboard access is unavailable. Copy the callback URL manually.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="mb-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to Dashboard
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Social Login</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure OAuth credentials. Google also requests optional birthday and address permissions; GitHub only shares its public profile location. Client secrets are encrypted before storage and never shown again.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading provider settings…
        </div>
      ) : Object.keys(PROVIDER_LABELS).map(provider => {
        const draft = drafts[provider];
        const status = providers[provider] || {};
        return (
          <section key={provider} className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{PROVIDER_LABELS[provider]}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {status.configured ? 'Credentials configured' : 'Not configured'}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={event => updateDraft(provider, 'enabled', event.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                Enable login
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Client ID
                <input
                  autoComplete="off"
                  value={draft.clientId}
                  onChange={event => updateDraft(provider, 'clientId', event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700"
                  placeholder={`${PROVIDER_LABELS[provider]} OAuth Client ID`}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Client Secret
                <span className="relative mt-1.5 block">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={draft.clientSecret}
                    onChange={event => updateDraft(provider, 'clientSecret', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700"
                    placeholder={status.secretConfigured ? 'Saved; enter only to replace' : 'OAuth Client Secret'}
                  />
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Authorized callback URL
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  readOnly
                  value={status.callbackUrl || ''}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => copyCallback(provider, status.callbackUrl)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {copied === provider ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === provider ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => saveProvider(provider)}
                disabled={saving !== '' || (draft.enabled && (!draft.clientId.trim() || (!status.secretConfigured && !draft.clientSecret.trim())))}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving === provider ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

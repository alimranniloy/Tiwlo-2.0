import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  RotateCw,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';

const WEBHOOK_EVENT_CATALOG = [
  { id: 'order.created', label: 'Order Created' },
  { id: 'order.paid', label: 'Payment Confirmed' },
  { id: 'product.updated', label: 'Catalog / Stock Updated' },
  { id: 'team.member_invited', label: 'Team Member Invited / Updated' },
  { id: 'security.login_alert', label: 'Security & Login Alert' },
  { id: 'backup.snapshot_completed', label: 'Backup Snapshot Completed' },
];

export default function WorkspaceWebhooksView({
  onBack,
  showToast,
}) {
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState(['order.created', 'security.login_alert']);
  const [copiedSecretId, setCopiedSecretId] = useState('');

  const loadWebhooks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/account/webhooks', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load webhooks.');
      setWebhooks(Array.isArray(data.webhooks) ? data.webhooks : []);
      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    } catch (err) {
      setError(err.message || 'Failed to load webhook configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const toggleEvent = (eventId) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((item) => item !== eventId) : [...prev, eventId]
    );
  };

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Enter a valid HTTPS webhook endpoint URL.');
      return;
    }
    if (!selectedEvents.length) {
      setError('Select at least one subscribed event.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/account/webhooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Workspace Webhook',
          url: url.trim(),
          events: selectedEvents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not register webhook.');
      setName('');
      setUrl('');
      showToast?.('Webhook endpoint added.');
      await loadWebhooks();
    } catch (err) {
      setError(err.message || 'Failed to add webhook.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (hook) => {
    try {
      const res = await fetch(`/api/user/account/webhooks/${encodeURIComponent(hook.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !hook.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update webhook status.');
      showToast?.(`Webhook ${hook.active ? 'paused' : 'activated'}.`);
      await loadWebhooks();
    } catch (err) {
      showToast?.(err.message || 'Update failed.', 'error');
    }
  };

  const handleTestWebhook = async (hookId) => {
    setTestingId(hookId);
    try {
      const res = await fetch(`/api/user/account/webhooks/${encodeURIComponent(hookId)}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Test delivery failed.');
      showToast?.(
        data.delivery?.ok
          ? `Test webhook delivered (HTTP ${data.delivery.statusCode}).`
          : `Test ping attempted: ${data.delivery?.statusText || 'Endpoint unreachable'}`,
        data.delivery?.ok ? 'success' : 'error'
      );
      await loadWebhooks();
    } catch (err) {
      showToast?.(err.message || 'Webhook test failed.', 'error');
    } finally {
      setTestingId('');
    }
  };

  const handleDeleteWebhook = async (hookId) => {
    try {
      const res = await fetch(`/api/user/account/webhooks/${encodeURIComponent(hookId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not remove webhook.');
      showToast?.('Webhook endpoint removed.');
      await loadWebhooks();
    } catch (err) {
      showToast?.(err.message || 'Failed to delete webhook.', 'error');
    }
  };

  const copySecret = (hook) => {
    if (!hook.signingSecret) return;
    navigator.clipboard?.writeText(hook.signingSecret);
    setCopiedSecretId(hook.id);
    showToast?.('HMAC signing secret copied.');
    setTimeout(() => setCopiedSecretId(''), 1800);
  };

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
              <span>Workspace</span>
              <span>/</span>
              <span>Webhook Configuration</span>
            </button>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Custom Webhook Configuration
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Receive HMAC-SHA256 signed event notifications at your HTTPS endpoints whenever account or store events trigger.
          </p>
        </div>
        <button
          type="button"
          onClick={loadWebhooks}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 cursor-pointer"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Create Webhook Card */}
        <form onSubmit={handleCreateWebhook} className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4 self-start">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#1ED760]" />
            Add Webhook Endpoint
          </h2>
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Label
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ERP Fulfillment Sync"
              maxLength={80}
              className="mt-1.5 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs outline-none focus:border-neutral-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Destination URL (HTTPS)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.yourdomain.com/tiwlo"
              required
              className="mt-1.5 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs font-mono outline-none focus:border-neutral-400"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Subscribed Events
            </p>
            <div className="space-y-2">
              {WEBHOOK_EVENT_CATALOG.map((evt) => (
                <label key={evt.id} className="flex items-center gap-2.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt.id)}
                    onChange={() => toggleEvent(evt.id)}
                    className="h-3.5 w-3.5 accent-[#1ED760] rounded"
                  />
                  <span>{evt.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-neutral-400">{evt.id}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-4 py-2.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50 cursor-pointer"
          >
            <Webhook className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving Endpoint...' : 'Save Webhook Endpoint'}</span>
          </button>
        </form>

        {/* Active Webhooks & Delivery History */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white mb-4">
              Registered Endpoints ({webhooks.length})
            </h2>
            {loading ? (
              <div className="py-10 text-center text-xs text-neutral-400">Loading webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 py-10 text-center text-xs text-neutral-500">
                No webhook endpoints configured yet. Add an HTTPS URL on the left to start receiving signed payloads.
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((hook) => (
                  <div key={hook.id} className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-neutral-950 dark:text-white">{hook.name}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            hook.active
                              ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                              : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            {hook.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-neutral-600 dark:text-neutral-400">{hook.url}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTestWebhook(hook.id)}
                          disabled={testingId === hook.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium hover:bg-neutral-50 cursor-pointer disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          <span>{testingId === hook.id ? 'Pinging...' : 'Send Test'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(hook)}
                          className="rounded-lg border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium hover:bg-neutral-50 cursor-pointer"
                        >
                          {hook.active ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWebhook(hook.id)}
                          className="rounded-lg border border-rose-200/80 bg-white dark:bg-neutral-950 p-1.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete endpoint"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800">
                      <div className="flex flex-wrap gap-1">
                        {(hook.events || []).map((evt) => (
                          <span key={evt} className="rounded bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                            {evt}
                          </span>
                        ))}
                      </div>
                      {hook.signingSecret && (
                        <button
                          type="button"
                          onClick={() => copySecret(hook)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500 hover:text-neutral-900 cursor-pointer"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span>{copiedSecretId === hook.id ? 'Copied secret' : 'Copy HMAC secret'}</span>
                          {copiedSecretId === hook.id ? <CheckCircle2 className="h-3 w-3 text-[#1ED760]" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white mb-3">
              Recent Webhook Deliveries ({deliveries.length})
            </h3>
            {deliveries.length === 0 ? (
              <p className="text-xs text-neutral-500">No webhook delivery attempts recorded yet.</p>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {deliveries.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-neutral-900 dark:text-white">{d.event}</span>
                      <span className="ml-2 text-neutral-500 truncate">{d.url}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        d.ok ? 'bg-[#1ED760]/15 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {d.statusCode ? `HTTP ${d.statusCode}` : (d.statusText || 'Failed')}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

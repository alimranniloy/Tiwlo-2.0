import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useState } from 'react';
import { AlertCircle, PackageCheck, Search } from 'lucide-react';

export default function TrackOrderPage({ onNavigate, initialReference = '', initialPhone = '' }) {
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const params = new URLSearchParams({ reference: reference.trim(), phone: phone.trim() });
      const response = await fetch(`/api/public/orders/track?${params.toString()}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Order lookup failed with HTTP ${response.status}`);
      setOrder(result);
    } catch (lookupError) {
      setError(lookupError.message || 'Could not look up this order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto w-full px-4 py-10 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Track your order</h1>
            <p className="text-xs text-slate-500">Enter the order/tracking number and the phone used at checkout.</p>
          </div>
        </div>

        <form onSubmit={handleTrack} className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-700">
            Order or tracking number
            <input
              required
              minLength={3}
              maxLength={120}
              value={reference}
              onChange={event => setReference(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              autoComplete="off"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Checkout phone number
            <input
              required
              type="tel"
              minLength={7}
              maxLength={40}
              value={phone}
              onChange={event => setPhone(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
              autoComplete="tel"
            />
          </label>
          <button
            disabled={loading}
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Checking...' : 'Track Order'}
          </button>
        </form>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {order && (
          <section aria-live="polite" className="border-t border-slate-100 pt-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Order number</p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{order.orderNumber}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Order status</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{order.status}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Payment status</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{order.paymentStatus}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Courier / tracking</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {order.courierService || 'Courier not assigned'}
                  {order.trackingNumber ? ` · ${order.trackingNumber}` : ''}
                </p>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Track with courier
                  </a>
                )}
              </div>
            </div>
            <ol className="space-y-3">
              {(order.statusHistory || []).map((entry, index) => (
                <li key={`${entry.status}-${entry.at}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-700">{entry.status}</span>
                  <time className="text-slate-500" dateTime={entry.at}>
                    {entry.at ? new Date(entry.at).toLocaleString() : ''}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        )}
        <button type="button" onClick={() => onNavigate?.('home')} className="text-xs font-semibold text-blue-600 hover:underline">
          Back to Store
        </button>
      </div>
    </main>
  );
}

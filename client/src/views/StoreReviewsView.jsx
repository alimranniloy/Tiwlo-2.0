import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';

export default function StoreReviewsView({ showToast }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const loadReviews = async () => {
    try {
      const response = await fetch('/api/reviews');
      const result = await response.json().catch(() => []);
      if (!response.ok) throw new Error(result.error || `Review request failed with HTTP ${response.status}.`);
      if (!Array.isArray(result)) throw new Error('The review response was invalid.');
      setReviews(result);
    } catch (loadError) {
      setError(loadError.message || 'Could not load store reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(loadReviews); }, []);

  const updateReview = async (review, changes) => {
    setSavingId(review.id);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(review.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Review update failed with HTTP ${response.status}.`);
      setReviews(current => current.map(item => item.id === result.id ? result : item));
      showToast?.('Review moderation saved.');
    } catch (updateError) {
      setError(updateError.message || 'Could not update this review.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Product reviews</h1>
        <p className="mt-1 text-xs text-slate-500">Verify delivered purchases, moderate customer feedback, and reply as your store.</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {loading ? <p className="text-sm text-slate-500">Loading reviews…</p> : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"><MessageSquare className="mx-auto mb-3 h-7 w-7" />No customer reviews have been submitted yet.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} saving={savingId === review.id} onSave={changes => updateReview(review, changes)} />
          ))}
        </div>
      )}
    </main>
  );
}

function ReviewCard({ review, saving, onSave }) {
  const [reply, setReply] = useState(review.merchantReply || '');
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900">{review.title || 'Customer review'}</h2>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">{review.rating}/5</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{review.customerName} · {review.createdAt ? new Date(review.createdAt).toLocaleString() : ''} · Order {review.orderId}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${review.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : review.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{review.status}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.body}</p>
      <label className="mt-4 block text-xs font-semibold text-slate-600">Store reply
        <textarea maxLength={2000} rows={3} value={reply} onChange={event => setReply(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Reply publicly to this review…" />
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => onSave({ status: 'rejected' })} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button>
        <button type="button" disabled={saving} onClick={() => onSave({ status: 'approved' })} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" />Approve</button>
        <button type="button" disabled={saving} onClick={() => onSave({ merchantReply: reply })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save reply'}</button>
      </div>
    </article>
  );
}

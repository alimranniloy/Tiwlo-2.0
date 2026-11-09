import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function getStatusLabel(status) {
  switch (String(status || '').toUpperCase()) {
    case 'IN_PROGRESS': return 'In review';
    case 'REJECTED': return 'Rejected';
    case 'RESOLVED': return 'Closed';
    default: return 'Submitted';
  }
}

export default function AdminPickAccountAppealsView() {
  const [appeals, setAppeals] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const loadAppeals = useCallback(async () => {
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(`${API_BASE}/admin/pick-account-appeals`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Request failed (${response.status}).`);
      }
      setAppeals(result.appeals || []);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Could not load PICK account review requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppeals();
  }, [loadAppeals, reloadCount]);

  const updateAppeal = async (appeal, status) => {
    const resolutionNotes = notes[appeal.id]?.trim() || '';
    if (status === 'REJECTED' && !resolutionNotes) {
      setError(`Add a review note before rejecting ${appeal.ticketId}.`);
      return;
    }
    setWorkingId(appeal.id);
    setError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(
        `${API_BASE}/admin/pick-account-appeals/${encodeURIComponent(appeal.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ status, resolutionNotes })
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Request failed (${response.status}).`);
      }
      setAppeals((current) => current.map((item) => item.id === appeal.id ? result.appeal : item));
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Could not update the account review request.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">PICK account review requests</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Disabled-account tickets submitted securely from the PICK app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReloadCount((count) => count + 1);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}
      {loading && appeals.length === 0 && (
        <p className="py-12 text-center text-sm text-neutral-500">Loading account review requests…</p>
      )}
      {!loading && !error && appeals.length === 0 && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white px-6 py-14 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <ShieldAlert className="mx-auto mb-3 h-7 w-7 text-neutral-400" />
          <p className="font-semibold text-neutral-800 dark:text-white">No PICK review requests</p>
          <p className="mt-1 text-sm text-neutral-500">New tickets submitted in the app will appear here.</p>
        </div>
      )}

      <div className="space-y-4">
        {appeals.map((appeal) => {
          const status = String(appeal.status || '').toUpperCase();
          const isOpen = status === 'OPEN' || status === 'IN_PROGRESS';
          const isWorking = workingId === appeal.id;
          return (
            <article key={appeal.id} className="rounded-2xl border border-neutral-200/70 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-neutral-400">{appeal.ticketId}</p>
                  <h3 className="mt-1 font-semibold text-neutral-900 dark:text-white">{appeal.userName || 'PICK customer'}</h3>
                  <p className="text-sm text-neutral-500">{appeal.userEmail}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {status === 'IN_PROGRESS' ? <Clock3 size={13} /> : status === 'RESOLVED' ? <Check size={13} /> : <ShieldAlert size={13} />}
                  {getStatusLabel(status)}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                {appeal.description}
              </p>
              <p className="mt-3 text-xs text-neutral-400">
                Submitted {new Date(appeal.createdAt).toLocaleString()}
              </p>
              {appeal.resolutionNotes && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Review note: {appeal.resolutionNotes}
                </p>
              )}
              {isOpen && (
                <div className="mt-4 space-y-3">
                  <label htmlFor={`pick-appeal-note-${appeal.id}`} className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    Note for customer (required to reject)
                  </label>
                  <textarea
                    id={`pick-appeal-note-${appeal.id}`}
                    value={notes[appeal.id] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [appeal.id]: event.target.value }))}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                    placeholder="Explain what the customer should know…"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void updateAppeal(appeal, 'IN_PROGRESS')} disabled={isWorking} className="rounded-full bg-neutral-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      Mark in review
                    </button>
                    <button onClick={() => void updateAppeal(appeal, 'REJECTED')} disabled={isWorking} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                      Reject
                    </button>
                    <button onClick={() => void updateAppeal(appeal, 'RESOLVED')} disabled={isWorking} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300">
                      Close request
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

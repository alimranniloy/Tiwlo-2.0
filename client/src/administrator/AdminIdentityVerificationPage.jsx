import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FileImage,
  FileVideo,
  LoaderCircle,
  ShieldAlert,
  Trash2,
  UserRound
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function EvidenceFileCard({ file, userId }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const openFile = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await window.fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/media/${encodeURIComponent(file.id)}`,
        {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || `Could not load ${file.name}.`);
      }
      setUrl(URL.createObjectURL(await response.blob()));
    } catch (loadError) {
      setError(loadError.message || `Could not load ${file.name}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl bg-[#F8F9FA] ring-1 ring-[#DADCE0] dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex h-56 items-center justify-center overflow-hidden bg-[#ECEFF1] dark:bg-slate-950">
        {url && file.contentType?.startsWith('image/') ? (
          <img src={url} alt={file.name} className="h-full w-full object-contain" />
        ) : url && file.contentType?.startsWith('video/') ? (
          <video src={url} controls preload="metadata" className="max-h-full max-w-full" />
        ) : (
          <div className="text-center">
            {file.contentType?.startsWith('video/')
              ? <FileVideo className="mx-auto h-10 w-10 text-[#5F6368]" aria-hidden="true" />
              : <FileImage className="mx-auto h-10 w-10 text-[#5F6368]" aria-hidden="true" />}
            <button
              type="button"
              onClick={openFile}
              disabled={loading}
              className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#1A73E8] shadow-sm hover:bg-[#E8F0FE] disabled:opacity-50 dark:bg-slate-800"
            >
              {loading ? 'Opening…' : 'Open protected file'}
            </button>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#202124] dark:text-white">{file.name}</p>
            <p className="mt-1 truncate text-xs text-[#5F6368] dark:text-slate-400">{file.originalFilename}</p>
          </div>
          {url && (
            <a
              href={url}
              download={file.originalFilename}
              className="rounded-full p-2 text-[#1A73E8] hover:bg-[#E8F0FE]"
              aria-label={`Download ${file.name}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-[#B3261E]">{error}</p>}
        <div className="mt-3 flex justify-between text-xs text-[#5F6368] dark:text-slate-400">
          <span>{formatBytes(file.size)}</span>
          <span>{formatDate(file.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

export default function AdminIdentityVerificationPage({
  userId,
  showToast,
  onBackToCustomers
}) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [unverifyConfirm, setUnverifyConfirm] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification`,
        {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success || !result.user || !Array.isArray(result.files)) {
        throw new Error(result.error || 'Identity verification records could not be loaded.');
      }

      setUser(result.user);
      setFiles(result.files);
    } catch (loadError) {
      setError(loadError.message || 'Identity verification records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleUnverify = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/unverify`,
        {
          method: 'POST',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not remove identity verification.');
      }
      setUser(previous => previous
        ? { ...previous, identityVerified: false, identityVerificationRequired: true }
        : previous);
      setUnverifyConfirm(false);
      showToast?.(result.message || 'Account is now unverified and locked.');
    } catch (actionError) {
      showToast?.(actionError.message || 'Could not remove identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvidence = async () => {
    if (!window.confirm(`Permanently delete all saved verification files for ${user?.tiwiId || user?.name || 'this account'}?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/files`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Verification files could not be deleted.');
      }
      setFiles([]);
      showToast?.(`${result.deletedCount} verification file${result.deletedCount === 1 ? '' : 's'} deleted.`);
    } catch (actionError) {
      showToast?.(actionError.message || 'Verification files could not be deleted.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const fileGroups = [
    { key: 'document', title: 'Identity document', subtitle: 'Submitted government ID' },
    { key: 'selfie', title: 'Verification selfie', subtitle: 'Selfie used for face matching' },
    { key: 'liveness-recording', title: 'Liveness recording', subtitle: 'Recorded live camera check' }
  ];

  return (
    <div className="space-y-5 font-sans">
      <header className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToCustomers}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#1A73E8] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to customers
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FE] text-[#1A73E8]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#202124] dark:text-white">
                {user?.name || 'Identity verification'}
              </h1>
              <p className="mt-0.5 text-sm text-[#5F6368] dark:text-slate-400">
                {user?.email || 'Loading account details…'}
                {user?.tiwiId ? ` · ${user.tiwiId}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.identityVerified ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E6F4EA] px-4 py-2 text-sm font-medium text-[#137333]">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FCE8E6] px-4 py-2 text-sm font-medium text-[#B3261E]">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Unverified · Account locked
            </span>
          )}
          {user?.identityVerified && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setUnverifyConfirm(true)}
              className="rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-medium text-[#B3261E] transition hover:bg-[#FCE8E6] disabled:opacity-50 dark:border-slate-700"
            >
              Mark unverified
            </button>
          )}
          <button
            type="button"
            disabled={actionLoading || files.length === 0}
            onClick={handleDeleteEvidence}
            className="inline-flex items-center gap-2 rounded-full border border-[#DADCE0] px-4 py-2 text-sm font-medium text-[#5F6368] transition hover:bg-[#F1F3F4] disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete files
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Saved files', value: files.length },
          { label: 'Account ID', value: user?.tiwiId || '—' },
          { label: 'Verification status', value: user?.identityVerified ? 'Verified' : 'Unverified' }
        ].map(item => (
          <div key={item.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
            <p className="text-xs font-medium uppercase tracking-wide text-[#5F6368] dark:text-slate-400">{item.label}</p>
            <p className="mt-2 truncate text-lg font-semibold text-[#202124] dark:text-white">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#202124] dark:text-white">Verification files</h2>
            <p className="mt-1 text-sm text-[#5F6368] dark:text-slate-400">
              Files are grouped by evidence type and stored under this account’s Tiwlo ID.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError('');
              loadRecords();
            }}
            disabled={loading}
            className="rounded-full px-4 py-2 text-sm font-medium text-[#1A73E8] hover:bg-[#E8F0FE] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-[#5F6368]">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#1A73E8]" aria-hidden="true" />
            Loading protected verification files…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl bg-[#FCE8E6] p-4 text-sm text-[#B3261E]">{error}</div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl bg-[#F8F9FA] p-8 text-center dark:bg-slate-800">
            <FileImage className="mx-auto h-8 w-8 text-[#5F6368]" aria-hidden="true" />
            <p className="mt-3 font-medium text-[#202124] dark:text-white">No verification files saved</p>
            <p className="mt-1 text-sm text-[#5F6368] dark:text-slate-400">Evidence is saved after a successful identity check.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {fileGroups.map(group => {
              const groupFiles = files.filter(file => file.category === group.key);
              if (!groupFiles.length) return null;
              return (
                <div key={group.key}>
                  <div className="mb-3">
                    <h3 className="font-medium text-[#202124] dark:text-white">{group.title}</h3>
                    <p className="text-xs text-[#5F6368] dark:text-slate-400">{group.subtitle}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {groupFiles.map(file => (
                      <EvidenceFileCard key={file.id} file={file} userId={userId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {unverifyConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#202124]/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unverify-title"
            className="w-full max-w-md rounded-[28px] bg-white p-6 text-[#202124] shadow-xl dark:bg-slate-900 dark:text-white"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCE8E6] text-[#B3261E]">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 id="unverify-title" className="text-xl font-medium">Mark this account unverified?</h2>
            <p className="mt-3 text-sm leading-6 text-[#5F6368] dark:text-slate-300">
              {user?.name || user?.email} will be signed out and locked until identity verification is completed again. Saved evidence files will not be deleted.
            </p>
            <div className="mt-7 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUnverifyConfirm(false)}
                className="min-h-10 rounded-full px-5 text-sm font-medium text-[#1A73E8] hover:bg-[#F1F3F4] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleUnverify}
                className="min-h-10 rounded-full bg-[#1A73E8] px-5 text-sm font-medium text-white hover:bg-[#1765CC] disabled:opacity-50"
              >
                {actionLoading ? 'Updating…' : 'Mark unverified'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

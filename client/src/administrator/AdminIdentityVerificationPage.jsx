import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileImage,
  FileVideo,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  Maximize2,
  RefreshCw,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
} from '../components/ui/shadcnPrimitives';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const DOCUMENT_TYPE_LABELS = {
  passport: 'Passport',
  national_id: 'National ID',
  other_document: 'Other Document',
  aadhaar: 'Aadhaar',
  drivers_license: "Driver's License",
};

function getAuthHeaders(includeJson = false) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'Size unavailable';
  return n < 1024 * 1024
    ? `${Math.ceil(n / 1024)} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDurationMs(ms) {
  const numeric = Number(ms);
  if (!Number.isFinite(numeric) || numeric < 0) return '—';
  if (numeric < 1000) return `${Math.round(numeric)} ms`;
  const totalSeconds = Math.round(numeric / 1000);
  if (totalSeconds < 60) return `${(numeric / 1000).toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDocumentType(docType, explicitLabel) {
  if (explicitLabel) return explicitLabel;
  const raw = String(docType || '').trim().toLowerCase();
  if (!raw) return 'Other Document';
  if (DOCUMENT_TYPE_LABELS[raw]) return DOCUMENT_TYPE_LABELS[raw];
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeReviewStatus(review) {
  if (!review) return null;
  if (review.isPermanentlyClosed) return 'permanently_closed';
  const raw = String(review.status || 'pending_review').trim().toLowerCase();
  if (raw === 'approved' || raw === 'accepted' || raw === 'verified') return 'accepted';
  if (raw === 'rejected' || raw === 'declined') return 'declined';
  if (raw === 'permanently_closed' || raw === 'closed') return 'permanently_closed';
  return 'pending_review';
}

function getReviewStatusBadge(status) {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', variant: 'success' };
    case 'declined':
      return { label: 'Declined', variant: 'warning' };
    case 'permanently_closed':
      return { label: 'Permanently Closed', variant: 'destructive' };
    case 'pending_review':
      return { label: 'Pending Review', variant: 'info' };
    default:
      return null;
  }
}

function resolveRiskSummary(review) {
  const summary = review?.riskSummary || {};
  const scoreRaw = Number(summary.riskScore ?? review?.riskScore ?? review?.metadata?.riskScore ?? 0);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
  const level = String(
    summary.riskLevel || review?.riskLevel || (score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low')
  ).toLowerCase();

  const rawFlags = [
    ...(Array.isArray(summary.flags) ? summary.flags : []),
    ...(Array.isArray(review?.riskSignals) ? review.riskSignals : []),
    ...(Array.isArray(summary.matchedSignals) ? summary.matchedSignals : []),
  ];
  const flags = [];
  const seen = new Set();
  for (const item of rawFlags) {
    const label = typeof item === 'string' ? item : item?.label || item?.reason || item?.signal || item?.type || '';
    const clean = String(label || '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      flags.push(clean);
    }
  }

  let badgeVariant = 'success';
  let barClass = 'bg-[#1ED760]';
  let levelLabel = 'Low';
  if (level === 'critical') {
    badgeVariant = 'destructive';
    barClass = 'bg-rose-600';
    levelLabel = 'Critical';
  } else if (level === 'high') {
    badgeVariant = 'destructive';
    barClass = 'bg-rose-500';
    levelLabel = 'High';
  } else if (level === 'medium') {
    badgeVariant = 'warning';
    barClass = 'bg-amber-500';
    levelLabel = 'Medium';
  }

  return {
    score,
    levelLabel,
    badgeVariant,
    barClass,
    flags,
    linkedAccountsCount: Array.isArray(summary.linkedAccounts)
      ? summary.linkedAccounts.length
      : Number(summary.linkedAccountsCount || 0),
    deviceCount: Number(summary.deviceCount || 0),
    lastIp: summary.lastIp || null,
  };
}

function categorizeEvidenceFiles(files = []) {
  const list = Array.isArray(files) ? files : [];
  let documentFile = null;
  let selfieFile = null;
  let videoFile = null;

  for (const f of list) {
    const cat = String(f?.category || '').toLowerCase();
    const ct = String(f?.contentType || '').toLowerCase();
    const name = String(f?.name || f?.originalFilename || f?.filename || '').toLowerCase();
    if (!videoFile && (cat === 'liveness-recording' || ct.startsWith('video/') || name.includes('liveness') || name.includes('recording'))) {
      videoFile = f;
    } else if (!selfieFile && (cat === 'selfie' || name.includes('selfie'))) {
      selfieFile = f;
    } else if (!documentFile && (cat === 'document' || name.includes('document') || name.includes('passport') || name.includes('nid') || ct.startsWith('image/'))) {
      documentFile = f;
    }
  }

  return { documentFile, selfieFile, videoFile };
}

function ProtectedEvidenceViewer({ file, userId, title, emptyLabel, onZoom }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(Boolean(file?.id && userId));
  const [error, setError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const fileId = file?.id || '';

  useEffect(() => {
    if (!fileId || !userId) return undefined;
    let active = true;
    let createdUrl = '';

    const streamFile = async () => {
      try {
        const response = await window.fetch(
          `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/media/${encodeURIComponent(fileId)}`,
          {
            credentials: 'include',
            headers: getAuthHeaders(),
          }
        );
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || `Could not load ${title}.`);
        }
        createdUrl = URL.createObjectURL(await response.blob());
        if (!active) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      } catch (err) {
        if (active) setError(err.message || `Could not load ${title}.`);
      } finally {
        if (active) setLoading(false);
      }
    };

    streamFile();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [fileId, title, userId, retryTick]);

  const isVideo = String(file?.contentType || '').startsWith('video/') || file?.category === 'liveness-recording';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex items-center gap-2 min-w-0">
          {isVideo ? (
            <FileVideo className="h-4 w-4 shrink-0 text-[#159f46] dark:text-[#1ED760]" />
          ) : (
            <FileImage className="h-4 w-4 shrink-0 text-[#159f46] dark:text-[#1ED760]" />
          )}
          <span className="truncate text-xs font-semibold text-neutral-950 dark:text-white">{title}</span>
        </div>

        {url && (
          <div className="flex items-center gap-1">
            {!isVideo && onZoom && (
              <button
                type="button"
                onClick={() => onZoom({ url, title })}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white cursor-pointer"
                title="Zoom image"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white cursor-pointer"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <a
              href={url}
              download={file?.originalFilename || file?.filename || 'identity-evidence'}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              aria-label={`Download ${title}`}
              title="Download file"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      <div className="flex h-60 items-center justify-center bg-neutral-100 p-2 dark:bg-neutral-950">
        {!file ? (
          <p className="text-xs text-neutral-400">{emptyLabel || 'No file submitted'}</p>
        ) : loading ? (
          <div className="flex flex-col items-center gap-2 text-xs text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin text-[#1ED760]" />
            <span>Decrypting protected media...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <p className="text-xs text-rose-500">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setError('');
                setRetryTick((t) => t + 1);
              }}
            >
              Retry
            </Button>
          </div>
        ) : url && isVideo ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="max-h-full w-full rounded-lg bg-black"
          />
        ) : url ? (
          <img
            src={url}
            alt={title}
            onClick={() => onZoom?.({ url, title })}
            className="h-full w-full cursor-zoom-in rounded-lg object-contain"
          />
        ) : null}
      </div>

      {file && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200/70 px-3.5 py-2 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <span className="truncate">{file.originalFilename || file.filename || file.name}</span>
          <span className="shrink-0 tabular-nums">
            {formatBytes(file.size)} · {formatDate(file.createdAt)}
          </span>
        </div>
      )}
    </Card>
  );
}

export default function AdminIdentityVerificationPage({
  userId,
  showToast,
  onBackToCustomers,
}) {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  const [actionLoading, setActionLoading] = useState(false);
  const [draftReason, setDraftReason] = useState('');
  const [reasonEdited, setReasonEdited] = useState(false);

  const [unverifyConfirm, setUnverifyConfirm] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [zoomMedia, setZoomMedia] = useState(null);

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      try {
        const headers = getAuthHeaders();
        const [verificationRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification`, {
            credentials: 'include',
            headers,
          }),
          fetch(`${API_BASE}/admin/identity-reviews?userId=${encodeURIComponent(userId)}`, {
            credentials: 'include',
            headers,
          }).catch(() => null),
        ]);

        const verificationJson = await verificationRes.json().catch(() => ({}));
        if (!verificationRes.ok || !verificationJson.success || !verificationJson.user) {
          throw new Error(verificationJson.error || 'Identity verification records could not be loaded.');
        }

        const reviewsJson = reviewsRes?.ok ? await reviewsRes.json().catch(() => null) : null;
        const reviewList = Array.isArray(reviewsJson?.reviews)
          ? reviewsJson.reviews
          : Array.isArray(reviewsJson?.items)
            ? reviewsJson.items
            : Array.isArray(reviewsJson?.data)
              ? reviewsJson.data
              : [];

        if (!active) return;
        setUser(verificationJson.user);
        setFiles(Array.isArray(verificationJson.files) ? verificationJson.files : []);
        setReviews(reviewList);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Identity verification records could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAll();
    return () => {
      active = false;
    };
  }, [userId, reloadTick]);

  const triggerReload = () => {
    setLoading(true);
    setError('');
    setReloadTick((t) => t + 1);
  };

  const latestReview = useMemo(() => {
    if (!reviews.length) return null;
    return reviews[0];
  }, [reviews]);

  const reviewStatus = normalizeReviewStatus(latestReview);
  const reviewStatusMeta = getReviewStatusBadge(reviewStatus);
  const isReviewPermanentlyClosed = Boolean(
    latestReview && (latestReview.isPermanentlyClosed || reviewStatus === 'permanently_closed')
  );

  const reviewReason = reasonEdited
    ? draftReason
    : latestReview?.reviewReason || latestReview?.decisionReason || '';

  const effectiveFiles = useMemo(() => {
    if (files.length > 0) return files;
    if (Array.isArray(latestReview?.evidenceFiles) && latestReview.evidenceFiles.length > 0) {
      return latestReview.evidenceFiles;
    }
    if (Array.isArray(latestReview?.files) && latestReview.files.length > 0) {
      return latestReview.files;
    }
    return [];
  }, [files, latestReview]);

  const categorized = useMemo(() => categorizeEvidenceFiles(effectiveFiles), [effectiveFiles]);
  const risk = useMemo(() => resolveRiskSummary(latestReview), [latestReview]);

  const extraction = useMemo(() => {
    const ext =
      latestReview?.extractedData ||
      latestReview?.aiExtraction ||
      latestReview?.geminiExtraction ||
      latestReview?.metadata?.extraction ||
      {};
    const accountName = user?.name || latestReview?.userName || latestReview?.applicantName || '—';
    const documentName = ext.fullName || ext.detectedName || ext.name || latestReview?.detectedName || '—';
    const accountDob =
      user?.dateOfBirth ||
      latestReview?.accountDateOfBirth ||
      latestReview?.userDateOfBirth ||
      '—';
    const documentDob = ext.dateOfBirth || ext.dob || ext.detectedDob || '—';
    const documentNumber =
      ext.maskedDocumentNumber ||
      ext.documentNumber ||
      ext.idNumber ||
      ext.passportNumber ||
      latestReview?.maskedDocumentNumber ||
      '—';
    const address = ext.address || ext.detectedAddress || latestReview?.detectedAddress || '—';
    const country = ext.issuingCountry || ext.country || latestReview?.issuingCountry || '—';

    const rawConfidence = ext.confidence ?? ext.aiConfidence ?? latestReview?.aiConfidence ?? null;
    const confidencePct =
      rawConfidence !== null && Number.isFinite(Number(rawConfidence))
        ? Number(rawConfidence) <= 1 && Number(rawConfidence) > 0
          ? Math.round(Number(rawConfidence) * 100)
          : Math.round(Number(rawConfidence))
        : null;

    const namesMatch =
      accountName !== '—' &&
      documentName !== '—' &&
      accountName.trim().toLowerCase() === documentName.trim().toLowerCase();
    const dobsMatch =
      accountDob !== '—' &&
      documentDob !== '—' &&
      String(accountDob).trim().slice(0, 10) === String(documentDob).trim().slice(0, 10);

    return {
      accountName,
      documentName,
      accountDob,
      documentDob,
      documentNumber,
      address,
      country,
      confidencePct,
      aiReason: latestReview?.aiReason || latestReview?.fallbackReason || latestReview?.metadata?.aiReason || '',
      namesMatch,
      dobsMatch,
    };
  }, [latestReview, user]);

  const telemetry = useMemo(() => {
    const meta = latestReview?.metadata || {};
    const t = meta.telemetry || latestReview?.telemetry || {};
    const tamperingRaw = meta.tamperingSignals ?? t.tamperingSignals ?? [];
    const tamperingSignals = Array.isArray(tamperingRaw)
      ? tamperingRaw
      : typeof tamperingRaw === 'string' && tamperingRaw.trim()
        ? [tamperingRaw.trim()]
        : [];
    const hasAny =
      t.completionDurationMs !== undefined ||
      Boolean(t.geoCountry) ||
      t.issuingCountryMismatch !== undefined ||
      meta.spoofRisk !== undefined ||
      t.spoofRisk !== undefined ||
      tamperingSignals.length > 0;
    return {
      hasAny,
      completionDurationMs: t.completionDurationMs,
      geoCountry: t.geoCountry || null,
      hasMismatchField: t.issuingCountryMismatch !== undefined,
      issuingCountryMismatch: Boolean(t.issuingCountryMismatch),
      spoofRisk: meta.spoofRisk ?? t.spoofRisk ?? null,
      tamperingSignals,
    };
  }, [latestReview]);

  const duplicateLinkedAccounts = Array.isArray(latestReview?.metadata?.duplicateLinkedAccounts)
    ? latestReview.metadata.duplicateLinkedAccounts
    : [];
  const attestation = latestReview?.metadata?.attestation || latestReview?.attestation || null;
  const merchantStores = Array.isArray(latestReview?.stats?.stores) ? latestReview.stats.stores : [];
  const storesCount = Number(
    latestReview?.stats?.storesCount ??
      (Array.isArray(latestReview?.stats?.stores) ? latestReview.stats.stores.length : latestReview?.stats?.stores ?? 0)
  );
  const ordersCount = Number(latestReview?.stats?.ordersCount ?? 0);

  const handleReviewDecision = async (action) => {
    if (!latestReview || isReviewPermanentlyClosed) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/identity-reviews/${encodeURIComponent(latestReview.id)}/decision`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            action,
            reason: reviewReason.trim(),
          }),
        }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.success === false) {
        throw new Error(result.error || 'Could not save verification decision.');
      }

      setCloseConfirm(false);
      setReasonEdited(false);
      showToast?.(
        result.message ||
          (action === 'accept'
            ? 'Identity verification accepted.'
            : action === 'decline'
              ? 'Identity verification declined.'
              : 'Verification case permanently closed.'),
        'success'
      );
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Verification decision failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequireVerification = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/require`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Could not require identity verification.');
      }
      setUser((prev) =>
        prev ? { ...prev, identityVerified: false, identityVerificationRequired: true } : prev
      );
      showToast?.(result.message || 'Identity verification is now required for this account.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not require identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnverify = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/unverify`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not remove identity verification.');
      }
      setUser((previous) =>
        previous
          ? { ...previous, identityVerified: false, identityVerificationRequired: true }
          : previous
      );
      setUnverifyConfirm(false);
      showToast?.(result.message || 'Account is now unverified and locked.');
    } catch (actionError) {
      showToast?.(actionError.message || 'Could not remove identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvidence = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/files`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: getAuthHeaders(),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Verification files could not be deleted.');
      }
      setFiles([]);
      setDeleteConfirm(false);
      showToast?.(`${result.deletedCount} verification file${result.deletedCount === 1 ? '' : 's'} deleted.`);
    } catch (actionError) {
      showToast?.(actionError.message || 'Verification files could not be deleted.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyText = (value, label) => {
    if (!value || !navigator?.clipboard) return;
    navigator.clipboard
      .writeText(String(value))
      .then(() => showToast?.(`${label} copied to clipboard.`, 'success'))
      .catch(() => {});
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Identity Status Banner */}
      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBackToCustomers}
              className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Merchants &amp; Stores
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#159f46] dark:text-[#1ED760] border border-[#1ED760]/30">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-neutral-950 dark:text-white">
                    {user?.name || 'Identity Verification'}
                  </h1>
                  {user?.identityVerified ? (
                    <Badge variant="success">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : user?.identityVerificationRequired ? (
                    <Badge variant="destructive">
                      <ShieldAlert className="h-3 w-3" />
                      Unverified · Account Locked
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unverified</Badge>
                  )}
                  {reviewStatusMeta && (
                    <Badge variant={reviewStatusMeta.variant}>
                      Review: {reviewStatusMeta.label}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {user?.email || 'Loading account details…'}
                  {user?.tiwiId ? ` · ${user.tiwiId}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={triggerReload} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Cryptographic Attestation Badge (if present & accepted/credentialId) */}
        {(user?.identityVerified || reviewStatus === 'accepted' || attestation?.credentialId) && attestation && (
          <CardContent className="pt-0">
            <div className="flex flex-col gap-2 rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1ED760] text-black">
                  <KeyRound className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-950 dark:text-white flex items-center gap-1.5">
                    Signed Cryptographic Attestation
                    <BadgeCheck className="h-3.5 w-3.5 text-[#159f46] dark:text-[#1ED760]" />
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                    {attestation.credentialId && (
                      <span className="truncate">ID: {attestation.credentialId}</span>
                    )}
                    {attestation.sha256Digest && (
                      <span className="truncate" title={attestation.sha256Digest}>
                        SHA-256: {String(attestation.sha256Digest).slice(0, 18)}…
                      </span>
                    )}
                    {attestation.challengePassed && !attestation.credentialId && (
                      <span>Biometric liveness challenge attested</span>
                    )}
                  </div>
                </div>
              </div>
              {attestation.sha256Digest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyText(attestation.sha256Digest, 'SHA-256 digest')}
                >
                  <Copy className="h-3 w-3" />
                  Copy Digest
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500">Risk Score</span>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
              {latestReview ? `${risk.score}/100` : '—'}
            </p>
            {latestReview && <Badge variant={risk.badgeVariant}>{risk.levelLabel}</Badge>}
          </div>
          <span className="text-[10px] text-neutral-400">
            {risk.flags.length} fraud signal{risk.flags.length === 1 ? '' : 's'}
          </span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500">Merchant Stores</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {latestReview ? storesCount : '—'}
          </p>
          <span className="text-[10px] text-neutral-400 truncate block">
            {latestReview?.stats?.subscriptionPlan || 'Store footprint'}
          </span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500">Orders Count</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {latestReview ? ordersCount.toLocaleString() : '—'}
          </p>
          <span className="text-[10px] text-neutral-400">Processed volume</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500">Saved Evidence</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {effectiveFiles.length}
          </p>
          <span className="text-[10px] text-neutral-400">Protected media files</span>
        </Card>

        <Card className="col-span-2 p-3.5 lg:col-span-1 border-[#1ED760]/30">
          <span className="text-[11px] font-medium text-neutral-500">Account ID</span>
          <p className="mt-1 truncate font-mono text-sm font-semibold text-neutral-950 dark:text-white">
            {user?.tiwiId || user?.id || '—'}
          </p>
          <span className="text-[10px] text-emerald-700 dark:text-[#1ED760]">
            {user?.identityVerified ? 'KYC Approved' : 'Verification Console'}
          </span>
        </Card>
      </div>

      {/* Prominent Linked / Duplicate NID & Passport Alert Card */}
      {duplicateLinkedAccounts.length > 0 && (
        <Card className="border-rose-500/45 bg-rose-500/[0.04] dark:border-rose-500/40 dark:bg-rose-950/20">
          <CardHeader className="pb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <Users className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Linked / Duplicate NID &amp; Passport Alert
              </CardTitle>
              <Badge variant="destructive">
                {duplicateLinkedAccounts.length} Duplicate Match{duplicateLinkedAccounts.length === 1 ? '' : 'es'}
              </Badge>
            </div>
            <CardDescription className="text-rose-700/80 dark:text-rose-300/80">
              This document number or identity hash was previously associated with other Tiwlo accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {duplicateLinkedAccounts.map((acc, idx) => (
              <div
                key={acc.reviewId || acc.userId || idx}
                className="flex flex-col gap-2 rounded-xl border border-rose-500/25 bg-white/90 p-3 text-xs dark:border-rose-500/30 dark:bg-neutral-950/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-neutral-950 dark:text-white">
                      {acc.userName || acc.name || acc.userEmail || acc.email || acc.userId || 'Linked Account'}
                    </span>
                    {acc.tiwiId && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {acc.tiwiId}
                      </Badge>
                    )}
                    {acc.status && (
                      <Badge variant="destructive" className="capitalize">
                        {String(acc.status).replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {acc.userEmail || acc.email || 'Email unavailable'}
                    {acc.matchType || acc.reason ? ` · Match: ${acc.matchType || acc.reason}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pre-Review Risk Intelligence, Fraud Signals & Telemetry (when review exists) */}
      {latestReview && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-[#1ED760]" />
                  Risk Intelligence, Fraud Signals &amp; Merchant Context
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Fraud graph risk score, device signals, store footprint, and zero-trust telemetry.
                </CardDescription>
              </div>
              <Badge variant={risk.badgeVariant}>
                Risk {risk.score}/100 · {risk.levelLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Fraud Score</span>
                <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {risk.score} / 100
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all ${risk.barClass}`}
                  style={{ width: `${risk.score}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {risk.flags.length > 0 ? (
                  risk.flags.map((flag) => (
                    <Badge key={flag} variant={risk.score >= 50 ? 'destructive' : 'warning'}>
                      <AlertTriangle className="h-3 w-3" />
                      {flag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="success">
                    <ShieldCheck className="h-3 w-3" />
                    No active fraud signals
                  </Badge>
                )}
                {risk.linkedAccountsCount > 0 && (
                  <Badge variant="outline">
                    {risk.linkedAccountsCount} linked account{risk.linkedAccountsCount === 1 ? '' : 's'}
                  </Badge>
                )}
                {risk.deviceCount > 0 && (
                  <Badge variant="outline">
                    {risk.deviceCount} device{risk.deviceCount === 1 ? '' : 's'}
                  </Badge>
                )}
                {risk.lastIp && (
                  <Badge variant="secondary" className="font-mono">
                    IP: {risk.lastIp}
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                <Fingerprint className="h-3.5 w-3.5 text-[#1ED760]" />
                Geo &amp; Behavioral Zero-Trust Telemetry
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
                <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                  <span className="text-[10px] text-neutral-500">Completion Time</span>
                  <p className="mt-0.5 font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {formatDurationMs(telemetry.completionDurationMs)}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                  <span className="text-[10px] text-neutral-500">Geo Country</span>
                  <p className="mt-0.5 font-semibold text-neutral-900 dark:text-white flex items-center gap-1">
                    <Globe className="h-3 w-3 text-neutral-400" />
                    {telemetry.geoCountry || 'Local / Unavailable'}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                  <span className="text-[10px] text-neutral-500">Issuing Country Check</span>
                  <p className="mt-0.5">
                    {telemetry.hasMismatchField ? (
                      <Badge variant={telemetry.issuingCountryMismatch ? 'destructive' : 'success'}>
                        {telemetry.issuingCountryMismatch ? 'Country Mismatch' : 'Matched'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending Geo</Badge>
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                  <span className="text-[10px] text-neutral-500">Spoof Risk</span>
                  <p className="mt-0.5 font-semibold capitalize text-neutral-900 dark:text-white">
                    {telemetry.spoofRisk !== null && telemetry.spoofRisk !== undefined
                      ? String(telemetry.spoofRisk)
                      : 'Low'}
                  </p>
                </div>
              </div>
              {telemetry.tamperingSignals.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-neutral-500">Tampering Signals:</span>
                  {telemetry.tamperingSignals.map((sig) => (
                    <Badge key={String(sig)} variant="destructive">
                      {String(sig)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {merchantStores.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {merchantStores.map((s, idx) => (
                  <div
                    key={s.id || s.tiwiId || idx}
                    className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 p-2.5 dark:border-neutral-800"
                  >
                    <Store className="h-4 w-4 shrink-0 text-[#1ED760]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-950 dark:text-white">
                        {s.name || s.storeName || 'Merchant Store'}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {s.domain || s.subdomain || s.tiwiId || 'Active storefront'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dedicated Extracted ID Credentials Summary Card (directly above uploaded media) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-[#1ED760]" />
                Extracted ID Credentials &amp; Profile Comparison
              </CardTitle>
              <CardDescription className="mt-0.5">
                Verified credential fields and Gemini AI OCR comparison against the Tiwlo merchant account.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {extraction.confidencePct !== null && (
                <Badge variant={extraction.confidencePct >= 80 ? 'brand' : 'warning'}>
                  <Sparkles className="h-3 w-3" />
                  AI Confidence: {extraction.confidencePct}%
                </Badge>
              )}
              {!latestReview && (
                <Badge variant="secondary">Legacy / No AI Review Record</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {extraction.aiReason && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">AI Extraction / Fallback Note</p>
                <p className="mt-0.5 opacity-90">{extraction.aiReason}</p>
              </div>
            </Alert>
          )}

          {/* Crisp Labelled Credential Fields */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Document Type
              </span>
              <p className="mt-1.5">
                <Badge variant="brand">
                  {formatDocumentType(latestReview?.documentType, latestReview?.documentTypeLabel)}
                </Badge>
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Document Number
              </span>
              <p className="mt-1.5">
                <Badge variant="outline" className="font-mono text-xs">
                  {extraction.documentNumber}
                </Badge>
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50 sm:col-span-2 lg:col-span-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Address &amp; Country
              </span>
              <p className="mt-1 font-semibold text-neutral-950 dark:text-white">
                {extraction.country}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                {extraction.address}
              </p>
            </div>
          </div>

          {/* Side-by-Side Name & DOB Comparison */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Verified Full Name (Document vs Account)
                </span>
                {extraction.documentName !== '—' && (
                  <Badge variant={extraction.namesMatch ? 'success' : 'warning'}>
                    {extraction.namesMatch ? 'Exact Match' : 'Verify Name'}
                  </Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400">Document OCR</span>
                  <p className="font-semibold text-neutral-950 dark:text-white">{extraction.documentName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400">Tiwlo Account</span>
                  <p className="font-semibold text-neutral-950 dark:text-white">{extraction.accountName}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  <CalendarDays className="h-3 w-3" />
                  Date of Birth (Document vs Account)
                </span>
                {extraction.documentDob !== '—' && extraction.accountDob !== '—' && (
                  <Badge variant={extraction.dobsMatch ? 'success' : 'destructive'}>
                    {extraction.dobsMatch ? 'DOB Match' : 'DOB Mismatch'}
                  </Badge>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-neutral-400">Document OCR</span>
                  <p className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {extraction.documentDob}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400">Tiwlo Account</span>
                  <p className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {extraction.accountDob}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Media Viewer: Side-by-side Document + Selfie + Liveness Video Player */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <ScanFace className="h-4 w-4 text-[#1ED760]" />
            Verification Media Evidence
          </CardTitle>
          <CardDescription>
            Protected government ID, live selfie, and recorded liveness check stored under this account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2.5 text-xs text-neutral-500">
              <RefreshCw className="h-4 w-4 animate-spin text-[#1ED760]" />
              Loading protected verification records…
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </Alert>
          ) : effectiveFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-800">
              <FileImage className="mx-auto h-8 w-8 text-neutral-400" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-semibold text-neutral-900 dark:text-white">
                No verification files saved
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Evidence files appear here once the merchant uploads identity documents.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ProtectedEvidenceViewer
                  key={`doc-${userId}-${categorized.documentFile?.id || 'empty'}`}
                  file={categorized.documentFile}
                  userId={userId}
                  title={`${formatDocumentType(latestReview?.documentType, latestReview?.documentTypeLabel)} Image`}
                  emptyLabel="No identity document image uploaded"
                  onZoom={setZoomMedia}
                />
                <ProtectedEvidenceViewer
                  key={`selfie-${userId}-${categorized.selfieFile?.id || 'empty'}`}
                  file={categorized.selfieFile}
                  userId={userId}
                  title="Live Selfie Image"
                  emptyLabel="No live selfie uploaded"
                  onZoom={setZoomMedia}
                />
              </div>

              <ProtectedEvidenceViewer
                key={`video-${userId}-${categorized.videoFile?.id || 'empty'}`}
                file={categorized.videoFile}
                userId={userId}
                title="Liveness Recording (Video)"
                emptyLabel="No liveness recording uploaded"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Action Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-[#1ED760]" />
            Verification &amp; Compliance Actions
          </CardTitle>
          <CardDescription>
            Approve or decline pending reviews, lock fraudulent submissions, or manage account verification requirements.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {isReviewPermanentlyClosed && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="font-semibold">
                Permanently Closed — This verification case is permanently locked. Accept, Decline, and further review actions are disabled.
              </p>
            </Alert>
          )}

          {latestReview && (
            <div>
              <label
                htmlFor="page-review-reason"
                className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                Admin Review Note / Reason
              </label>
              <textarea
                id="page-review-reason"
                rows={2}
                value={reviewReason}
                onChange={(e) => {
                  setReasonEdited(true);
                  setDraftReason(e.target.value);
                }}
                disabled={isReviewPermanentlyClosed || actionLoading}
                placeholder={
                  isReviewPermanentlyClosed
                    ? 'Review is permanently closed and locked.'
                    : 'Enter review audit note or decision reason...'
                }
                className="w-full rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#1ED760] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="flex flex-wrap items-center justify-between gap-2.5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {latestReview && (
              <>
                <Button
                  variant="primary"
                  disabled={isReviewPermanentlyClosed || actionLoading}
                  onClick={() => handleReviewDecision('accept')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept Verification
                </Button>
                <Button
                  variant="destructive"
                  disabled={isReviewPermanentlyClosed || actionLoading}
                  onClick={() => handleReviewDecision('decline')}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline Verification
                </Button>
                <Button
                  variant="outline"
                  disabled={isReviewPermanentlyClosed || actionLoading}
                  onClick={() => handleReviewDecision('request_correction')}
                >
                  Request Correction
                </Button>
                <Button
                  variant="outline"
                  disabled={isReviewPermanentlyClosed || actionLoading}
                  onClick={() => handleReviewDecision('sync_and_accept')}
                  className="border-[#1ED760]/40 text-emerald-700 hover:bg-[#1ED760]/10 dark:text-[#1ED760]"
                >
                  Sync Profile &amp; Accept
                </Button>
                <Button
                  variant="dark"
                  disabled={isReviewPermanentlyClosed || actionLoading}
                  onClick={() => setCloseConfirm(true)}
                  className="border-rose-900/40 text-rose-200 hover:bg-rose-950"
                >
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                  Permanently Close Review
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user?.identityVerified ? (
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setUnverifyConfirm(true)}
                className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Revoke Verification
              </Button>
            ) : (
              !user?.identityVerificationRequired &&
              !user?.isBanned && (
                <Button
                  variant="outline"
                  disabled={actionLoading || !user}
                  onClick={handleRequireVerification}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Require Verification
                </Button>
              )
            )}

            <Button
              variant="outline"
              disabled={actionLoading || files.length === 0}
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Evidence Files
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Confirm Revoke Verification Dialog */}
      {unverifyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <Card role="dialog" aria-modal="true" className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4" />
                Revoke Identity Verification?
              </CardTitle>
              <CardDescription>
                {user?.name || user?.email} will be signed out and locked until identity verification is completed again. Saved evidence files will be kept.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" disabled={actionLoading} onClick={() => setUnverifyConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={actionLoading} onClick={handleUnverify}>
                {actionLoading ? 'Revoking…' : 'Revoke Verification'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Confirm Permanent Closure Dialog */}
      {closeConfirm && latestReview && !isReviewPermanentlyClosed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <Card role="dialog" aria-modal="true" className="w-full max-w-md border-rose-500/40 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Lock className="h-4 w-4" />
                Permanently Close Verification Review?
              </CardTitle>
              <CardDescription>
                This action permanently locks the review case. Accept, Decline, and further review actions will be disabled forever.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" disabled={actionLoading} onClick={() => setCloseConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={actionLoading}
                onClick={() => handleReviewDecision('permanently_close')}
              >
                <Lock className="h-3.5 w-3.5" />
                {actionLoading ? 'Locking…' : 'Confirm Permanently Close'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Confirm Delete Evidence Files Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4">
          <Card role="dialog" aria-modal="true" className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-4 w-4" />
                Delete All Verification Files?
              </CardTitle>
              <CardDescription>
                Permanently delete all {files.length} saved verification file{files.length === 1 ? '' : 's'} for{' '}
                {user?.tiwiId || user?.name || 'this account'}? This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" disabled={actionLoading} onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={actionLoading} onClick={handleDeleteEvidence}>
                {actionLoading ? 'Deleting…' : 'Delete Evidence Files'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Image Zoom Lightbox Modal */}
      {zoomMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-4"
          onClick={() => setZoomMedia(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-semibold text-white">{zoomMedia.title}</p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(zoomMedia.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Tab
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setZoomMedia(null)}>
                  <X className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>
            <img
              src={zoomMedia.url}
              alt={zoomMedia.title}
              className="mx-auto max-h-[78vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

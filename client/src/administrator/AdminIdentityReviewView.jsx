import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
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
  Radio,
  RefreshCw,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui/shadcnPrimitives';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
  { id: 'permanently_closed', label: 'Permanently Closed' },
];

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

function formatDocumentType(docType) {
  const raw = String(docType || '').trim().toLowerCase();
  if (!raw) return 'Other Document';
  if (DOCUMENT_TYPE_LABELS[raw]) return DOCUMENT_TYPE_LABELS[raw];
  return raw
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'Size unavailable';
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeStatus(review) {
  if (review?.isPermanentlyClosed) return 'permanently_closed';
  const raw = String(review?.status || 'pending_review').trim().toLowerCase();
  if (raw === 'approved' || raw === 'accepted' || raw === 'verified') return 'accepted';
  if (raw === 'rejected' || raw === 'declined') return 'declined';
  if (raw === 'permanently_closed' || raw === 'closed') return 'permanently_closed';
  return 'pending_review';
}

function getStatusMeta(status) {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', variant: 'success', icon: CheckCircle2 };
    case 'declined':
      return { label: 'Declined', variant: 'warning', icon: XCircle };
    case 'permanently_closed':
      return { label: 'Permanently Closed', variant: 'destructive', icon: Lock };
    default:
      return { label: 'Pending Review', variant: 'info', icon: Clock };
  }
}

function getSourceMeta(review) {
  const rawSource = String(
    review?.source || review?.reviewSource || review?.verificationSource || review?.mode || ''
  ).toLowerCase();
  const hasFallbackFlag = Boolean(
    review?.isGeminiFallback ||
      review?.geminiFallback ||
      review?.aiFallback ||
      review?.metadata?.geminiFallback ||
      review?.metadata?.aiFallback ||
      review?.aiReason ||
      /fallback|gemini/.test(rawSource)
  );
  if (hasFallbackFlag) {
    return { label: 'Gemini API Fallback', variant: 'warning' };
  }
  if (/auto/.test(rawSource) || review?.autoApproved || review?.metadata?.autoDecision) {
    return { label: 'Auto', variant: 'brand' };
  }
  return { label: 'Manual', variant: 'secondary' };
}

function resolveRiskData(review) {
  const summary = review?.riskSummary || {};
  const score = Number(
    summary.riskScore ?? review?.riskScore ?? review?.metadata?.riskScore ?? 0
  );
  const clampedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const rawLevel = String(
    summary.riskLevel || review?.riskLevel || (clampedScore >= 75 ? 'critical' : clampedScore >= 50 ? 'high' : clampedScore >= 25 ? 'medium' : 'low')
  ).toLowerCase();

  const rawFlags = [
    ...(Array.isArray(summary.flags) ? summary.flags : []),
    ...(Array.isArray(review?.riskSignals) ? review.riskSignals : []),
    ...(Array.isArray(summary.matchedSignals) ? summary.matchedSignals : []),
  ];
  const flags = [];
  const seen = new Set();
  for (const item of rawFlags) {
    const label =
      typeof item === 'string'
        ? item
        : item?.label || item?.reason || item?.signal || item?.type || '';
    const clean = String(label || '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      flags.push(clean);
    }
  }

  let badgeVariant = 'success';
  let barClass = 'bg-[#1ED760]';
  let levelLabel = 'Low';
  if (rawLevel === 'critical') {
    badgeVariant = 'destructive';
    barClass = 'bg-rose-600';
    levelLabel = 'Critical';
  } else if (rawLevel === 'high') {
    badgeVariant = 'destructive';
    barClass = 'bg-rose-500';
    levelLabel = 'High';
  } else if (rawLevel === 'medium') {
    badgeVariant = 'warning';
    barClass = 'bg-amber-500';
    levelLabel = 'Medium';
  }

  return {
    score: clampedScore,
    level: rawLevel,
    levelLabel,
    badgeVariant,
    barClass,
    flags,
    linkedAccountsCount: Array.isArray(summary.linkedAccounts)
      ? summary.linkedAccounts.length
      : Number(summary.linkedAccountsCount || 0),
    deviceCount: Number(summary.deviceCount || 0),
    lastIp: summary.lastIp || null,
    lastLocation: summary.lastLocation || null,
  };
}

function resolveTelemetryData(review) {
  const meta = review?.metadata || {};
  const telemetry = meta.telemetry || review?.telemetry || {};
  const tamperingRaw = meta.tamperingSignals ?? telemetry.tamperingSignals ?? [];
  const tamperingList = Array.isArray(tamperingRaw)
    ? tamperingRaw
    : typeof tamperingRaw === 'string' && tamperingRaw.trim()
      ? [tamperingRaw.trim()]
      : [];

  const completionDurationMs =
    telemetry.completionDurationMs ??
    telemetry.challengeDurationMs ??
    meta.completionDurationMs ??
    meta.challengeDurationMs ??
    null;
  const geoCountry = telemetry.geoCountry || meta.geoCountry || null;
  const documentCountry =
    telemetry.documentCountry ||
    meta.documentCountry ||
    review?.extractedData?.country ||
    null;
  const mismatchRaw = telemetry.issuingCountryMismatch ?? telemetry.countryMismatch ?? meta.countryMismatch;
  const hasMismatchField = Boolean(geoCountry && documentCountry) || mismatchRaw !== undefined;

  return {
    hasAny: true,
    completionDurationMs,
    geoCountry,
    documentCountry,
    issuingCountryMismatch: Boolean(mismatchRaw),
    hasMismatchField,
    spoofRisk: meta.spoofRisk ?? telemetry.spoofRisk ?? null,
    retakeCount: telemetry.retakeCount ?? meta.retakeCount ?? null,
    tamperingSignals: tamperingList,
  };
}

function resolveDocumentExpiryAlert(review) {
  const extraction =
    review?.extractedData ||
    review?.aiExtraction ||
    review?.geminiExtraction ||
    review?.metadata?.extraction ||
    {};
  const rawExpiry =
    extraction.expiryDate ||
    extraction.expirationDate ||
    review?.expiryDate ||
    null;

  if (!rawExpiry) {
    return { dateText: '—', status: 'unknown', label: null, variant: 'secondary' };
  }

  const parsed = new Date(rawExpiry);
  if (Number.isNaN(parsed.getTime())) {
    return { dateText: String(rawExpiry), status: 'unknown', label: null, variant: 'secondary' };
  }

  const nowMs = Date.now();
  const diffMs = parsed.getTime() - nowMs;
  const dateText = parsed.toLocaleDateString(undefined, { dateStyle: 'medium' });
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

  if (diffMs < 0) {
    return { dateText, rawExpiry: String(rawExpiry), status: 'expired', label: 'Expired', variant: 'destructive' };
  }
  if (diffMs <= sixtyDaysMs) {
    return {
      dateText,
      rawExpiry: String(rawExpiry),
      status: 'expiring_soon',
      label: 'Expiring Soon (<60d)',
      variant: 'warning',
    };
  }
  return { dateText, rawExpiry: String(rawExpiry), status: 'valid', label: null, variant: 'secondary' };
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function resolveExtractionData(review) {
  const extraction =
    review?.extractedData ||
    review?.aiExtraction ||
    review?.geminiExtraction ||
    review?.geminiResult ||
    review?.metadata?.extraction ||
    {};

  const accountName =
    review?.accountName ||
    review?.applicantName ||
    review?.userName ||
    review?.name ||
    review?.user?.name ||
    '—';
  const detectedName =
    extraction.detectedName ||
    extraction.fullName ||
    extraction.name ||
    review?.detectedName ||
    '—';
  const accountDob =
    review?.accountDateOfBirth ||
    review?.userDateOfBirth ||
    review?.user?.dateOfBirth ||
    review?.dateOfBirth ||
    '—';
  const detectedDob =
    extraction.dateOfBirth ||
    extraction.dob ||
    extraction.detectedDob ||
    review?.detectedDob ||
    '—';
  const detectedAddress =
    extraction.detectedAddress ||
    extraction.address ||
    review?.detectedAddress ||
    '—';
  const documentNumber =
    extraction.maskedDocumentNumber ||
    extraction.documentNumber ||
    extraction.idNumber ||
    extraction.passportNumber ||
    review?.maskedDocumentNumber ||
    review?.documentNumber ||
    '—';
  const issuingCountry =
    extraction.issuingCountry ||
    extraction.country ||
    review?.issuingCountry ||
    '—';

  const rawConfidence =
    extraction.confidence ??
    extraction.aiConfidence ??
    review?.aiConfidence ??
    review?.confidence ??
    null;
  const confidencePct =
    rawConfidence !== null && Number.isFinite(Number(rawConfidence))
      ? Number(rawConfidence) <= 1 && Number(rawConfidence) > 0
        ? Math.round(Number(rawConfidence) * 100)
        : Math.round(Number(rawConfidence))
      : null;

  const aiReason =
    review?.aiReason ||
    review?.fallbackReason ||
    review?.metadata?.aiReason ||
    extraction?.reason ||
    extraction?.error ||
    '';

  const namesMatch =
    accountName !== '—' &&
    detectedName !== '—' &&
    accountName.trim().toLowerCase() === detectedName.trim().toLowerCase();

  const dobsMatch =
    accountDob !== '—' &&
    detectedDob !== '—' &&
    String(accountDob).trim().slice(0, 10) === String(detectedDob).trim().slice(0, 10);

  const expiryInfo = resolveDocumentExpiryAlert(review);

  return {
    accountName,
    detectedName,
    accountDob,
    detectedDob,
    detectedAddress,
    documentNumber,
    issuingCountry,
    expiryDate: expiryInfo.dateText,
    expiryAlert: expiryInfo,
    confidencePct,
    aiReason,
    namesMatch,
    dobsMatch,
  };
}

function categorizeFiles(files = []) {
  const list = Array.isArray(files) ? files : [];
  let documentFile = null;
  let selfieFile = null;
  let videoFile = null;

  for (const f of list) {
    const cat = String(f?.category || '').toLowerCase();
    const ct = String(f?.contentType || '').toLowerCase();
    const name = String(f?.name || f?.originalFilename || '').toLowerCase();
    if (!videoFile && (cat === 'liveness-recording' || ct.startsWith('video/') || name.includes('liveness') || name.includes('recording'))) {
      videoFile = f;
    } else if (!selfieFile && (cat === 'selfie' || name.includes('selfie'))) {
      selfieFile = f;
    } else if (!documentFile && (cat === 'document' || name.includes('document') || name.includes('passport') || name.includes('nid') || ct.startsWith('image/'))) {
      documentFile = f;
    }
  }

  return { documentFile, selfieFile, videoFile, allFiles: list };
}

function ProtectedMediaFrame({ file, userId, title, emptyLabel, onZoom }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(Boolean(file?.id && userId));
  const [error, setError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const fileId = file?.id || '';

  useEffect(() => {
    if (!fileId || !userId) return undefined;
    let active = true;
    let createdUrl = '';

    const streamMedia = async () => {
      try {
        const response = await window.fetch(
          `${API_BASE}/admin/users/${encodeURIComponent(userId)}/identity-verification/media/${encodeURIComponent(fileId)}`,
          {
            credentials: 'include',
            headers: getAuthHeaders(),
          }
        );
        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.error || `Could not stream ${title}.`);
        }
        createdUrl = URL.createObjectURL(await response.blob());
        if (!active) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      } catch (err) {
        if (active) setError(err.message || `Failed to load ${title}.`);
      } finally {
        if (active) setLoading(false);
      }
    };

    streamMedia();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [fileId, title, userId, retryTick]);

  const isVideo = String(file?.contentType || '').startsWith('video/') || file?.category === 'liveness-recording';

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 px-3 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 min-w-0">
          {isVideo ? (
            <FileVideo className="h-3.5 w-3.5 shrink-0 text-[#159f46] dark:text-[#1ED760]" />
          ) : (
            <FileImage className="h-3.5 w-3.5 shrink-0 text-[#159f46] dark:text-[#1ED760]" />
          )}
          <span className="truncate text-xs font-semibold text-neutral-900 dark:text-neutral-100">{title}</span>
        </div>
        {blobUrl && (
          <div className="flex items-center gap-1">
            {!isVideo && onZoom && (
              <button
                type="button"
                onClick={() => onZoom({ url: blobUrl, title })}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white cursor-pointer"
                title="Zoom image"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => window.open(blobUrl, '_blank', 'noopener,noreferrer')}
              className="rounded-md p-1 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white cursor-pointer"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex h-52 items-center justify-center bg-neutral-100 dark:bg-neutral-950 p-2">
        {!file ? (
          <p className="text-xs text-neutral-400">{emptyLabel || 'No file submitted'}</p>
        ) : loading ? (
          <div className="flex flex-col items-center gap-1.5 text-xs text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin text-[#1ED760]" />
            <span>Decrypting media...</span>
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
        ) : blobUrl && isVideo ? (
          <video
            src={blobUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-full w-full rounded-lg bg-black"
          />
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={title}
            onClick={() => onZoom?.({ url: blobUrl, title })}
            className="h-full w-full cursor-zoom-in rounded-lg object-contain"
          />
        ) : null}
      </div>

      {file && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-200/70 px-3 py-1.5 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <span className="truncate">{file.originalFilename || file.name || 'Evidence file'}</span>
          <span className="shrink-0 tabular-nums">{formatBytes(file.size)}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminIdentityReviewView({
  onBackToDashboard,
  onNavigate,
  showToast,
}) {
  const [reviews, setReviews] = useState([]);
  const [apiCounts, setApiCounts] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [fallbackFilesByUser, setFallbackFilesByUser] = useState({});
  const [draftReasons, setDraftReasons] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [zoomMedia, setZoomMedia] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [silentPollTick, setSilentPollTick] = useState(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    if (!autoRefreshEnabled) return undefined;
    const timer = window.setInterval(() => {
      setSilentPollTick((t) => t + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled]);

  useEffect(() => {
    let active = true;
    const loadReviews = async () => {
      try {
        const url = `${API_BASE}/admin/identity-reviews?status=${encodeURIComponent(statusFilter)}&q=${encodeURIComponent(search.trim())}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) {
          throw new Error(json.error || 'Failed to load identity verification reviews.');
        }

        const list = Array.isArray(json.reviews)
          ? json.reviews
          : Array.isArray(json.items)
            ? json.items
            : Array.isArray(json.data)
              ? json.data
              : [];

        if (!active) return;
        setReviews(list);
        if (json.counts || json.summary) {
          setApiCounts(json.counts || json.summary);
        }
        setFetchError('');
        setSelectedId((prev) => {
          if (prev && list.some((r) => String(r.id ?? r._id ?? r.userId) === String(prev))) {
            return prev;
          }
          return list.length > 0 ? String(list[0].id ?? list[0]._id ?? list[0].userId) : null;
        });
      } catch (err) {
        if (!active) return;
        setFetchError(err.message || 'Could not load identity verification reviews.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadReviews();
    return () => {
      active = false;
    };
  }, [statusFilter, search, reloadTick, silentPollTick]);

  const triggerReload = () => {
    setLoading(true);
    setReloadTick((t) => t + 1);
  };

  const selectedReview = useMemo(() => {
    if (!selectedId) return reviews[0] || null;
    return reviews.find((r) => String(r.id ?? r._id ?? r.userId) === String(selectedId)) || reviews[0] || null;
  }, [reviews, selectedId]);

  const activeReviewKey = selectedReview
    ? String(selectedReview.id ?? selectedReview._id ?? selectedReview.userId)
    : '';
  const reviewReason =
    activeReviewKey && Object.prototype.hasOwnProperty.call(draftReasons, activeReviewKey)
      ? draftReasons[activeReviewKey]
      : selectedReview?.reviewReason || selectedReview?.decisionReason || '';

  // Fallback evidence loader when a review item doesn't inline `files`
  useEffect(() => {
    const uid = selectedReview?.userId;
    if (!uid) return;
    if (Array.isArray(selectedReview.files) && selectedReview.files.length > 0) return;
    if (fallbackFilesByUser[uid]) return;

    let active = true;
    fetch(`${API_BASE}/admin/users/${encodeURIComponent(uid)}/identity-verification`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json?.success || !Array.isArray(json.files)) return;
        setFallbackFilesByUser((prev) => ({ ...prev, [uid]: json.files }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedReview, fallbackFilesByUser]);

  const kpis = useMemo(() => {
    const computed = {
      total: reviews.length,
      pending: 0,
      accepted: 0,
      declined: 0,
      permanentlyClosed: 0,
    };
    for (const r of reviews) {
      const s = normalizeStatus(r);
      if (s === 'accepted') computed.accepted += 1;
      else if (s === 'declined') computed.declined += 1;
      else if (s === 'permanently_closed') computed.permanentlyClosed += 1;
      else computed.pending += 1;
    }

    if (apiCounts && typeof apiCounts === 'object') {
      return {
        total: Number(apiCounts.total ?? apiCounts.all ?? computed.total),
        pending: Number(apiCounts.pending_review ?? apiCounts.pending ?? computed.pending),
        accepted: Number(apiCounts.accepted ?? apiCounts.approved ?? computed.accepted),
        declined: Number(apiCounts.declined ?? apiCounts.rejected ?? computed.declined),
        permanentlyClosed: Number(apiCounts.permanently_closed ?? apiCounts.permanentlyClosed ?? computed.permanentlyClosed),
      };
    }
    return computed;
  }, [reviews, apiCounts]);

  const handleDecision = async (action) => {
    if (!selectedReview) return;
    const isLocked =
      Boolean(selectedReview.isPermanentlyClosed) ||
      normalizeStatus(selectedReview) === 'permanently_closed';
    if (isLocked) return;

    const reviewKey = selectedReview.id ?? selectedReview._id ?? selectedReview.userId;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/identity-reviews/${encodeURIComponent(reviewKey)}/decision`,
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not save verification decision.');
      }

      const nextStatus =
        action === 'accept' || action === 'sync_and_accept'
          ? 'accepted'
          : action === 'decline' || action === 'request_correction'
            ? 'declined'
            : 'permanently_closed';

      setReviews((prev) =>
        prev.map((item) => {
          const itemKey = item.id ?? item._id ?? item.userId;
          if (String(itemKey) !== String(reviewKey)) return item;
          return {
            ...item,
            ...(json.review || {}),
            status: json.review?.status || nextStatus,
            isPermanentlyClosed:
              action === 'permanently_close' ? true : Boolean(json.review?.isPermanentlyClosed),
            reviewReason: json.review?.reviewReason ?? reviewReason.trim(),
          };
        })
      );

      setConfirmCloseOpen(false);
      showToast?.(
        json.message ||
          (action === 'accept'
            ? 'Identity verification accepted.'
            : action === 'sync_and_accept'
              ? 'Profile synced to document & verification accepted.'
              : action === 'request_correction'
                ? 'Correction request sent to customer.'
                : action === 'decline'
                  ? 'Identity verification declined.'
                  : 'Verification case permanently closed.'),
        'success'
      );
      setReloadTick((t) => t + 1);
    } catch (err) {
      showToast?.(err.message || 'Decision request failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyText = (value, label) => {
    if (!value || !navigator?.clipboard) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      showToast?.(`${label} copied to clipboard.`, 'success');
    }).catch(() => {});
  };

  const handleExportComplianceCsv = () => {
    if (!reviews.length) {
      showToast?.('No review cases available to export.', 'error');
      return;
    }

    const headers = [
      'Review ID',
      'User ID',
      'Email',
      'Name',
      'Document Type',
      'Masked Doc Number',
      'Risk Score',
      'Status',
      'Expiry Date',
      'AI Source',
      'Attestation Digest',
      'Reviewed At',
    ];

    const rows = reviews.map((item) => {
      const ext = resolveExtractionData(item);
      const risk = resolveRiskData(item);
      const statusMeta = getStatusMeta(normalizeStatus(item));
      const sourceMeta = getSourceMeta(item);
      const att = item?.metadata?.attestation || item?.attestation || {};
      const reviewedAt = item.reviewedAt || item.decidedAt || item.updatedAt || '';

      return [
        item.id ?? item._id ?? '',
        item.userId ?? '',
        item.email || item.userEmail || item.user?.email || '',
        item.applicantName || item.userName || item.name || item.user?.name || '',
        item.documentTypeLabel || formatDocumentType(item.documentType),
        ext.documentNumber,
        risk.score,
        statusMeta.label,
        ext.expiryAlert?.rawExpiry || ext.expiryDate,
        sourceMeta.label,
        att.sha256Digest || '',
        reviewedAt,
      ]
        .map(escapeCsvCell)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tiwlo-identity-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast?.(`Exported ${reviews.length} compliance record${reviews.length === 1 ? '' : 's'} to CSV.`, 'success');
  };

  const selectedStatus = selectedReview ? normalizeStatus(selectedReview) : 'pending_review';
  const selectedLocked = Boolean(
    selectedReview && (selectedReview.isPermanentlyClosed || selectedStatus === 'permanently_closed')
  );
  const selectedRisk = selectedReview ? resolveRiskData(selectedReview) : null;
  const selectedTelemetry = selectedReview ? resolveTelemetryData(selectedReview) : null;
  const selectedExtraction = selectedReview ? resolveExtractionData(selectedReview) : null;
  const selectedSource = selectedReview ? getSourceMeta(selectedReview) : null;
  const selectedStatusMeta = getStatusMeta(selectedStatus);
  const SelectedStatusIcon = selectedStatusMeta.icon;

  const selectedFiles = useMemo(() => {
    if (!selectedReview) return { documentFile: null, selfieFile: null, videoFile: null, allFiles: [] };
    const reviewFiles = Array.isArray(selectedReview.evidenceFiles) && selectedReview.evidenceFiles.length > 0
      ? selectedReview.evidenceFiles
      : Array.isArray(selectedReview.files) && selectedReview.files.length > 0
        ? selectedReview.files
        : fallbackFilesByUser[selectedReview.userId] || [];
    return categorizeFiles(reviewFiles);
  }, [selectedReview, fallbackFilesByUser]);

  const duplicateLinkedAccounts = Array.isArray(selectedReview?.metadata?.duplicateLinkedAccounts)
    ? selectedReview.metadata.duplicateLinkedAccounts
    : [];

  const attestation = selectedReview?.metadata?.attestation || selectedReview?.attestation || null;
  const merchantStores = Array.isArray(selectedReview?.stats?.stores)
    ? selectedReview.stats.stores
    : [];
  const storesCount = Number(
    selectedReview?.stats?.storesCount ??
      (Array.isArray(selectedReview?.stats?.stores)
        ? selectedReview.stats.stores.length
        : selectedReview?.stats?.stores ?? 0)
  );

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <Card>
        <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                Identity Verification Review
              </h2>
              <Badge variant="brand">
                <FileCheck2 className="h-3 w-3" />
                Trust &amp; KYC Console
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Audit document extractions, cross-account fraud signals, liveness recordings, and make binding review decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              variant={autoRefreshEnabled ? 'primary' : 'outline'}
              size="md"
              onClick={() => setAutoRefreshEnabled((prev) => !prev)}
              className={
                autoRefreshEnabled
                  ? 'border-[#1ED760]/40 bg-[#1ED760]/15 text-emerald-800 hover:bg-[#1ED760]/25 dark:text-[#1ED760]'
                  : ''
              }
            >
              <Radio className={`h-3.5 w-3.5 ${autoRefreshEnabled ? 'animate-pulse text-[#159f46] dark:text-[#1ED760]' : ''}`} />
              Live Auto-Refresh (15s)
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                setActionLoading(true);
                try {
                  const res = await fetch(`${API_BASE}/admin/identity-reviews/run-expiry-sweep`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: getAuthHeaders(true),
                    body: JSON.stringify({ daysWindow: 30 }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok || json.success === false) {
                    throw new Error(json.error || 'Expiry sweep failed.');
                  }
                  showToast?.(
                    `Expiry check: ${json.checked || 0} checked, ${json.expiredCount || 0} expired, ${json.expiringSoonCount || 0} expiring soon (${json.notificationsSent || 0} notified).`,
                    'success'
                  );
                  triggerReload();
                } catch (err) {
                  showToast?.(err.message || 'Could not run expiry sweep.', 'error');
                } finally {
                  setActionLoading(false);
                }
              }}
              disabled={loading || actionLoading}
            >
              <Clock className="h-3.5 w-3.5" />
              Run Expiry Sweep
            </Button>

            <Button
              variant="outline"
              onClick={handleExportComplianceCsv}
              disabled={reviews.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export Compliance CSV
            </Button>

            <Button
              variant="outline"
              onClick={triggerReload}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total Cases</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {kpis.total}
          </p>
          <span className="text-[10px] text-neutral-400">All KYC submissions</span>
        </Card>

        <Card className="p-3.5 border-[#1ED760]/30">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Pending Review</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
            {kpis.pending}
          </p>
          <span className="text-[10px] text-emerald-700/80 dark:text-[#1ED760]/80">Awaiting decision</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Accepted</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-[#1ED760]">
            {kpis.accepted}
          </p>
          <span className="text-[10px] text-neutral-400">Verified accounts</span>
        </Card>

        <Card className="p-3.5">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Declined</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.declined}
          </p>
          <span className="text-[10px] text-neutral-400">Retry requested</span>
        </Card>

        <Card className="col-span-2 p-3.5 lg:col-span-1">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Permanently Closed</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.permanentlyClosed}
          </p>
          <span className="text-[10px] text-neutral-400">Locked / Non-appealable</span>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs
            value={statusFilter}
            onValueChange={(nextStatus) => {
              setLoading(true);
              setConfirmCloseOpen(false);
              setStatusFilter(nextStatus);
            }}
            className="w-auto"
          >
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full md:w-80">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setLoading(true);
                  setSearch(e.target.value);
                }}
                placeholder="Search name, email, Tiwi ID..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Master-Detail Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Queue Pane */}
        <Card
          className={`lg:col-span-5 xl:col-span-4 overflow-hidden flex flex-col max-h-[78vh] ${
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <CardHeader className="border-b border-neutral-200/80 dark:border-neutral-800 py-3.5 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Verification Queue
              </CardTitle>
              <Badge variant="secondary">{reviews.length} cases</Badge>
            </div>
          </CardHeader>

          <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
            {loading && reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[#1ED760]" />
                Loading verification queue...
              </div>
            ) : fetchError ? (
              <div className="p-6 text-center text-xs text-rose-500">{fetchError}</div>
            ) : reviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No identity verification cases match the current filter.
              </div>
            ) : (
              reviews.map((item) => {
                const itemKey = String(item.id ?? item._id ?? item.userId);
                const isSelected = selectedReview && String(selectedReview.id ?? selectedReview._id ?? selectedReview.userId) === itemKey;
                const itemStatus = normalizeStatus(item);
                const statusMeta = getStatusMeta(itemStatus);
                const sourceMeta = getSourceMeta(item);
                const risk = resolveRiskData(item);
                const expiryAlert = resolveDocumentExpiryAlert(item);

                return (
                  <button
                    key={itemKey}
                    type="button"
                    onClick={() => {
                      setSelectedId(itemKey);
                      setConfirmCloseOpen(false);
                      setMobileDetailOpen(true);
                    }}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1ED760]/10 dark:bg-[#1ED760]/12 border-l-4 border-l-[#1ED760]'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-neutral-950 dark:text-white">
                          {item.applicantName || item.userName || item.name || item.user?.name || 'Tiwlo Merchant'}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {item.email || item.userEmail || item.user?.email || 'No email'}
                        </p>
                      </div>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      { (item.tiwiId || item.user?.tiwiId) && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.tiwiId || item.user?.tiwiId}
                        </Badge>
                      )}
                      <Badge variant="secondary">{formatDocumentType(item.documentType)}</Badge>
                      <Badge variant={risk.badgeVariant}>Risk {risk.score}/100</Badge>
                      <Badge variant={sourceMeta.variant}>{sourceMeta.label}</Badge>
                      {expiryAlert.label && (
                        <Badge variant={expiryAlert.variant}>{expiryAlert.label}</Badge>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] text-neutral-400">
                      Submitted {formatDateTime(item.submittedAt || item.createdAt || item.updatedAt)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Detail Workspace */}
        <div
          className={`lg:col-span-7 xl:col-span-8 space-y-4 ${
            mobileDetailOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {!selectedReview ? (
            <Card className="p-10 text-center">
              <FileCheck2 className="mx-auto mb-2.5 h-8 w-8 text-neutral-300 dark:text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                Select a verification submission
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Choose a case from the left queue to inspect risk signals, Gemini extraction, and evidence files.
              </p>
            </Card>
          ) : (
            <>
              {/* Mobile Back Button */}
              <div className="lg:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileDetailOpen(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Queue
                </Button>
              </div>

              {/* Selected Case Summary Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {selectedReview.applicantName || selectedReview.userName || selectedReview.name || selectedReview.user?.name || 'Tiwlo Merchant'}
                        </CardTitle>
                        <Badge variant={selectedStatusMeta.variant}>
                          <SelectedStatusIcon className="h-3 w-3" />
                          {selectedStatusMeta.label}
                        </Badge>
                        {selectedSource && (
                          <Badge variant={selectedSource.variant}>{selectedSource.label}</Badge>
                        )}
                        {selectedExtraction.expiryAlert?.label && (
                          <Badge variant={selectedExtraction.expiryAlert.variant}>
                            <AlertTriangle className="h-3 w-3" />
                            {selectedExtraction.expiryAlert.label}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {selectedReview.email || selectedReview.userEmail || selectedReview.user?.email || 'No email'}
                        {(selectedReview.tiwiId || selectedReview.user?.tiwiId)
                          ? ` · ${selectedReview.tiwiId || selectedReview.user?.tiwiId}`
                          : ''}
                        {' · '}
                        {selectedReview.documentTypeLabel || formatDocumentType(selectedReview.documentType)}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedReview.userId && onNavigate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onNavigate(`identity-verification/${encodeURIComponent(selectedReview.userId)}`)
                          }
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Account Files
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Cryptographic Attestation Badge (if verified/approved & present) */}
                {(selectedStatus === 'accepted' || attestation?.credentialId) && attestation && (
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
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-700 dark:text-neutral-300 font-mono">
                            {attestation.credentialId && (
                              <span className="truncate">ID: {attestation.credentialId}</span>
                            )}
                            {attestation.sha256Digest && (
                              <span className="truncate" title={attestation.sha256Digest}>
                                SHA-256: {String(attestation.sha256Digest).slice(0, 18)}…
                              </span>
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

              {/* Linked / Duplicate NID & Passport Accounts Alert */}
              {duplicateLinkedAccounts.length > 0 && (
                <Card className="border-rose-500/45 bg-rose-500/[0.04] dark:border-rose-500/40 dark:bg-rose-950/20">
                  <CardHeader className="pb-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                        <Users className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        Linked / Duplicate NID &amp; Passport Alert
                      </CardTitle>
                      <Badge variant="destructive">
                        {duplicateLinkedAccounts.length} Matched Account{duplicateLinkedAccounts.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <CardDescription className="text-rose-700/80 dark:text-rose-300/80">
                      This government ID number or identity fingerprint matched existing Tiwlo account(s).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {duplicateLinkedAccounts.map((acc, idx) => {
                      const targetUserId = acc.userId || acc.id;
                      return (
                        <div
                          key={acc.reviewId || targetUserId || idx}
                          className="flex flex-col gap-2 rounded-xl border border-rose-500/25 bg-white/90 p-3 text-xs dark:border-rose-500/30 dark:bg-neutral-950/80 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-neutral-950 dark:text-white">
                                {acc.userName || acc.name || acc.userEmail || acc.email || targetUserId || 'Linked Account'}
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
                          {targetUserId && onNavigate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onNavigate(`identity-verification/${encodeURIComponent(targetUserId)}`)
                              }
                            >
                              <ExternalLink className="h-3 w-3" />
                              Inspect Account
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* 1. Pre-Review Risk Intelligence & Store/Order Context Panel */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-[#1ED760]" />
                        Pre-Review Risk Intelligence &amp; Merchant Context
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Fraud intelligence graph signals, zero-trust telemetry, and store/order footprint before taking action.
                      </CardDescription>
                    </div>
                    <Badge variant={selectedRisk.badgeVariant}>
                      Risk {selectedRisk.score}/100 · {selectedRisk.levelLabel}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Risk Gauge & Fraud Signals */}
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        Fraud Intelligence Score
                      </span>
                      <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {selectedRisk.score} / 100
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all ${selectedRisk.barClass}`}
                        style={{ width: `${selectedRisk.score}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {selectedRisk.flags.length > 0 ? (
                        selectedRisk.flags.map((flag) => (
                          <Badge key={flag} variant={selectedRisk.score >= 50 ? 'destructive' : 'warning'}>
                            <AlertTriangle className="h-3 w-3" />
                            {flag}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="success">
                          <ShieldCheck className="h-3 w-3" />
                          No active fraud flags detected
                        </Badge>
                      )}
                      {selectedRisk.linkedAccountsCount > 0 && (
                        <Badge variant="outline">
                          {selectedRisk.linkedAccountsCount} linked account{selectedRisk.linkedAccountsCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {selectedRisk.deviceCount > 0 && (
                        <Badge variant="outline">
                          {selectedRisk.deviceCount} device{selectedRisk.deviceCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {selectedRisk.lastIp && (
                        <Badge variant="secondary" className="font-mono">
                          IP: {selectedRisk.lastIp}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Geo & Behavioral Zero-Trust Telemetry */}
                  <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                        <Fingerprint className="h-3.5 w-3.5 text-[#1ED760]" />
                        Geo &amp; Behavioral Zero-Trust Telemetry
                      </div>
                      {selectedTelemetry.documentCountry && (
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Document: {selectedTelemetry.documentCountry}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
                      <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                        <span className="text-[10px] text-neutral-500">Completion Time</span>
                        <p className="mt-0.5 font-semibold tabular-nums text-neutral-900 dark:text-white">
                          {formatDurationMs(selectedTelemetry.completionDurationMs)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                        <span className="text-[10px] text-neutral-500">Geo Country</span>
                        <p className="mt-0.5 font-semibold text-neutral-900 dark:text-white flex items-center gap-1">
                          <Globe className="h-3 w-3 text-neutral-400" />
                          {selectedTelemetry.geoCountry || 'Local / Unavailable'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                        <span className="text-[10px] text-neutral-500">Issuing Country Check</span>
                        <p className="mt-0.5">
                          {selectedTelemetry.hasMismatchField ? (
                            <Badge variant={selectedTelemetry.issuingCountryMismatch ? 'destructive' : 'success'}>
                              {selectedTelemetry.issuingCountryMismatch ? 'Country Mismatch' : 'Matched'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending Geo</Badge>
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900">
                        <span className="text-[10px] text-neutral-500">Spoof Risk</span>
                        <p className="mt-0.5 font-semibold capitalize text-neutral-900 dark:text-white">
                          {selectedTelemetry.spoofRisk !== null && selectedTelemetry.spoofRisk !== undefined
                            ? String(selectedTelemetry.spoofRisk)
                            : 'Low'}
                        </p>
                      </div>
                    </div>

                    {selectedTelemetry.tamperingSignals.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-neutral-500">Tampering Signals:</span>
                        {selectedTelemetry.tamperingSignals.map((sig) => (
                          <Badge key={String(sig)} variant="destructive">
                            {String(sig)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Merchant Stores, Orders & Account Metadata */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Store className="h-3 w-3" />
                        Merchant Stores
                      </span>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {storesCount}
                      </p>
                      {merchantStores.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {merchantStores.slice(0, 3).map((s, idx) => (
                            <p key={s.id || s.tiwiId || idx} className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                              {s.name || s.storeName || 'Store'}
                              {s.domain || s.subdomain ? ` (${s.domain || s.subdomain})` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <ShoppingBag className="h-3 w-3" />
                        Orders &amp; Plan
                      </span>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {Number(selectedReview.stats?.ordersCount ?? 0).toLocaleString()} orders
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 capitalize">
                        Plan: {selectedReview.stats?.subscriptionPlan || 'Free'}
                      </p>
                    </div>

                    <div className="col-span-2 sm:col-span-1 rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Building2 className="h-3 w-3" />
                        Account Record
                      </span>
                      <p className="mt-1 truncate text-xs font-semibold text-neutral-950 dark:text-white">
                        {selectedExtraction.accountName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        Created {formatDateTime(selectedReview.userCreatedAt || selectedReview.accountCreatedAt || selectedReview.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Gemini Extraction & Account Comparison Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#1ED760]" />
                        Gemini Extraction &amp; Account Comparison
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Side-by-side comparison of registered account profile and AI document extraction.
                      </CardDescription>
                    </div>
                    {selectedExtraction.confidencePct !== null && (
                      <Badge variant={selectedExtraction.confidencePct >= 80 ? 'brand' : 'warning'}>
                        AI Confidence: {selectedExtraction.confidencePct}%
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {selectedExtraction.aiReason && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-semibold">AI Fallback / Review Trigger Note</p>
                        <p className="mt-0.5 opacity-90">{selectedExtraction.aiReason}</p>
                      </div>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Account Name (Tiwlo)
                      </span>
                      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                        {selectedExtraction.accountName}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                          Gemini-Detected Name
                        </span>
                        {selectedExtraction.detectedName !== '—' && (
                          <Badge variant={selectedExtraction.namesMatch ? 'success' : 'warning'}>
                            {selectedExtraction.namesMatch ? 'Exact Match' : 'Verify Name'}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                        {selectedExtraction.detectedName}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Account Date of Birth
                      </span>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {selectedExtraction.accountDob}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                          Gemini Document DOB
                        </span>
                        {selectedExtraction.detectedDob !== '—' && selectedExtraction.accountDob !== '—' && (
                          <Badge variant={selectedExtraction.dobsMatch ? 'success' : 'destructive'}>
                            {selectedExtraction.dobsMatch ? 'DOB Match' : 'DOB Mismatch'}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {selectedExtraction.detectedDob}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-500">Document Number</span>
                      <p className="mt-1 font-mono font-semibold text-neutral-950 dark:text-white break-all">
                        {selectedExtraction.documentNumber}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] text-neutral-500">Expiry Date</span>
                        {selectedExtraction.expiryAlert?.label && (
                          <Badge variant={selectedExtraction.expiryAlert.variant}>
                            {selectedExtraction.expiryAlert.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {selectedExtraction.expiryDate}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-500">Issuing Country</span>
                      <p className="mt-1 font-semibold text-neutral-950 dark:text-white">
                        {selectedExtraction.issuingCountry}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200/80 p-3 dark:border-neutral-800">
                      <span className="text-[11px] text-neutral-500">Detected Address</span>
                      <p className="mt-1 font-medium text-neutral-900 dark:text-neutral-200">
                        {selectedExtraction.detectedAddress}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Evidence Media Viewer (Images + Liveness Video Player) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5">
                    <ScanFace className="h-4 w-4 text-[#1ED760]" />
                    Evidence Media Viewer
                  </CardTitle>
                  <CardDescription>
                    Protected identity document, live selfie comparison, and recorded liveness check.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ProtectedMediaFrame
                      key={`doc-${selectedReview.userId}-${selectedFiles.documentFile?.id || 'empty'}`}
                      file={selectedFiles.documentFile}
                      userId={selectedReview.userId}
                      title={`${formatDocumentType(selectedReview.documentType)} Image`}
                      emptyLabel="No identity document image attached"
                      onZoom={setZoomMedia}
                    />
                    <ProtectedMediaFrame
                      key={`selfie-${selectedReview.userId}-${selectedFiles.selfieFile?.id || 'empty'}`}
                      file={selectedFiles.selfieFile}
                      userId={selectedReview.userId}
                      title="Live Selfie Image"
                      emptyLabel="No live selfie attached"
                      onZoom={setZoomMedia}
                    />
                  </div>

                  <ProtectedMediaFrame
                    key={`video-${selectedReview.userId}-${selectedFiles.videoFile?.id || 'empty'}`}
                    file={selectedFiles.videoFile}
                    userId={selectedReview.userId}
                    title="Liveness Recording (Video)"
                    emptyLabel="No liveness recording attached"
                  />
                </CardContent>
              </Card>

              {/* 4. Decision Actions Footer */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-[#1ED760]" />
                    Review Decision
                  </CardTitle>
                  <CardDescription>
                    Record an administrative note and finalize the merchant verification status.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {selectedLocked && (
                    <Alert variant="destructive">
                      <Lock className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <div>
                        <p className="font-semibold">
                          Permanently Closed — This verification case is permanently locked. Accept, Decline, and further review actions are disabled.
                        </p>
                      </div>
                    </Alert>
                  )}

                  <div>
                    <label
                      htmlFor="identity-review-reason"
                      className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                    >
                      Admin Note / Decision Reason
                    </label>
                    <textarea
                      id="identity-review-reason"
                      rows={3}
                      value={reviewReason}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!activeReviewKey) return;
                        setDraftReasons((prev) => ({ ...prev, [activeReviewKey]: val }));
                      }}
                      disabled={selectedLocked || actionLoading}
                      placeholder={
                        selectedLocked
                          ? 'Case is permanently closed. Notes are locked.'
                          : 'Enter verification audit note, mismatch explanation, or closure reason...'
                      }
                      className="w-full rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#1ED760] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                </CardContent>

                <Separator />

                <CardFooter className="flex flex-wrap items-center justify-between gap-2.5 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      disabled={selectedLocked || actionLoading}
                      onClick={() => handleDecision('accept')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accept
                    </Button>

                    <Button
                      variant="destructive"
                      disabled={selectedLocked || actionLoading}
                      onClick={() => handleDecision('decline')}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Decline
                    </Button>

                    <Button
                      variant="outline"
                      disabled={selectedLocked || actionLoading}
                      onClick={() => handleDecision('request_correction')}
                      title="One-click decline asking customer to fix mismatched Name / Date of Birth and re-verify"
                    >
                      Request Correction
                    </Button>

                    {(selectedExtraction?.detectedName !== '—' || selectedExtraction?.detectedDob !== '—') && (
                      <Button
                        variant="outline"
                        disabled={selectedLocked || actionLoading}
                        onClick={() => handleDecision('sync_and_accept')}
                        title="One-click sync customer profile Name/DOB to verified document details & Accept"
                        className="border-[#1ED760]/40 text-emerald-700 hover:bg-[#1ED760]/10 dark:text-[#1ED760]"
                      >
                        Sync Profile &amp; Accept
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="dark"
                    disabled={selectedLocked || actionLoading}
                    onClick={() => setConfirmCloseOpen(true)}
                    className="border-rose-900/40 text-rose-200 hover:bg-rose-950 dark:border-rose-800/60"
                  >
                    <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                    Permanently Close
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* In-UI Confirmation Dialog for Permanent Closure */}
      {confirmCloseOpen && selectedReview && !selectedLocked && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-permanent-close-title"
        >
          <Card className="w-full max-w-md border-rose-500/40 shadow-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle id="confirm-permanent-close-title">
                      Permanently Close Verification Case?
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      Irreversible compliance lock
                    </CardDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmCloseOpen(false)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 cursor-pointer"
                  aria-label="Close confirmation dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
              <Alert variant="destructive">
                <AlertOctagon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>
                  Once permanently closed, this verification case is locked forever. Accept, Decline, and further review actions will be disabled.
                </span>
              </Alert>
              <p>
                Target merchant:{' '}
                <strong className="text-neutral-950 dark:text-white">
                  {selectedReview.applicantName || selectedReview.name || selectedReview.email}
                </strong>
              </p>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                variant="outline"
                disabled={actionLoading}
                onClick={() => setConfirmCloseOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={actionLoading}
                onClick={() => handleDecision('permanently_close')}
              >
                <Lock className="h-3.5 w-3.5" />
                {actionLoading ? 'Locking Case...' : 'Confirm Permanently Close'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Image Zoom Lightbox */}
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
              className="max-h-[78vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

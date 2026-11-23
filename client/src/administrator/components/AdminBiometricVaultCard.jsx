import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Fingerprint,
  Globe,
  KeyRound,
  LogOut,
  Maximize2,
  ShieldCheck,
  Smartphone,
  X
} from 'lucide-react';
import {
  countryCodeToFlag,
  formatDateTime,
  getBiometricRidgeDataUrl
} from './adminUserHelpers.js';

export default function AdminBiometricVaultCard({
  biometric,
  identitySummary,
  policy,
  dossierUser,
  canManageUser = false,
  terminatingSessions = false,
  revokingBiometric = false,
  onTerminateSessions,
  onRevokeBiometric,
  onOpenIdentityReview,
  compact = false
}) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPubKey, setCopiedPubKey] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);

  const bio = biometric && typeof biometric === 'object' ? biometric : {};
  const bioLogs = Array.isArray(bio.logs) ? bio.logs : [];
  const { url: ridgeUrl, isStoredSvg } = getBiometricRidgeDataUrl(bio);
  const idSummary = identitySummary && typeof identitySummary === 'object' ? identitySummary : {};
  const latestReview = idSummary.latestReview || null;
  const evidenceFiles = Array.isArray(idSummary.evidenceFiles) ? idSummary.evidenceFiles : [];
  const effectivePolicy = policy || {
    countryCode: dossierUser?.mainCountryCode || null,
    lastLoginCountryCode: dossierUser?.lastLoginCountryCode || null,
    featureFlags: {}
  };
  const policyFlagEntries = Object.entries(effectivePolicy.featureFlags || {});

  const copyText = (text, setFlag) => {
    if (!text || !navigator?.clipboard) return;
    navigator.clipboard
      .writeText(String(text))
      .then(() => {
        setFlag(true);
        setTimeout(() => setFlag(false), 1800);
      })
      .catch(() => {});
  };

  const handleDownloadSvg = () => {
    if (!bio.ridgeSvgMap) return;
    const blob = new Blob([bio.ridgeSvgMap], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tiwlo-fingerprint-${bio.keyFingerprint || dossierUser?.id || 'credential'}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-[#1ED760]" />
              Stored Fingerprint &amp; Biometric Reference
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Hardware-backed passkey visual map, SHA-256 key fingerprint, and biometric sign-in audit trail stored in PostgreSQL.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                bio.enrolled
                  ? 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30'
                  : bio.revokedAt
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/80 dark:border-neutral-700'
              }`}
            >
              {bio.enrolled ? 'Enrolled & Stored' : bio.revokedAt ? 'Revoked' : 'Not Enrolled'}
            </span>
            {bio.enrolled && bio.hardwareBacked && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                Hardware-Backed Keystore
              </span>
            )}
          </div>
        </div>

        <div
          className={`grid grid-cols-1 ${
            compact ? 'sm:grid-cols-[104px_1fr]' : 'md:grid-cols-[176px_1fr]'
          } gap-4 items-start`}
        >
          {/* Stored Fingerprint Ridge Map Preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={`${
                compact ? 'w-24 h-24' : 'w-44 h-44'
              } rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-3 overflow-hidden relative group`}
            >
              {ridgeUrl ? (
                <>
                  <img
                    src={ridgeUrl}
                    alt="Stored biometric fingerprint ridge map"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setZoomOpen(true)}
                    title="Enlarge fingerprint visual"
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white/90 dark:bg-neutral-950/90 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Fingerprint
                    className={`${compact ? 'w-9 h-9' : 'w-14 h-14'} ${
                      bio.enrolled
                        ? 'text-[#1ED760]'
                        : 'text-neutral-300 dark:text-neutral-700'
                    }`}
                  />
                  <span className="text-[10px] text-neutral-400 text-center mt-1.5 leading-tight">
                    {bio.enrolled ? 'No Ridge Map Stored' : 'No Fingerprint Enrolled'}
                  </span>
                </>
              )}
            </div>

            {!compact && ridgeUrl && (
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760]"
                >
                  <Maximize2 className="w-3 h-3" />
                  View
                </button>
                {isStoredSvg && (
                  <button
                    type="button"
                    onClick={handleDownloadSvg}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760]"
                  >
                    <Download className="w-3 h-3" />
                    SVG
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Credential Metadata & Remote Revoke Controls */}
          <div className="space-y-3 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 px-3 py-2.5 min-w-0">
                <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <Smartphone className="w-3 h-3" /> Registered Device
                </span>
                <span className="font-semibold text-neutral-900 dark:text-white truncate block mt-0.5">
                  {bio.deviceName || '—'}
                </span>
                {(bio.deviceModel || bio.osVersion) && (
                  <span className="text-[10px] text-neutral-500 truncate block">
                    {[bio.deviceModel, bio.osVersion].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 px-3 py-2.5 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Key Fingerprint
                  </span>
                  {bio.keyFingerprint && (
                    <button
                      type="button"
                      onClick={() => copyText(bio.keyFingerprint, setCopiedKey)}
                      className="text-[10px] text-neutral-400 hover:text-[#1ED760] inline-flex items-center gap-0.5"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-[#1ED760]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <span
                  title={bio.keyFingerprint || ''}
                  className="font-mono text-[11px] font-semibold text-neutral-900 dark:text-white truncate block mt-0.5"
                >
                  {bio.keyFingerprint || '—'}
                </span>
                <span className="text-[10px] text-neutral-400 block tabular-nums">
                  {bio.credentialId ? `Cred: ${String(bio.credentialId).slice(0, 14)}…` : 'No Credential ID'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 px-3 py-2.5 min-w-0">
                <span className="text-[10px] text-neutral-400 block">Enrollment &amp; Last Scan</span>
                <span className="font-semibold text-neutral-900 dark:text-white block mt-0.5 tabular-nums">
                  {bio.lastUsedAt
                    ? `Used ${formatDateTime(bio.lastUsedAt)}`
                    : bio.enrolledAt
                      ? `Enrolled ${formatDateTime(bio.enrolledAt)}`
                      : 'Never enrolled'}
                </span>
                <span className="text-[10px] text-neutral-400 block tabular-nums">
                  {bio.enrolledAt
                    ? `Enrolled: ${formatDateTime(bio.enrolledAt)}`
                    : bio.revokedAt
                      ? `Revoked: ${formatDateTime(bio.revokedAt)}`
                      : 'Awaiting mobile enrollment'}
                </span>
              </div>
            </div>

            {/* Hardware Security Notice & Public Key Drawer */}
            <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 px-3 py-2 text-[11px] text-neutral-600 dark:text-neutral-300 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Android KeyStore / iOS Secure Enclave binds a unique hardware EC key &amp; ridge map (mobile OS hardware never exposes raw skin sensor pixels to apps).
                </span>
                {bio.publicKeySpki && (
                  <button
                    type="button"
                    onClick={() => setShowPublicKey((v) => !v)}
                    className="text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760] hover:underline shrink-0"
                  >
                    {showPublicKey ? 'Hide Public Key' : 'Inspect Public Key (SPKI)'}
                  </button>
                )}
              </div>
              {showPublicKey && bio.publicKeySpki && (
                <div className="pt-1 border-t border-neutral-200/70 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase text-neutral-400">Stored Public Key (SPKI)</span>
                    <button
                      type="button"
                      onClick={() => copyText(bio.publicKeySpki, setCopiedPubKey)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-[#1ED760]"
                    >
                      {copiedPubKey ? <Check className="w-3 h-3 text-[#1ED760]" /> : <Copy className="w-3 h-3" />}
                      {copiedPubKey ? 'Copied' : 'Copy SPKI'}
                    </button>
                  </div>
                  <pre className="max-h-24 overflow-auto rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 p-2 text-[10px] font-mono text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-all">
                    {bio.publicKeySpki}
                  </pre>
                </div>
              )}
            </div>

            {canManageUser && (
              <div className="flex flex-wrap items-center gap-2">
                {onTerminateSessions && (
                  <button
                    type="button"
                    disabled={terminatingSessions}
                    onClick={onTerminateSessions}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <LogOut className="w-3 h-3" />
                    {terminatingSessions ? 'Revoking Sessions...' : 'Revoke Remote Sessions'}
                  </button>
                )}
                {bio.enrolled && onRevokeBiometric && (
                  <button
                    type="button"
                    disabled={revokingBiometric}
                    onClick={onRevokeBiometric}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 hover:border-rose-500 hover:text-rose-600 disabled:opacity-50"
                  >
                    <Fingerprint className="w-3 h-3" />
                    {revokingBiometric ? 'Revoking Key...' : 'Revoke Biometric Key'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Biometric Login History */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
            Biometric Enrollment &amp; Sign-In History ({bioLogs.length})
          </span>
          {bioLogs.length === 0 ? (
            <p className="text-[11px] text-neutral-400 py-2.5 px-3 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30">
              No biometric enrollment or sign-in events recorded yet.
            </p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
              {bioLogs.slice(0, 20).map((log, idx) => (
                <div
                  key={log.id || `${log.eventType}-${idx}`}
                  className="px-3 py-2 rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                        log.success === false
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]'
                      }`}
                    >
                      {log.eventType}
                    </span>
                    <span className="text-neutral-700 dark:text-neutral-200 truncate">
                      {log.deviceName || 'Mobile Device'}
                    </span>
                    {log.countryCode && (
                      <span className="text-[10px] text-neutral-500 shrink-0">
                        {countryCodeToFlag(log.countryCode)} {log.countryCode}
                      </span>
                    )}
                    {log.ipAddress && (
                      <span className="font-mono text-[10px] text-neutral-400 hidden sm:inline">
                        {log.ipAddress}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NID / Identity Verification & Country Feature Policy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1ED760]" />
                NID / Identity Summary
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                  idSummary.identityVerified ?? dossierUser?.identityVerified
                    ? 'bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30'
                    : idSummary.identityVerificationRequired ?? dossierUser?.identityVerificationRequired
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200/80 dark:border-neutral-700'
                }`}
              >
                {idSummary.identityVerified ?? dossierUser?.identityVerified
                  ? 'Verified'
                  : idSummary.identityVerificationRequired ?? dossierUser?.identityVerificationRequired
                    ? 'ID Required'
                    : 'Unverified'}
              </span>
            </div>
            {latestReview ? (
              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                    {latestReview.documentTypeLabel || 'Identity Document'}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-neutral-500">
                    {latestReview.status}
                  </span>
                </div>
                {latestReview.fullName && (
                  <p className="text-[10px] text-neutral-500 truncate">
                    Name: {latestReview.fullName}
                    {latestReview.maskedDocumentNumber ? ` · #${latestReview.maskedDocumentNumber}` : ''}
                  </p>
                )}
                <p className="text-[10px] text-neutral-400 tabular-nums">
                  Evidence files: {evidenceFiles.length}
                  {latestReview.aiConfidence != null
                    ? ` · AI ${(Number(latestReview.aiConfidence) * (Number(latestReview.aiConfidence) <= 1 ? 100 : 1)).toFixed(0)}%`
                    : ''}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400">
                No NID / Passport review submissions found. Evidence files: {evidenceFiles.length}.
              </p>
            )}
            {onOpenIdentityReview && (evidenceFiles.length > 0 || latestReview || idSummary.identityVerified || idSummary.identityVerificationRequired) && (
              <button
                type="button"
                onClick={onOpenIdentityReview}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760] hover:underline"
              >
                Open Identity Verification Files →
              </button>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#1ED760]" />
                Country Feature Policy
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                Policy Ready
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium">
                Primary: {countryCodeToFlag(effectivePolicy.countryCode) || '🌐'} {effectivePolicy.countryCode || 'UNSET'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 font-medium">
                Login: {countryCodeToFlag(effectivePolicy.lastLoginCountryCode) || '🌐'} {effectivePolicy.lastLoginCountryCode || 'UNSET'}
              </span>
            </div>
            {policyFlagEntries.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {policyFlagEntries.map(([flagKey, flagVal]) => (
                  <span
                    key={flagKey}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]"
                  >
                    {flagKey}: {String(flagVal)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-neutral-400">
                Extensible regional rollout hooks active (`featureFlags: {'{}'}`).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Full-size Fingerprint Visual Modal */}
      {zoomOpen && ridgeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/75 p-4 backdrop-blur-xs"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#1ED760]" />
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Stored Fingerprint Visual
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-square w-full max-w-[320px] mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-6 flex items-center justify-center">
              <img
                src={ridgeUrl}
                alt="Stored biometric fingerprint ridge map"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
              <p>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">Device:</span>{' '}
                {bio.deviceName || '—'}
              </p>
              <p className="font-mono break-all">
                <span className="font-sans font-semibold text-neutral-800 dark:text-neutral-200">Key Fingerprint:</span>{' '}
                {bio.keyFingerprint || '—'}
              </p>
            </div>
            {isStoredSvg && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c354] text-black text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download SVG
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

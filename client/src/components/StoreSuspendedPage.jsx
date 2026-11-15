import React from 'react';
import { ArrowRight } from 'lucide-react';
import { getMainAppUrl } from '../utils/navigation';

function formatDeletionDate(value) {
  if (!value) return '';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ts));
}

export default function StoreSuspendedPage({ suspendedInfo = null, billingHref = '' }) {
  const store = suspendedInfo?.store || suspendedInfo || {};
  const storeName = String(store?.storeName || suspendedInfo?.storeName || '').trim();
  const host = String(
    store?.subdomain ||
      store?.domain ||
      suspendedInfo?.subdomain ||
      (typeof window !== 'undefined' ? window.location.hostname : '')
  ).trim();
  const scheduledDeletionAt =
    store?.scheduledDeletionAt || suspendedInfo?.scheduledDeletionAt || null;
  const formattedDeletionDate = formatDeletionDate(scheduledDeletionAt);
  const renewUrl = billingHref || getMainAppUrl('/billing');

  return (
    <div className="min-h-screen w-full bg-white text-neutral-950 flex flex-col items-center justify-center px-6 py-12 antialiased">
      <main className="w-full max-w-md text-center flex flex-col items-center">
        <a
          href={getMainAppUrl('/')}
          aria-label="Tiwlo Home"
          className="mb-8 inline-flex items-center select-none"
        >
          <img
            src="/tiwlo-light-logo.png"
            alt="Tiwlo"
            draggable={false}
            className="h-7 w-auto object-contain"
          />
        </a>

        {(storeName || host) && (
          <p className="mb-3 text-xs font-medium tracking-wide text-neutral-500 break-all">
            {storeName && host ? `${storeName} · ${host}` : storeName || host}
          </p>
        )}

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-950">
          Payment required to restore this store
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          This store&apos;s 3-day grace period has expired and renewal payment is required to
          reactivate the storefront.
        </p>

        {formattedDeletionDate && (
          <p className="mt-2.5 text-xs text-neutral-500">
            Scheduled for permanent deletion on <span className="font-medium text-neutral-800">{formattedDeletionDate}</span> unless renewed.
          </p>
        )}

        <a
          href={renewUrl}
          className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1ED760] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#18B953]"
        >
          <span>Complete Payment &amp; Renew</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </main>
    </div>
  );
}

import React from 'react';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

function formatMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Unavailable';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function CloudInvoicePage({ invoice, account, onBack, onCancel, isCancelling = false }) {
  const billingAddress = account.billingAddress || {};
  const customerName = account.companyName || account.billingAccountName || 'Cloud Billing Account';
  const addressLines = [
    billingAddress.address,
    billingAddress.city,
    billingAddress.postalCode,
    billingAddress.country
  ].filter(Boolean);
  const invoiceStatus = String(invoice?.status || '').toLowerCase();
  const isPaid = ['paid', 'verified'].includes(invoiceStatus);
  const isPending = invoiceStatus === 'pending';
  const isClosed = ['cancelled', 'expired', 'failed'].includes(invoiceStatus);
  const canCancel = isPending && String(invoice?.id || '').startsWith('ctu-');
  const currency = invoice?.currency || account.currency || 'USD';
  const statusClass = isPaid
    ? 'bg-[#E6F4EA] text-[#137333] dark:bg-[#12351F] dark:text-[#81C995]'
    : isPending
      ? 'bg-[#FEF7E0] text-[#8D5B00] dark:bg-[#3A2D10] dark:text-[#FDD663]'
      : isClosed
        ? 'bg-[#FCE8E6] text-[#B3261E] dark:bg-[#3C2020] dark:text-[#F28B82]'
        : 'bg-[#F1F3F4] text-[#5F6368] dark:bg-[#2C2D31] dark:text-[#BDC1C6]';

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-6 text-[#202124] dark:bg-[#131314] dark:text-[#E3E3E3] sm:px-8 sm:py-10">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          body * { visibility: hidden !important; }
          .cloud-invoice-print, .cloud-invoice-print * { visibility: visible !important; }
          .cloud-invoice-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #202124 !important;
          }
          .cloud-invoice-print-hidden { display: none !important; }
          .cloud-invoice-print table { page-break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto max-w-[860px]">
        <div className="cloud-invoice-print-hidden mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-[#1A73E8] transition hover:bg-[#E8F0FE] dark:hover:bg-[#202C3D]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </button>
          {invoice && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#1A73E8] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1765CC]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
        </div>

        {!invoice ? (
          <section className="rounded-3xl border border-[#DADCE0] bg-white p-8 text-center shadow-sm dark:border-[#3C4043] dark:bg-[#1E1F22]">
            <h1 className="text-xl font-medium">Invoice not found</h1>
            <p className="mt-2 text-sm text-[#5F6368] dark:text-[#9AA0A6]">
              This invoice is unavailable in the current billing account.
            </p>
            <button type="button" onClick={onBack} className="mt-5 rounded-full bg-[#1A73E8] px-5 py-2.5 text-sm font-medium text-white">
              Back to invoices
            </button>
          </section>
        ) : (
          <article className="cloud-invoice-print overflow-hidden rounded-3xl border border-[#DADCE0] bg-white shadow-[0_8px_32px_rgba(60,64,67,0.12)] dark:border-[#3C4043] dark:bg-[#1E1F22] print:rounded-none print:border-0 print:shadow-none">
            <div className="h-2 bg-[#1A73E8]" />
            <div className="p-6 sm:p-12">
              <header className="flex flex-col justify-between gap-8 border-b border-[#E8EAED] pb-8 dark:border-[#3C4043] sm:flex-row">
                <div>
                  <img src="/tiwlologo.png" alt="Tiwlo" className="mb-6 h-9 w-auto object-contain object-left" />
                  <p className="text-sm font-semibold text-[#202124] dark:text-white">Tiwlo Team</p>
                  <p className="mt-1 text-sm text-[#5F6368] dark:text-[#9AA0A6]">tiwlo.com</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5F6368] dark:text-[#9AA0A6]">Invoice</p>
                  <h1 className="mt-2 break-all text-xl font-medium tracking-tight sm:text-2xl">{invoice.id}</h1>
                  <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {invoice.status || 'Status unavailable'}
                  </span>
                </div>
              </header>

              <section className="grid gap-8 border-b border-[#E8EAED] py-8 dark:border-[#3C4043] sm:grid-cols-2">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5F6368] dark:text-[#9AA0A6]">Billed to</h2>
                  <p className="mt-3 font-medium">{customerName}</p>
                  {account.accountType === 'business' && account.companyName && (
                    <p className="mt-1 text-sm text-[#5F6368] dark:text-[#9AA0A6]">{account.companyName}</p>
                  )}
                  {addressLines.length > 0 && (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#5F6368] dark:text-[#9AA0A6]">
                      {addressLines.join('\n')}
                    </p>
                  )}
                  {billingAddress.phone && (
                    <p className="mt-1 text-sm text-[#5F6368] dark:text-[#9AA0A6]">{billingAddress.phone}</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5F6368] dark:text-[#9AA0A6]">Invoice details</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-[#5F6368] dark:text-[#9AA0A6]">Issue date</dt>
                      <dd className="font-medium sm:min-w-36">{formatDate(invoice.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-[#5F6368] dark:text-[#9AA0A6]">Payment date</dt>
                      <dd className="font-medium sm:min-w-36">{formatDate(invoice.paidAt)}</dd>
                    </div>
                    {canCancel && invoice.expiresAt && (
                      <div className="flex justify-between gap-4 sm:justify-end">
                        <dt className="text-[#5F6368] dark:text-[#9AA0A6]">Checkout expires</dt>
                        <dd className="font-medium sm:min-w-36">{formatDate(invoice.expiresAt)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="text-[#5F6368] dark:text-[#9AA0A6]">Billing account</dt>
                      <dd className="font-mono text-xs sm:min-w-36">{account.billingAccountId || '—'}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              {canCancel && (
                <section className="cloud-invoice-print-hidden mb-8 rounded-xl border border-[#DADCE0] bg-[#F8F9FA] p-5 dark:border-[#3C4043] dark:bg-[#202124]">
                  <h2 className="text-sm font-medium">Checkout actions</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5F6368] dark:text-[#9AA0A6]">
                    This shared invoice page tracks every supported payment method. The provider may keep its hosted page open after cancellation; any completed payment will still be verified and applied to your credit balance.
                  </p>
                  <button
                    type="button"
                    onClick={() => onCancel?.(invoice)}
                    disabled={isCancelling}
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-[#DADCE0] px-5 text-sm font-medium text-[#B3261E] transition hover:bg-[#FCE8E6] disabled:cursor-wait disabled:opacity-60 dark:border-[#5F3B3B] dark:hover:bg-[#3C2020]"
                  >
                    {isCancelling ? 'Cancelling…' : 'Cancel checkout'}
                  </button>
                </section>
              )}

              <section className="py-8">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#DADCE0] text-xs font-semibold uppercase tracking-[0.1em] text-[#5F6368] dark:border-[#3C4043] dark:text-[#9AA0A6]">
                      <th className="py-3 pr-4">Description</th>
                      <th className="py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E8EAED] dark:border-[#3C4043]">
                      <td className="py-5 pr-4 align-top">
                        <p className="font-medium">{invoice.description || 'Cloud billing transaction'}</p>
                        <p className="mt-1 text-xs text-[#5F6368] dark:text-[#9AA0A6]">Reference: {invoice.id}</p>
                      </td>
                      <td className="py-5 text-right align-top font-medium tabular-nums">
                        {formatMoney(Number(invoice.amount), currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="ml-auto mt-6 max-w-sm space-y-3">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-[#5F6368] dark:text-[#9AA0A6]">Subtotal</span>
                    <span className="tabular-nums">{formatMoney(Number(invoice.amount), currency)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[#DADCE0] pt-4 text-base font-semibold dark:border-[#3C4043]">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(Number(invoice.amount), currency)}</span>
                  </div>
                </div>
              </section>

              <footer className="border-t border-[#E8EAED] pt-6 text-sm dark:border-[#3C4043]">
                <p className="font-medium">Thank you for choosing Tiwlo Cloud.</p>
                <p className="mt-1 text-[#5F6368] dark:text-[#9AA0A6]">
                  This document reflects the transaction recorded in your Tiwlo Cloud billing account.
                </p>
                <p className="mt-5 text-xs text-[#80868B]">Tiwlo Team · tiwlo.com</p>
              </footer>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Download,
  ReceiptText
} from 'lucide-react';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
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

function getStatusAppearance(status) {
  if (['paid', 'verified'].includes(status)) {
    return {
      icon: CheckCircle2,
      className: 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333] dark:border-[#234B32] dark:bg-[#12351F] dark:text-[#81C995]'
    };
  }
  if (status === 'pending') {
    return {
      icon: Clock3,
      className: 'border-[#F2DFA7] bg-[#FEF7E0] text-[#8D5B00] dark:border-[#5A4618] dark:bg-[#3A2D10] dark:text-[#FDD663]'
    };
  }
  if (['cancelled', 'expired', 'failed'].includes(status)) {
    return {
      icon: CircleAlert,
      className: 'border-[#F4C7C3] bg-[#FCE8E6] text-[#B3261E] dark:border-[#5A302C] dark:bg-[#3C2020] dark:text-[#F28B82]'
    };
  }
  return {
    icon: ReceiptText,
    className: 'border-[#DADCE0] bg-[#F1F3F4] text-[#5F6368] dark:border-[#3C4043] dark:bg-[#2C2D31] dark:text-[#BDC1C6]'
  };
}

function Detail({ label, children, align = 'left' }) {
  return (
    <div className={align === 'right' ? 'text-left sm:text-right' : ''}>
      <dt className="text-[11px] font-medium text-[#70757A] dark:text-[#9AA0A6]">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium leading-5 text-[#202124] dark:text-[#E8EAED]">{children || '—'}</dd>
    </div>
  );
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
  const isPending = invoiceStatus === 'pending';
  const canCancel = isPending && String(invoice?.id || '').startsWith('ctu-');
  const currency = invoice?.currency || account.currency || 'USD';
  const StatusIcon = getStatusAppearance(invoiceStatus).icon;
  const statusClass = getStatusAppearance(invoiceStatus).className;

  return (
    <main className="min-h-screen bg-[#F6F8FC] px-3 py-4 text-[#202124] dark:bg-[#131416] dark:text-[#E3E3E3] sm:px-6 sm:py-7">
      <style>{`
        @page { size: A4; margin: 14mm; }
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
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #202124 !important;
          }
          .cloud-invoice-print-hidden { display: none !important; }
          .cloud-invoice-print table { page-break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto max-w-[760px]">
        <nav className="cloud-invoice-print-hidden mb-3 flex min-h-10 items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[#1967D2] transition hover:bg-[#E8F0FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] dark:text-[#A8C7FA] dark:hover:bg-[#202C3D]"
          >
            <ArrowLeft className="h-4 w-4" />
            Invoices
          </button>
          {invoice && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#1A73E8] px-4 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#1765CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131416]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
        </nav>

        {!invoice ? (
          <section className="rounded-2xl border border-[#DADCE0] bg-white px-6 py-10 text-center shadow-[0_1px_3px_rgba(60,64,67,0.12)] dark:border-[#3C4043] dark:bg-[#1E1F22]">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F0FE] text-[#1967D2] dark:bg-[#202C3D] dark:text-[#A8C7FA]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-[18px] font-medium tracking-[-0.2px]">Invoice not found</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-[#5F6368] dark:text-[#9AA0A6]">
              This billing document is unavailable in the current account.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-5 min-h-9 rounded-full bg-[#1A73E8] px-4 text-[13px] font-medium text-white hover:bg-[#1765CC]"
            >
              Back to invoices
            </button>
          </section>
        ) : (
          <article className="cloud-invoice-print overflow-hidden rounded-[20px] border border-[#DADCE0] bg-white shadow-[0_2px_8px_rgba(60,64,67,0.12)] dark:border-[#3C4043] dark:bg-[#1E1F22]">
            <div className="h-1 bg-gradient-to-r from-[#4285F4] via-[#1A73E8] to-[#8AB4F8]" />

            <header className="flex flex-col gap-4 border-b border-[#E8EAED] px-5 py-5 dark:border-[#3C4043] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/tiwlologo.png" alt="Tiwlo" className="h-7 w-auto max-w-[96px] object-contain object-left" />
                <span className="h-7 w-px bg-[#DADCE0] dark:bg-[#3C4043]" />
                <div>
                  <p className="text-[13px] font-semibold leading-4 text-[#202124] dark:text-[#E8EAED]">Tiwlo Cloud</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#70757A] dark:text-[#9AA0A6]">Billing document</p>
                </div>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#70757A] dark:text-[#9AA0A6]">Invoice reference</p>
                <p className="mt-1 break-all font-mono text-[12px] font-medium text-[#3C4043] dark:text-[#BDC1C6]">{invoice.id}</p>
              </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:space-y-5 sm:px-7 sm:py-6">
              <section className="flex flex-col gap-4 rounded-2xl border border-[#D2E3FC] bg-[#F8FAFF] px-4 py-4 dark:border-[#263B59] dark:bg-[#1A2433] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="text-[11px] font-medium text-[#5F6368] dark:text-[#9AA0A6]">Total amount</p>
                  <p className="mt-1 text-[28px] font-normal leading-9 tracking-[-0.7px] text-[#202124] dark:text-[#E8EAED] sm:text-[30px]">
                    {formatMoney(Number(invoice.amount), currency)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#70757A] dark:text-[#9AA0A6]">
                    {invoice.description || 'Tiwlo Cloud billing transaction'}
                  </p>
                </div>
                <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium ${statusClass}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {invoice.status || 'Status unavailable'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(invoice.createdAt)}
                  </span>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-[#E8EAED] px-4 py-4 dark:border-[#3C4043] sm:grid-cols-2 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#70757A] dark:text-[#9AA0A6]">Billed to</h2>
                  <p className="mt-2 text-[13px] font-semibold text-[#202124] dark:text-[#E8EAED]">{customerName}</p>
                  {account.accountType === 'business' && account.companyName && account.companyName !== customerName && (
                    <p className="mt-0.5 text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">{account.companyName}</p>
                  )}
                  {addressLines.length > 0 && (
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-[17px] text-[#5F6368] dark:text-[#9AA0A6]">
                      {addressLines.join('\n')}
                    </p>
                  )}
                  {billingAddress.phone && (
                    <p className="mt-0.5 text-[11px] leading-4 text-[#5F6368] dark:text-[#9AA0A6]">{billingAddress.phone}</p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[#E8EAED] pt-3 dark:border-[#3C4043] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <Detail label="Invoice date">{formatDate(invoice.createdAt)}</Detail>
                  <Detail label="Payment date">{formatDate(invoice.paidAt)}</Detail>
                  {canCancel && (
                    <Detail label="Checkout expires">{formatDate(invoice.expiresAt)}</Detail>
                  )}
                  <Detail label="Billing account">{account.billingAccountId}</Detail>
                </dl>
              </section>

              {canCancel && (
                <section className="cloud-invoice-print-hidden flex flex-col gap-3 rounded-2xl border border-[#DADCE0] bg-[#F8F9FA] px-4 py-3 dark:border-[#3C4043] dark:bg-[#202124] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[12px] font-medium text-[#202124] dark:text-[#E8EAED]">Checkout is awaiting provider confirmation</h2>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#5F6368] dark:text-[#9AA0A6]">
                      Cancelling closes this Tiwlo billing session. The provider may keep its hosted page open; verified payments are still applied.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancel?.(invoice)}
                    disabled={isCancelling}
                    className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-[#DADCE0] px-3 text-[11px] font-medium text-[#B3261E] transition hover:bg-[#FCE8E6] disabled:cursor-wait disabled:opacity-60 dark:border-[#5F3B3B] dark:hover:bg-[#3C2020]"
                  >
                    {isCancelling ? 'Cancelling…' : 'Cancel checkout'}
                  </button>
                </section>
              )}

              <section aria-label="Invoice line items">
                <div className="flex items-center justify-between border-b border-[#DADCE0] px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#70757A] dark:border-[#3C4043] dark:text-[#9AA0A6]">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-[#E8EAED] px-1 py-3 dark:border-[#3C4043]">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium leading-5 text-[#202124] dark:text-[#E8EAED]">
                      {invoice.description || 'Cloud billing transaction'}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[10px] leading-4 text-[#70757A] dark:text-[#9AA0A6]">
                      Reference: {invoice.id}
                    </p>
                  </div>
                  <p className="shrink-0 text-[12px] font-medium tabular-nums text-[#202124] dark:text-[#E8EAED]">
                    {formatMoney(Number(invoice.amount), currency)}
                  </p>
                </div>
                <div className="ml-auto grid max-w-[270px] grid-cols-2 gap-x-4 gap-y-1.5 px-1 pt-3 text-[11px]">
                  <span className="text-[#5F6368] dark:text-[#9AA0A6]">Subtotal</span>
                  <span className="text-right tabular-nums">{formatMoney(Number(invoice.amount), currency)}</span>
                  <span className="border-t border-[#E8EAED] pt-2 font-semibold text-[#202124] dark:border-[#3C4043] dark:text-[#E8EAED]">Total</span>
                  <span className="border-t border-[#E8EAED] pt-2 text-right text-[13px] font-semibold tabular-nums text-[#202124] dark:border-[#3C4043] dark:text-[#E8EAED]">
                    {formatMoney(Number(invoice.amount), currency)}
                  </span>
                </div>
              </section>
            </div>

            <footer className="flex flex-col gap-1 border-t border-[#E8EAED] bg-[#FBFCFE] px-5 py-3 dark:border-[#3C4043] dark:bg-[#1A1B1E] sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-[11px] font-medium text-[#3C4043] dark:text-[#BDC1C6]">Thank you for choosing Tiwlo Cloud.</p>
              <p className="text-[10px] text-[#70757A] dark:text-[#9AA0A6]">Tiwlo Team · tiwlo.com</p>
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}

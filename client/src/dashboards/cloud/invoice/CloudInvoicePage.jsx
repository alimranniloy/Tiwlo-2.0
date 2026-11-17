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
  const normalized = String(status || '').trim().toLowerCase();
  if (['paid', 'verified', 'free trial', 'trial', 'free_trial'].includes(normalized)) {
    return {
      icon: CheckCircle2,
      className: 'border-[#CEEAD6] bg-[#E6F4EA] text-[#137333] dark:border-[#234B32] dark:bg-[#12351F] dark:text-[#81C995]'
    };
  }
  if (normalized === 'pending') {
    return {
      icon: Clock3,
      className: 'border-[#F2DFA7] bg-[#FEF7E0] text-[#8D5B00] dark:border-[#5A4618] dark:bg-[#3A2D10] dark:text-[#FDD663]'
    };
  }
  if (['cancelled', 'canceled', 'expired', 'failed'].includes(normalized)) {
    return {
      icon: CircleAlert,
      className: 'border-[#F4C7C3] bg-[#FCE8E6] text-[#B3261E] dark:border-[#5A302C] dark:bg-[#3C2020] dark:text-[#F28B82]'
    };
  }
  return {
    icon: ReceiptText,
    className: 'border-[#dcdcdc] bg-[#F1F3F4] text-[#636363] dark:border-[#3f3f3f] dark:bg-[#2d2d2d] dark:text-[#c1c1c1]'
  };
}

function formatPlanLabel(planId) {
  if (!planId) return '';
  const clean = String(planId).trim();
  const known = {
    free: 'Free Starter',
    growth: 'Growth Retailer',
    pro: 'Pro Business',
    enterprise: 'Enterprise VIP'
  };
  return known[clean.toLowerCase()] || clean.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOrderTypeLabel(orderType) {
  if (!orderType) return '';
  const clean = String(orderType).trim().toLowerCase();
  const known = {
    credit_topup: 'Cloud Credit Top-up',
    voucher_redeem: 'Promotional Voucher',
    subscription_charge: 'Subscription Charge',
    store_creation: 'Store Activation',
    free_trial: 'Free Starter Trial',
    plan_upgrade: 'Plan Upgrade',
    plan_renewal: 'Plan Renewal',
    addon_purchase: 'Store Add-on',
    discord_subscription: 'Discord Bot Subscription',
    whatsapp_subscription: 'WhatsApp Bot Subscription'
  };
  return known[clean] || clean.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Detail({ label, children, align = 'left' }) {
  return (
    <div className={align === 'right' ? 'text-left sm:text-right' : ''}>
      <dt className="text-[11px] font-medium text-[#747474] dark:text-[#9f9f9f]">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium leading-5 text-[#212121] dark:text-[#eaeaea]">{children || '—'}</dd>
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
  const rawStatus = String(invoice?.status || '').trim();
  const invoiceStatus = rawStatus.toLowerCase();
  const isFreeTrial = Boolean(invoice?.isFreeTrial) ||
    ['free trial', 'trial', 'free_trial'].includes(invoiceStatus) ||
    String(invoice?.orderType || '').trim().toLowerCase() === 'free_trial';
  const displayStatus = isFreeTrial && (!rawStatus || ['paid', 'free trial', 'trial', 'free_trial'].includes(invoiceStatus))
    ? 'Free Trial'
    : (rawStatus || 'Status unavailable');
  const isPending = invoiceStatus === 'pending';
  const canCancel = isPending && String(invoice?.id || '').startsWith('ctu-');
  const currency = invoice?.currency || account.currency || 'USD';
  const invoiceAmount = Number(invoice?.amount ?? 0);
  const cashCreditUsed = Number(invoice?.cashCreditUsed || 0);
  const promoCreditUsed = Number(invoice?.promoCreditUsed || 0);
  const hasCreditBreakdown = Number.isFinite(cashCreditUsed) && Number.isFinite(promoCreditUsed) && (cashCreditUsed > 0 || promoCreditUsed > 0);
  const planLabel = formatPlanLabel(invoice?.planId);
  const orderTypeLabel = formatOrderTypeLabel(invoice?.orderType);
  const appearance = getStatusAppearance(isFreeTrial ? 'free trial' : invoiceStatus);
  const StatusIcon = appearance.icon;
  const statusClass = appearance.className;

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-3 py-4 text-[#212121] dark:bg-[#141414] dark:text-[#E3E3E3] sm:px-6 sm:py-7">
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
            color: #212121 !important;
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
            className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-[#5e5e5e] transition hover:bg-[#efefef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#696969] dark:text-[#c4c4c4] dark:hover:bg-[#2b2b2b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Invoices
          </button>
          {invoice && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#696969] px-4 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#5c5c5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#696969] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141414]"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          )}
        </nav>

        {!invoice ? (
          <section className="rounded-2xl border border-[#dcdcdc] bg-white px-6 py-10 text-center shadow-[0_1px_3px_rgba(60,64,67,0.12)] dark:border-[#3f3f3f] dark:bg-[#1f1f1f]">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#efefef] text-[#5e5e5e] dark:bg-[#2b2b2b] dark:text-[#c4c4c4]">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-[18px] font-medium tracking-[-0.2px]">Invoice not found</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-[#636363] dark:text-[#9f9f9f]">
              This billing document is unavailable in the current account.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-5 min-h-9 rounded-full bg-[#696969] px-4 text-[13px] font-medium text-white hover:bg-[#5c5c5c]"
            >
              Back to invoices
            </button>
          </section>
        ) : (
          <article className="cloud-invoice-print overflow-hidden rounded-[20px] border border-[#dcdcdc] bg-white shadow-[0_2px_8px_rgba(60,64,67,0.12)] dark:border-[#3f3f3f] dark:bg-[#1f1f1f]">
            <div className="h-1 bg-gradient-to-r from-[#7f7f7f] via-[#696969] to-[#b0b0b0]" />

            <header className="flex flex-col gap-4 border-b border-[#eaeaea] px-5 py-5 dark:border-[#3f3f3f] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <img src="/tiwlo-light-logo.png" alt="Tiwlo" className="h-7 w-auto max-w-[96px] object-contain object-left dark:hidden" />
                <img src="/tiwlo-dark-bg-logo.png" alt="Tiwlo" className="hidden h-7 w-auto max-w-[96px] object-contain object-left dark:block" />
                <span className="h-7 w-px bg-[#dcdcdc] dark:bg-[#3f3f3f]" />
                <div>
                  <p className="text-[13px] font-semibold leading-4 text-[#212121] dark:text-[#eaeaea]">Tiwlo Cloud</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#747474] dark:text-[#9f9f9f]">Billing document</p>
                </div>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#747474] dark:text-[#9f9f9f]">Invoice reference</p>
                <p className="mt-1 break-all font-mono text-[12px] font-medium text-[#3f3f3f] dark:text-[#c1c1c1]">{invoice.id}</p>
              </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:space-y-5 sm:px-7 sm:py-6">
              <section className="flex flex-col gap-4 rounded-2xl border border-[#e1e1e1] bg-[#fafafa] px-4 py-4 dark:border-[#393939] dark:bg-[#232323] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="text-[11px] font-medium text-[#636363] dark:text-[#9f9f9f]">Total amount</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                    <p className="text-[28px] font-normal leading-9 tracking-[-0.7px] text-[#212121] dark:text-[#eaeaea] sm:text-[30px]">
                      {formatMoney(invoiceAmount, currency)}
                    </p>
                    {isFreeTrial && (
                      <span className="rounded-full border border-[#CEEAD6] bg-[#E6F4EA] px-2 py-0.5 text-[10px] font-semibold text-[#137333] dark:border-[#234B32] dark:bg-[#12351F] dark:text-[#81C995]">
                        Free Trial
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#747474] dark:text-[#9f9f9f]">
                    {invoice.description || 'Tiwlo Cloud billing transaction'}
                  </p>
                </div>
                <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium ${statusClass}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {displayStatus}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#636363] dark:text-[#9f9f9f]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(invoice.createdAt)}
                  </span>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-[#eaeaea] px-4 py-4 dark:border-[#3f3f3f] sm:grid-cols-2 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#747474] dark:text-[#9f9f9f]">Billed to</h2>
                  <p className="mt-2 text-[13px] font-semibold text-[#212121] dark:text-[#eaeaea]">{customerName}</p>
                  {account.accountType === 'business' && account.companyName && account.companyName !== customerName && (
                    <p className="mt-0.5 text-[11px] text-[#636363] dark:text-[#9f9f9f]">{account.companyName}</p>
                  )}
                  {addressLines.length > 0 && (
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-[17px] text-[#636363] dark:text-[#9f9f9f]">
                      {addressLines.join('\n')}
                    </p>
                  )}
                  {billingAddress.phone && (
                    <p className="mt-0.5 text-[11px] leading-4 text-[#636363] dark:text-[#9f9f9f]">{billingAddress.phone}</p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[#eaeaea] pt-3 dark:border-[#3f3f3f] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <Detail label="Invoice date">{formatDate(invoice.createdAt)}</Detail>
                  <Detail label="Payment date">{formatDate(invoice.paidAt || (isFreeTrial ? invoice.createdAt : null))}</Detail>
                  {planLabel && (
                    <Detail label="Plan tier">{planLabel}</Detail>
                  )}
                  {orderTypeLabel && (
                    <Detail label="Order type">{orderTypeLabel}</Detail>
                  )}
                  {canCancel && (
                    <Detail label="Checkout expires">{formatDate(invoice.expiresAt)}</Detail>
                  )}
                  <Detail label="Billing account">{account.billingAccountId}</Detail>
                </dl>
              </section>

              {canCancel && (
                <section className="cloud-invoice-print-hidden flex flex-col gap-3 rounded-2xl border border-[#dcdcdc] bg-[#F8F9FA] px-4 py-3 dark:border-[#3f3f3f] dark:bg-[#212121] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[12px] font-medium text-[#212121] dark:text-[#eaeaea]">Checkout is awaiting provider confirmation</h2>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#636363] dark:text-[#9f9f9f]">
                      Cancelling closes this Tiwlo billing session. The provider may keep its hosted page open; verified payments are still applied.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancel?.(invoice)}
                    disabled={isCancelling}
                    className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-[#dcdcdc] px-3 text-[11px] font-medium text-[#B3261E] transition hover:bg-[#FCE8E6] disabled:cursor-wait disabled:opacity-60 dark:border-[#5F3B3B] dark:hover:bg-[#3C2020]"
                  >
                    {isCancelling ? 'Cancelling…' : 'Cancel checkout'}
                  </button>
                </section>
              )}

              <section aria-label="Invoice line items">
                <div className="flex items-center justify-between border-b border-[#dcdcdc] px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#747474] dark:border-[#3f3f3f] dark:text-[#9f9f9f]">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-[#eaeaea] px-1 py-3 dark:border-[#3f3f3f]">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium leading-5 text-[#212121] dark:text-[#eaeaea]">
                      {invoice.description || 'Cloud billing transaction'}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[10px] leading-4 text-[#747474] dark:text-[#9f9f9f]">
                      Reference: {invoice.id}
                    </p>
                    {(planLabel || orderTypeLabel || isFreeTrial) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#5e5e5e] dark:text-[#b0b0b0]">
                        {orderTypeLabel && (
                          <span className="rounded-md border border-[#e2e2e2] bg-[#f8f8f8] px-2 py-0.5 dark:border-[#3a3a3a] dark:bg-[#262626]">
                            {orderTypeLabel}
                          </span>
                        )}
                        {planLabel && (
                          <span className="rounded-md border border-[#e2e2e2] bg-[#f8f8f8] px-2 py-0.5 dark:border-[#3a3a3a] dark:bg-[#262626]">
                            Plan: {planLabel}
                          </span>
                        )}
                        {isFreeTrial && (
                          <span className="rounded-md border border-[#CEEAD6] bg-[#E6F4EA] px-2 py-0.5 font-medium text-[#137333] dark:border-[#234B32] dark:bg-[#12351F] dark:text-[#81C995]">
                            Free Trial ($0.00)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-medium tabular-nums text-[#212121] dark:text-[#eaeaea]">
                      {formatMoney(invoiceAmount, currency)}
                    </p>
                    {isFreeTrial && (
                      <p className="mt-0.5 text-[10px] font-medium text-[#137333] dark:text-[#81C995]">
                        Free Trial
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-auto grid max-w-[300px] grid-cols-2 gap-x-4 gap-y-1.5 px-1 pt-3 text-[11px]">
                  <span className="text-[#636363] dark:text-[#9f9f9f]">Subtotal</span>
                  <span className="text-right tabular-nums">{formatMoney(invoiceAmount, currency)}</span>
                  {isFreeTrial && (
                    <>
                      <span className="text-[#636363] dark:text-[#9f9f9f]">Plan charge</span>
                      <span className="text-right font-medium text-[#137333] dark:text-[#81C995]">Free Trial ($0.00)</span>
                    </>
                  )}
                  {hasCreditBreakdown && cashCreditUsed > 0 && (
                    <>
                      <span className="text-[#636363] dark:text-[#9f9f9f]">Wallet cash credit used</span>
                      <span className="text-right tabular-nums text-[#212121] dark:text-[#eaeaea]">{formatMoney(cashCreditUsed, currency)}</span>
                    </>
                  )}
                  {hasCreditBreakdown && promoCreditUsed > 0 && (
                    <>
                      <span className="text-[#636363] dark:text-[#9f9f9f]">Promotional credit used</span>
                      <span className="text-right tabular-nums text-[#137333] dark:text-[#81C995]">{formatMoney(promoCreditUsed, currency)}</span>
                    </>
                  )}
                  <span className="border-t border-[#eaeaea] pt-2 font-semibold text-[#212121] dark:border-[#3f3f3f] dark:text-[#eaeaea]">Total</span>
                  <span className="border-t border-[#eaeaea] pt-2 text-right text-[13px] font-semibold tabular-nums text-[#212121] dark:border-[#3f3f3f] dark:text-[#eaeaea]">
                    {formatMoney(invoiceAmount, currency)}
                  </span>
                </div>
              </section>
            </div>

            <footer className="flex flex-col gap-1 border-t border-[#eaeaea] bg-[#FBFCFE] px-5 py-3 dark:border-[#3f3f3f] dark:bg-[#1b1b1b] sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-[11px] font-medium text-[#3f3f3f] dark:text-[#c1c1c1]">Thank you for choosing Tiwlo Cloud.</p>
              <p className="text-[10px] text-[#747474] dark:text-[#9f9f9f]">Tiwlo Team · tiwlo.com</p>
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}

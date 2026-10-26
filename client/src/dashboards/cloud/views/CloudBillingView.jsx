import React, { useEffect, useState } from 'react';
import { getCloudBillingData } from '../graphql/cloudQueries';

export default function CloudBillingView({ currentUser, onBack }) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const [billingState, setBillingState] = useState({
    userId: null,
    loading: true,
    account: null,
    error: ''
  });

  useEffect(() => {
    let active = true;

    getCloudBillingData(userId)
      .then(result => {
        if (!active) return;
        setBillingState({
          userId,
          loading: false,
          account: result?.account || null,
          error: result?.account ? '' : 'Verified billing data is unavailable.'
        });
      })
      .catch(error => {
        console.error('Error loading verified Cloud Billing data:', error);
        if (active) {
          setBillingState({
            userId,
            loading: false,
            account: null,
            error: 'Could not load verified billing records. Please try again later.'
          });
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const hasCurrentUserData = billingState.userId === userId;
  const account = hasCurrentUserData ? billingState.account : null;
  const loading = !hasCurrentUserData || billingState.loading;
  const loadError = hasCurrentUserData ? billingState.error : '';
  const credits = Number.isSafeInteger(account?.credits) && account.credits >= 0
    ? account.credits
    : 0;
  const verifiedInvoices = (Array.isArray(account?.invoices) ? account.invoices : []).filter(invoice =>
    invoice.paymentVerified === true || invoice.grantVerified === true
  );

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-4 py-8 text-[#202124] dark:bg-[#18191C] dark:text-[#E8EAED] sm:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-[#DADCE0] bg-white p-6 dark:border-[#3C4043] dark:bg-[#202124]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Cloud Billing</h1>
              <p className="mt-2 max-w-xl text-sm text-[#5F6368] dark:text-[#9AA0A6]">
                {loading
                  ? 'Loading verified billing records…'
                  : loadError || 'Credit purchases and usage billing are unavailable until verified payment and usage-metering services are configured.'}
              </p>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-[#DADCE0] px-3 py-2 text-sm font-medium hover:bg-[#F1F3F4] dark:border-[#3C4043] dark:hover:bg-[#303134]"
              >
                Back to Cloud Dashboard
              </button>
            )}
          </div>

          {!loading && !loadError && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#DADCE0] p-4 dark:border-[#3C4043]">
                <div className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">Verified available credits</div>
                <div className="mt-1 text-2xl font-semibold">{credits.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-[#DADCE0] p-4 dark:border-[#3C4043]">
                <div className="text-xs text-[#5F6368] dark:text-[#9AA0A6]">Payment method</div>
                <div className="mt-1 text-sm font-medium">No verified payment gateway configured</div>
              </div>
            </div>
          )}
        </section>

        {!loading && !loadError && verifiedInvoices.length > 0 && (
          <section className="rounded-2xl border border-[#DADCE0] bg-white p-6 dark:border-[#3C4043] dark:bg-[#202124]">
            <h2 className="font-semibold">Verified billing records</h2>
            <ul className="mt-3 divide-y divide-[#E8EAED] dark:divide-[#3C4043]">
              {verifiedInvoices.map(invoice => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{invoice.description || invoice.id}</span>
                  <span className="shrink-0 font-medium">{invoice.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

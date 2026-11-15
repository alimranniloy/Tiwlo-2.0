import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { STORE_DOMAIN } from '../../../config/platformConfig';
import useStoreSubdomainAvailability from '../hooks/useStoreSubdomainAvailability';
import { getCloudBillingData } from '../graphql/cloudQueries';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Info,
  Store
} from 'lucide-react';

const STORE_CATEGORIES = [
  'General Retail & Electronics',
  'Fashion & Apparel',
  'Grocery & Supermarket',
  'Pharmacy & Healthcare',
  'Restaurant & Fast Food',
  'Wholesale & Distribution',
  'Digital Products & Services'
];

const CURRENCIES = [
  'BDT (৳)',
  'USD ($)',
  'EUR (€)',
  'GBP (£)'
];

const INITIAL_FORM = {
  storeName: '',
  subdomain: '',
  category: STORE_CATEGORIES[0],
  currency: CURRENCIES[0],
  email: '',
  phone: '',
  address: '',
  city: 'Dhaka',
  country: 'Bangladesh',
  postalCode: '',
  description: '',
  planId: 'free'
};

function getDraftKey(userId) {
  return `tiwlo.createStoreDraft.${userId || 'anon'}`;
}

export default function CreateStoreView({ userId, onBack, onCreateStore, onOpenBilling }) {
  const draftKey = getDraftKey(userId);

  const [step, setStep] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      const parsedStep = Number(saved?.step);
      return [1, 2, 3].includes(parsedStep) ? parsedStep : 1;
    } catch {
      return 1;
    }
  });

  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      return saved?.form ? { ...INITIAL_FORM, ...saved.form } : INITIAL_FORM;
    } catch {
      return INITIAL_FORM;
    }
  });

  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [creditBalance, setCreditBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const subdomainAvailability = useStoreSubdomainAvailability(form.subdomain);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ step, form }));
    } catch {}
  }, [draftKey, step, form]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPackagesLoading(true);
        const [pkgRes, billingData] = await Promise.all([
          fetch('/api/packages', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
          getCloudBillingData(userId).catch(() => null)
        ]);
        if (cancelled) return;
        if (Array.isArray(pkgRes?.packages) && pkgRes.packages.length > 0) {
          setPackages(pkgRes.packages);
        } else {
          setPackages([
            {
              planId: 'free',
              planName: 'Free Starter',
              price: 0,
              productLimit: 50,
              warehouseLimit: 1,
              hasCustomDomain: false,
              description: 'Free *.tiwlo.com subdomain with core POS & inventory.'
            }
          ]);
        }
        const rawCredits = Number(billingData?.account?.credits);
        setCreditBalance(Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 0);
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStoreNameChange = (val) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setForm((prev) => ({ ...prev, storeName: val, subdomain: slug }));
  };

  const selectedPackage = packages.find((p) => p.planId === form.planId) || packages[0] || {
    planId: 'free',
    planName: 'Free Starter',
    price: 0
  };
  const monthlyCost = Number(selectedPackage?.price || 0);
  const hasEnoughCredits = monthlyCost <= 0 || (creditBalance !== null && creditBalance >= monthlyCost);

  const handleNext = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!form.storeName.trim()) {
        setErrorMsg('Store name is required.');
        return;
      }
      if (subdomainAvailability.status !== 'available') {
        setErrorMsg(subdomainAvailability.message || 'Choose a valid, available subdomain.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!form.address.trim() || !form.city.trim() || !form.country.trim()) {
        setErrorMsg('Street address, city, and country are required.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (monthlyCost > 0 && !hasEnoughCredits) {
      setErrorMsg('Insufficient credit balance. Add your credit to continue.');
      return;
    }

    try {
      setSubmitting(true);
      const created = await onCreateStore({
        storeName: form.storeName.trim(),
        category: form.category,
        subdomain: `${form.subdomain.trim()}.${STORE_DOMAIN}`,
        currency: form.currency,
        planId: selectedPackage.planId,
        email: form.email.trim(),
        phone: form.phone.trim(),
        description: form.description.trim(),
        billingDetails: {
          address: form.address.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          phone: form.phone.trim(),
          postalCode: form.postalCode.trim()
        }
      });
      if (!created) throw new Error('The store could not be created.');
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      onBack?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create store. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { id: 1, label: 'Store' },
    { id: 2, label: 'Address' },
    { id: 3, label: 'Package' }
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(draftKey);
            } catch {}
            onBack?.();
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Online Store
        </button>

        <nav aria-label="Setup steps" className="flex items-center gap-2">
          {steps.map((item, idx) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <React.Fragment key={item.id}>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                      done
                        ? 'border-[#1ed760] bg-[#1ed760] text-black'
                        : active
                          ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : item.id}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      active || done
                        ? 'text-neutral-950 dark:text-white'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <span className="h-px w-5 bg-neutral-200 dark:bg-neutral-800" />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex items-center gap-3 border-b border-neutral-100 pb-5 dark:border-neutral-800">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
              Create your store
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {step === 1 && 'Step 1 of 3 — Enter your store name, subdomain, and currency.'}
              {step === 2 && 'Step 2 of 3 — Add your business contact and store address.'}
              {step === 3 && 'Step 3 of 3 — Choose a monthly package for your store.'}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <Info className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Store Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.storeName}
                  onChange={(e) => handleStoreNameChange(e.target.value)}
                  placeholder="e.g. Urban Threads"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:focus:border-neutral-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Store Subdomain *
                </label>
                <div className="flex h-10 overflow-hidden rounded-lg border border-neutral-200 bg-white focus-within:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:focus-within:border-neutral-400">
                  <input
                    type="text"
                    required
                    value={form.subdomain}
                    onChange={(e) => updateField('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="urban-threads"
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-950 outline-none dark:text-white"
                  />
                  <span className="flex items-center border-l border-neutral-200 bg-neutral-50 px-3 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                    .{STORE_DOMAIN}
                  </span>
                </div>
                {subdomainAvailability.message && (
                  <p
                    className={`mt-1.5 text-xs ${
                      subdomainAvailability.status === 'available'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : subdomainAvailability.status === 'checking'
                          ? 'text-neutral-500'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {subdomainAvailability.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  >
                    {STORE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => updateField('currency', e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  >
                    {CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>{cur}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="orders@yourstore.com"
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+880 1700-000000"
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="House, Road, Area"
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => updateField('postalCode', e.target.value)}
                    placeholder="1205"
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Store Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Short description of what your store sells"
                  className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <CreditCard className="h-4 w-4 text-neutral-500" />
                  <span>Available Cloud Credits</span>
                </div>
                <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {creditBalance === null ? '—' : `$${creditBalance.toFixed(2)}`}
                </span>
              </div>

              {packagesLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {packages.map((pkg) => {
                    const selected = form.planId === pkg.planId;
                    const price = Number(pkg.price || 0);
                    return (
                      <button
                        key={pkg.planId}
                        type="button"
                        onClick={() => {
                          setErrorMsg('');
                          updateField('planId', pkg.planId);
                        }}
                        className={`flex flex-col justify-between rounded-lg border p-4 text-left transition ${
                          selected
                            ? 'border-neutral-950 bg-neutral-50 dark:border-[#1ed760] dark:bg-neutral-950'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {pkg.planName}
                            </span>
                            <span className="text-sm font-bold text-neutral-950 dark:text-white">
                              {price === 0 ? 'Free' : `$${price}/mo`}
                            </span>
                          </div>
                          {pkg.description && (
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                          <span>{pkg.productLimit >= 999999 ? 'Unlimited products' : `${pkg.productLimit} products`}</span>
                          <span>·</span>
                          <span>{pkg.warehouseLimit} warehouse{pkg.warehouseLimit > 1 ? 's' : ''}</span>
                          {pkg.hasCustomDomain && (
                            <>
                              <span>·</span>
                              <span>Custom domain</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {monthlyCost > 0 && !hasEnoughCredits && (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Add your credit
                      </p>
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {selectedPackage.planName} requires ${monthlyCost.toFixed(2)}/mo in Cloud Credits. Your current balance is ${(creditBalance || 0).toFixed(2)}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenBilling?.('credits')}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653]"
                  >
                    Add your credit
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-neutral-100 pt-5 dark:border-neutral-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep((s) => Math.max(1, s - 1));
                }}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1ed760] px-5 text-xs font-semibold text-black transition hover:bg-[#16c653]"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || (monthlyCost > 0 && !hasEnoughCredits)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1ed760] px-5 text-xs font-semibold text-black transition hover:bg-[#16c653] disabled:opacity-50"
              >
                {submitting ? 'Creating store...' : monthlyCost > 0 ? `Pay $${monthlyCost}/mo & Create Store` : 'Create Free Store'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

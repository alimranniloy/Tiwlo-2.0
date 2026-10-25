import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  FileText,
  Image,
  LoaderCircle,
  PackagePlus,
  RefreshCw,
  Store,
  Tags,
  Truck
} from 'lucide-react';

const setupSteps = [
  {
    id: 'store-profile',
    title: 'Store details',
    description: 'Add a store name and a way for customers to contact you.',
    tab: 'store-identity',
    icon: Store
  },
  {
    id: 'product',
    title: 'Add a product',
    description: 'Add a product with a photo, price, and available stock.',
    tab: 'add-product',
    icon: PackagePlus
  },
  {
    id: 'category',
    title: 'Organize your catalog',
    description: 'Create at least one category so shoppers can browse your products.',
    tab: 'categories',
    icon: Tags
  },
  {
    id: 'banner',
    title: 'Set your homepage banner',
    description: 'Add an active banner to introduce your store.',
    tab: 'store-banners',
    icon: Image
  },
  {
    id: 'payment',
    title: 'Set up payments',
    description: 'Enable at least one payment provider with saved credentials.',
    tab: 'payments',
    icon: CreditCard
  },
  {
    id: 'shipping',
    title: 'Configure shipping',
    description: 'Set a shipping zone or a flat shipping rate.',
    tab: 'shipping',
    icon: Truck
  }
];

const recommendedSteps = [
  {
    id: 'pages',
    title: 'Add store policies',
    description: 'Publish useful pages such as returns, privacy, and terms in your store menus.',
    tab: 'store-pages',
    icon: FileText
  },
  {
    id: 'logo',
    title: 'Add your store logo',
    description: 'Make your brand recognizable across the storefront.',
    tab: 'store-identity',
    icon: Store
  }
];

function hasContactDetails(settings) {
  const storeName = typeof settings.storeName === 'string' ? settings.storeName.trim() : '';
  const hasName = Boolean(storeName) && !['your store', 'tiwlomart'].includes(storeName.toLowerCase());
  const hasContact = Boolean(
    (typeof settings.contactEmail === 'string' && settings.contactEmail.trim()) ||
    (typeof settings.contactPhone === 'string' && settings.contactPhone.trim())
  );
  return hasName && hasContact;
}

function hasProductReady(products) {
  return products.some(product => {
    const hasName = typeof product?.name === 'string' && Boolean(product.name.trim());
    const price = Number(product?.price);
    const hasPrice = product?.price !== '' && product?.price !== null &&
      product?.price !== undefined && Number.isFinite(price) && price >= 0;
    const hasImage = Boolean(product?.image || (Array.isArray(product?.images) && product.images.some(Boolean)));
    const stock = Number(product?.stock);
    const hasAvailableStock = Number.isFinite(stock) && stock > 0;
    return hasName && hasPrice && hasImage && hasAvailableStock;
  });
}

function hasActiveBanner(settings) {
  return (Array.isArray(settings.heroBanners) ? settings.heroBanners : []).some(banner =>
    banner?.active !== false &&
    typeof banner?.title === 'string' && Boolean(banner.title.trim()) &&
    typeof banner?.image === 'string' && Boolean(banner.image.trim())
  );
}

function hasPaymentReady(providers) {
  return providers.some(provider => provider?.enabled === true && provider?.configured === true);
}

function hasNonNegativeAmount(value) {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return false;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function hasShippingReady(settings) {
  const hasFlatRate = hasNonNegativeAmount(settings.shippingFlatRate);
  const hasZone = (Array.isArray(settings.shippingZones) ? settings.shippingZones : []).some(zone => {
    if (!zone || zone.enabled === false || !hasNonNegativeAmount(zone.rate)) {
      return false;
    }
    if (Array.isArray(zone.destinations)) {
      return zone.destinations.some(destination => destination?.enabled !== false);
    }
    return Array.isArray(zone.countries) && zone.countries.length > 0;
  });
  return hasFlatRate || hasZone;
}

export default function StoreSetupChecklist({
  products = [],
  categories = [],
  inventoryLoading = false,
  onNavigateTab,
  onVisitSite
}) {
  const [settings, setSettings] = useState(null);
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSetupData = async () => {
      try {
        const [settingsResponse, providersResponse] = await Promise.all([
          fetch('/api/store/settings'),
          fetch('/api/store/payment-providers')
        ]);
        const [settingsData, providersData] = await Promise.all([
          settingsResponse.json().catch(() => ({})),
          providersResponse.json().catch(() => ({}))
        ]);
        if (!settingsResponse.ok) {
          throw new Error(settingsData.error || `Store settings request failed with HTTP ${settingsResponse.status}.`);
        }
        if (!providersResponse.ok) {
          throw new Error(providersData.error || `Payment settings request failed with HTTP ${providersResponse.status}.`);
        }
        if (!settingsData || typeof settingsData !== 'object' || Array.isArray(settingsData) ||
            !Array.isArray(providersData.providers)) {
          throw new Error('The store setup response was incomplete. Please try again.');
        }
        if (!active) return;
        setSettings(settingsData);
        setProviders(providersData.providers);
      } catch (error) {
        if (active) setLoadError(error.message || 'Could not load store setup status.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSetupData();
    return () => { active = false; };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setLoadError('');
    setReloadKey(current => current + 1);
  };

  const completedSteps = useMemo(() => {
    if (!settings || !providers) return {};
    return {
      'store-profile': hasContactDetails(settings),
      product: !inventoryLoading && hasProductReady(products),
      category: !inventoryLoading && categories.some(category =>
        typeof category?.name === 'string' && Boolean(category.name.trim())
      ),
      banner: hasActiveBanner(settings),
      payment: hasPaymentReady(providers),
      shipping: hasShippingReady(settings)
    };
  }, [categories, inventoryLoading, products, providers, settings]);
  const recommendedComplete = useMemo(() => {
    if (!settings) return {};
    return {
      pages: Array.isArray(settings.storePages) && settings.storePages.some(page =>
        page?.enabled !== false && Boolean(String(page.title || '').trim()) && Boolean(String(page.content || '').trim())
      ),
      logo: typeof settings.storeLogo === 'string' && Boolean(settings.storeLogo.trim())
    };
  }, [settings]);
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const allComplete = completedCount === setupSteps.length && !loading && !inventoryLoading && !loadError;
  const nextStep = setupSteps.find(step => !completedSteps[step.id]) || setupSteps[0];
  const hiddenCompletedCount = setupSteps.filter(step => completedSteps[step.id]).length;
  const visibleSteps = setupSteps.filter(step => !completedSteps[step.id]);
  const setupLoading = loading || inventoryLoading;

  const renderStep = (step, complete, recommended = false) => {
    const Icon = step.icon;
    return (
      <button
        key={step.id}
        type="button"
        onClick={() => onNavigateTab(step.tab)}
        className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
        aria-label={`${complete ? 'Review' : 'Complete'} ${step.title}`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          complete ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-slate-300'
        }`}>
          {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {step.title}
            {recommended && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-gray-700 dark:text-slate-300">
                Recommended
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{step.description}</span>
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
          complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'
        }`}>
          {complete ? 'Done' : 'Set up'}
          {!complete && <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />}
        </span>
      </button>
    );
  };

  return (
    <section
      aria-labelledby="store-setup-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-gray-700 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            allComplete ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
          }`}>
            {allComplete ? <Check className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 id="store-setup-title" className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              {allComplete ? 'Your store is ready' : 'Finish setting up your store'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {allComplete
                ? 'The essentials are in place. You can revisit any step below.'
                : 'Complete these essentials so customers can browse, pay, and receive orders.'}
            </p>
          </div>
        </div>
        {setupLoading ? (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Checking setup
          </span>
        ) : !loadError && (
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              allComplete
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
            }`}>
              {completedCount} of {setupSteps.length} complete
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab(nextStep.tab)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {allComplete ? 'Review setup' : 'Complete setup'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Refresh setup status"
              title="Refresh setup status"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:text-slate-300 dark:hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="px-5 py-5 sm:px-6">
          <div
            className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"
            role="progressbar"
            aria-label="Store setup progress"
            aria-valuemin={0}
            aria-valuemax={setupSteps.length}
            aria-valuenow={completedCount}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${allComplete ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${(completedCount / setupSteps.length) * 100}%` }}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {visibleSteps.map(step => renderStep(step, Boolean(completedSteps[step.id])))}
          </div>
          {!showCompleted && hiddenCompletedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCompleted(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ChevronDown className="h-4 w-4" />
              Show {hiddenCompletedCount} completed {hiddenCompletedCount === 1 ? 'step' : 'steps'}
            </button>
          )}
          {showCompleted && (
            <>
              <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-gray-700">
                {setupSteps.filter(step => completedSteps[step.id]).map(step =>
                  renderStep(step, true)
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCompleted(false)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ChevronUp className="h-4 w-4" />
                Hide completed steps
              </button>
            </>
          )}
          {!loading && !loadError && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recommended before launch
                </h3>
                {onVisitSite && (
                  <button
                    type="button"
                    onClick={onVisitSite}
                    className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    Preview storefront
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {recommendedSteps.map(step => renderStep(step, Boolean(recommendedComplete[step.id]), true))}
              </div>
            </div>
          )}
          {setupLoading && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Setup checks are loading. Product progress will update as your inventory loads.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

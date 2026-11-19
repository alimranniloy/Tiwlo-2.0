import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Cookie,
  FileText,
  Lock,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { PLATFORM_DOMAIN, SUPPORT_EMAIL, getPlatformUrl } from '../config/platformConfig';

const POLICY_TABS = [
  { id: 'privacy-policy', label: 'Privacy Policy', icon: ShieldCheck },
  { id: 'terms', label: 'Terms of Service', icon: FileText },
  { id: 'cookie-policy', label: 'Cookie Policy', icon: Cookie },
  { id: 'security-policy', label: 'Data Security & SLA', icon: Lock },
];

const LAST_UPDATED = 'November 19, 2026';

export default function LegalPolicyView({
  initialSection = 'privacy-policy',
  onBack,
  onNavigate,
}) {
  const normalizedInitial = POLICY_TABS.some((t) => t.id === initialSection)
    ? initialSection
    : 'privacy-policy';
  const [section, setSection] = useState(normalizedInitial);

  useEffect(() => {
    if (POLICY_TABS.some((t) => t.id === initialSection)) {
      setSection(initialSection);
    }
  }, [initialSection]);

  const handleSelectSection = (id) => {
    setSection(id);
    try {
      window.history.pushState(null, '', `/${id}`);
    } catch {}
    onNavigate?.(id);
  };

  const domain = PLATFORM_DOMAIN || 'tiwlo.com';
  const contactEmail = SUPPORT_EMAIL || 'support@tiwlo.com';

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <a
                href={getPlatformUrl('/')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Home</span>
              </a>
            )}
            <img src="/tiwlo-light-logo.png" alt="Tiwlo" className="h-5 w-auto object-contain dark:hidden" />
            <img src="/tiwlo-dark-bg-logo.png" alt="Tiwlo" className="hidden h-5 w-auto object-contain dark:block" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Left Navigation Sidebar (Shadcn UI) */}
          <aside className="space-y-2 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Tiwlo Legal &amp; Compliance
              </p>
              <nav className="space-y-1">
                {POLICY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = section === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectSection(tab.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-[#1ED760] text-black font-semibold'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 text-xs space-y-1.5">
              <p className="font-semibold text-neutral-950 dark:text-white">Privacy Officer Contact</p>
              <p className="text-neutral-500 dark:text-neutral-400">
                For GDPR/CCPA data requests, deletion, or compliance questions:
              </p>
              <a href={`mailto:${contactEmail}`} className="block font-medium text-emerald-600 dark:text-[#1ED760] hover:underline break-all">
                {contactEmail}
              </a>
              <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
                <a
                  href="/delete-account"
                  onClick={(e) => {
                    if (onNavigate) {
                      e.preventDefault();
                      try {
                        window.history.pushState(null, '', '/delete-account');
                      } catch {}
                      onNavigate('delete-account');
                    }
                  }}
                  className="inline-flex items-center font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Account &amp; Data Deletion →
                </a>
              </div>
              <p className="pt-1 text-[11px] text-neutral-400">Effective: {LAST_UPDATED}</p>
            </div>
          </aside>

          {/* Main Policy Content Card */}
          <article className="lg:col-span-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 sm:p-8 space-y-6">
            {section === 'privacy-policy' && (
              <div className="space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                  <span className="inline-flex rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                    Tiwlo Cloud &amp; Commerce Platform ({domain})
                  </span>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                    Privacy Policy
                  </h1>
                  <p className="mt-1 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
                </div>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">1. Scope &amp; Data Controller</h2>
                  <p>
                    Tiwlo Technologies Inc. (&ldquo;Tiwlo&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) provides cloud infrastructure, online storefront hosting, POS management, Workspace messaging, identity services, and the <strong>PICK</strong> mobile ecosystem (<strong>PICK Customer App</strong> <code>com.pick.tiwlo</code> and <strong>PICK Delivery Partner App</strong> <code>com.pick.delivery</code>) across <strong>{domain}</strong> and its subdomains. When you create an account or use our web or mobile services, Tiwlo acts as the Data Controller for account, delivery, billing, and security records, and as a Data Processor for merchant storefront orders.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">2. Information We Collect</h2>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Account &amp; Identity Data:</strong> Full name, verified email address, phone number, country/region, encrypted credentials, optional avatar, and isolated Billing/Tiwlo ID shared across Tiwlo, PICK, and PICK Delivery.</li>
                    <li><strong>Location Data (PICK &amp; PICK Delivery):</strong> Delivery addresses, map coordinates, and GPS fixes. In <strong>PICK (`com.pick.tiwlo`)</strong>, foreground location is used only when you choose or verify a delivery address and check service coverage. In <strong>PICK Delivery (`com.pick.delivery`)</strong>, foreground and background location (`ACCESS_BACKGROUND_LOCATION`) are collected <strong>only while you are actively on duty</strong>, even when the app is closed or minimized, to match nearby parcel/grocery jobs and provide live tracking to customers.</li>
                    <li><strong>Camera &amp; Verification Data:</strong> Camera access and verification photos are used solely when you complete identity/address verification or upload parcel delivery proof. We do not use biometric or verification media for advertising.</li>
                    <li><strong>Authentication &amp; Security Telemetry:</strong> Session identifiers, Two-Factor Authentication status (Email OTP / TOTP authenticator configuration), push notification tokens, IP address, and device headers used to prevent unauthorized access and account abuse.</li>
                    <li><strong>Merchant &amp; Order Content:</strong> Storefront catalogs, grocery/parcel orders, delivery status, customer/supplier records, and Workspace operational logs.</li>
                    <li><strong>Billing &amp; Communication Preferences:</strong> Payment gateway transaction references (processed through PCI-compliant third-party processors — Tiwlo never stores raw full card PANs), billing address, and explicit marketing vs transactional email choices managed in Profile Settings.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">3. Legal Basis &amp; How We Use Information</h2>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li><strong>Contract Performance:</strong> Provisioning stores, droplets, email/social services, fulfilling PICK grocery and parcel deliveries, dispatching nearby delivery partners, and processing payments requested by you.</li>
                    <li><strong>Security &amp; Fraud Prevention:</strong> Detecting impossible-travel logins, rate-limiting abuse, enforcing Two-Factor Authentication, and preserving audit trails under legitimate interest and legal compliance.</li>
                    <li><strong>Marketing &amp; Service Notices (Consent-Driven):</strong> Transactional receipts, delivery status alerts, and critical security notices are sent as required for service operation; promotional/product updates are sent only when enabled in your Notification Preferences.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">4. Multi-Tenant Isolation &amp; Data Sharing</h2>
                  <p>
                    Each merchant storefront and Workspace team directory is strictly isolated by owner account ID (`ownerUserId` / `tiwiId`). We never sell personal data to third-party data brokers or advertisers. Sub-processors (payment gateways, map/geocoding providers, push notification services, SMTP mail relays, cloud nodes) receive only the minimum payload required to execute your requested operation under confidentiality obligations.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">5. Retention, Account Deletion &amp; Your Privacy Rights</h2>
                  <p>
                    You have the right to access, export (via <strong>Workspace Data Export</strong>), rectify (via <strong>Profile Settings</strong>), restrict marketing communications, revoke active sessions, or permanently delete your account. Because Tiwlo is the central identity provider, deleting your Tiwlo account automatically deletes your linked <strong>PICK Customer</strong> and <strong>PICK Delivery</strong> profiles, saved addresses, active sessions, and storefront data.
                  </p>
                  <p>
                    You can delete your account at any time in-app (from <strong>Profile → Delete Account</strong> in PICK / PICK Delivery or <strong>User Settings</strong> on {domain}) or directly via our dedicated deletion portal:{' '}
                    <a
                      href="/delete-account"
                      onClick={(e) => {
                        if (onNavigate) {
                          e.preventDefault();
                          try {
                            window.history.pushState(null, '', '/delete-account');
                          } catch {}
                          onNavigate('delete-account');
                        }
                      }}
                      className="font-semibold text-emerald-600 dark:text-[#1ED760] hover:underline"
                    >
                      https://{domain}/delete-account
                    </a>
                    . Statutory financial and fraud-prevention records may be retained only where required by law (typically up to 7 years for settled billing invoices). Contact <a href={`mailto:${contactEmail}`} className="font-medium text-emerald-600 dark:text-[#1ED760] hover:underline">{contactEmail}</a> with any privacy request.
                  </p>
                </section>
              </div>
            )}

            {section === 'terms' && (
              <div className="space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                    Terms of Service
                  </h1>
                  <p className="mt-1 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
                </div>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">1. Account Eligibility &amp; Security Responsibilities</h2>
                  <p>
                    You must provide truthful registration information and safeguard your password, Security PIN, and Two-Factor Authentication credentials. When granting access via <strong>Team Management</strong>, you remain responsible for permissions assigned to your staff members and all actions taken under your account.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">2. Acceptable Use &amp; Platform Integrity</h2>
                  <p>
                    Merchants and Workspace operators may not use {domain} for unlawful goods, phishing, spam campaigns, credential harvesting, multi-account abuse of free tiers, or automated vulnerability probing. Accounts violating acceptable use or payment compliance may be restricted pending review.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">3. Subscriptions, Credits &amp; Store Plans</h2>
                  <p>
                    Storefront plans and Cloud Wallet credits are billed transparently in your selected settlement currency using live verified exchange rates. Plan upgrades, gateway charges, and refund rules follow the terms disclosed prior to checkout.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">4. Intellectual Property &amp; Merchant Content</h2>
                  <p>
                    You retain full ownership of product catalogs, brand assets, and store data uploaded to Tiwlo. You grant Tiwlo a limited license solely to host, index, back up, and serve your content as configured by your Storefront &amp; Workspace settings.
                  </p>
                </section>
              </div>
            )}

            {section === 'cookie-policy' && (
              <div className="space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                    Cookie &amp; Session Storage Policy
                  </h1>
                  <p className="mt-1 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
                </div>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">1. Strictly Necessary Authentication Cookies</h2>
                  <p>
                    Tiwlo uses `HttpOnly`, `SameSite`, and CSRF-protected session cookies across <strong>{domain}</strong> subdomains (`auth.`, `dashboards.`, storefront domains) to keep your authenticated session secure and prevent cross-site request forgery.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">2. Functional Workspace Preferences</h2>
                  <p>
                    Local/session storage preserves active store selection, dark/light theme preference, and widget density so your console responds smoothly without third-party advertising trackers.
                  </p>
                </section>
              </div>
            )}

            {section === 'security-policy' && (
              <div className="space-y-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                    Security Controls &amp; Responsible Disclosure
                  </h1>
                  <p className="mt-1 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
                </div>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">1. Account Protection Architecture</h2>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Password and Security PIN credentials are salted and hashed with cryptographic key derivation (`scrypt`).</li>
                    <li>RFC 6238 TOTP Authenticator App verification with hashed recovery codes and Email OTP fallback.</li>
                    <li>Strict tenant ownership checks on stores, droplets, billing invoices, and user-level Team Management.</li>
                    <li>Re-authentication grants and immutable audit trails for privileged actions.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="text-base font-semibold text-neutral-950 dark:text-white">2. Vulnerability Reporting</h2>
                  <p>
                    Report security issues responsibly to <a href={`mailto:${contactEmail}`} className="font-medium text-emerald-600 dark:text-[#1ED760] hover:underline">{contactEmail}</a> with reproduction steps. Do not exfiltrate or modify third-party tenant data.
                  </p>
                </section>
              </div>
            )}
          </article>
        </div>
      </main>
    </div>
  );
}

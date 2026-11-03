import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Check,
  Cloud,
  Database,
  Globe,
  Layers,
  Lock,
  Menu,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
  Zap,
} from 'lucide-react';

const products = [
  {
    title: 'Cloud Compute',
    body: 'Manage your cloud workspace and services from your Tiwlo account.',
    icon: Server,
    destination: 'dashboard',
  },
  {
    title: 'Commerce Storefront',
    body: 'Bring your products and online storefront together in one place.',
    icon: Store,
    destination: 'store',
  },
  {
    title: 'Retail & POS',
    body: 'Explore the tools for managing in-person sales and retail workflows.',
    icon: MonitorSmartphone,
    destination: 'pos',
  },
  {
    title: 'Cloud Database',
    body: 'Keep your cloud services and workspace tools connected to your account.',
    icon: Database,
    destination: 'dashboard',
  },
  {
    title: 'Domains & identity',
    body: 'Manage your profile and account settings from one workspace.',
    icon: Globe,
    destination: 'oneprofile',
  },
];

const cloudTools = [
  {
    name: 'Cloud workspace',
    tag: 'YOUR SERVICES',
    description: 'Open your cloud dashboard to manage the services available to your account.',
    features: ['A dedicated cloud dashboard', 'Services in one workspace', 'Account-level access'],
  },
  {
    name: 'Domains & profile',
    tag: 'MAKE IT YOURS',
    description: 'Manage your profile and domain-related tools from your Tiwlo workspace.',
    features: ['Profile and account settings', 'Domain management tools', 'One place for your details'],
  },
  {
    name: 'Business tools',
    tag: 'ROOM TO GROW',
    description: 'Explore the tools that support your store and everyday business workflows.',
    features: ['Commerce and retail tools', 'Connected account experience', 'Access from your dashboard'],
  },
];

const commerce = [
  {
    title: 'Retail & POS',
    body: 'Explore the tools for everyday retail workflows and in-person sales.',
    points: ['Retail workspace', 'Product and sales workflows', 'Customer and supplier tools'],
    icon: Barcode,
    destination: 'pos',
  },
  {
    title: 'Online storefront',
    body: 'Bring your products into a storefront that represents your business.',
    points: ['Storefront management', 'Product catalog tools'],
    icon: Store,
    destination: 'store',
  },
  {
    title: 'Commerce workspace',
    body: 'Keep your commerce tools close to the rest of your Tiwlo workspace.',
    points: ['One account experience', 'Online and in-person workflows'],
    icon: ShoppingBag,
    destination: 'store',
  },
  {
    title: 'Inventory tools',
    body: 'Manage product and stock workflows from your business workspace.',
    points: ['Product organization', 'Inventory management tools', 'Retail workflows'],
    icon: Layers,
    destination: 'pos',
  },
];

const benefits = [
  {
    title: 'Your tools, together.',
    body: 'Bring your store, retail, and cloud tools into one thoughtful workspace.',
    icon: Zap,
  },
  {
    title: 'A flexible workspace.',
    body: 'Open Tiwlo from a desktop, tablet, or phone and get to the tools you use.',
    icon: RefreshCw,
  },
  {
    title: 'Your account. Your space.',
    body: 'Use your account to access the Tiwlo products and settings available to you.',
    icon: Lock,
  },
  {
    title: 'Built around your business.',
    body: 'Choose the tools that fit the way you manage your everyday work.',
    icon: ShieldCheck,
  },
  {
    title: 'Store and retail tools.',
    body: 'Explore the storefront and POS experiences from your Tiwlo workspace.',
    icon: Store,
  },
  {
    title: 'Cloud services.',
    body: 'Find your cloud workspace and related services from your dashboard.',
    icon: Cloud,
  },
];

const faqs = [
  {
    question: 'What can I do with Tiwlo?',
    answer:
      'Tiwlo brings together commerce, retail, and cloud tools. Choose the products that fit your work and access them through your account.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Create an account, verify your email, and complete the account setup. You can then open your workspace and explore the available tools.',
  },
  {
    question: 'Can I use Tiwlo on my phone?',
    answer:
      'Yes. Tiwlo pages adapt to phones, tablets, and larger screens, so you can open your workspace in a browser.',
  },
  {
    question: 'Where can I compare plans?',
    answer:
      'Open the pricing page to review the available plans and features for your account.',
  },
  {
    question: 'Where can I get help?',
    answer:
      'Visit the help and support page to find assistance with your account and Tiwlo workspace.',
  },
];

function Logo({ inverted = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center"
      aria-label="Tiwlo home"
    >
      <img
        src={inverted ? '/tiwlo-dark-bg-logo.png' : '/tiwlo-light-logo.png'}
        alt="Tiwlo"
        className="h-8 w-auto max-w-[150px] object-contain"
      />
    </button>
  );
}

function SectionHeading({ eyebrow, title, body, inverted = false }) {
  return (
    <div className="max-w-2xl">
      <p
        className={`text-sm font-semibold uppercase tracking-widest ${
          inverted ? 'text-[#1ed760]' : 'text-[#0f7a37]'
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-5xl">
        {title}
      </h2>
      {body && (
        <p
          className={`mt-4 text-pretty text-lg ${
            inverted ? 'text-white/65' : 'text-[#6a6a6a]'
          }`}
        >
          {body}
        </p>
      )}
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 -z-10 size-44 rounded-full border-[18px] border-[#1ed760]/65 blur-[3px] sm:-right-12 sm:-top-12 sm:size-72 sm:border-[34px] sm:blur-[5px]"
      />
      <img
        src="/landing-cloud-dashboard.png"
        alt="Tiwlo Cloud dashboard"
        className="relative block h-auto w-full rounded-[2%] object-cover lg:max-h-[360px] lg:object-cover"
        fetchPriority="high"
      />
    </div>
  );
}

function ProductSection({ onNavigate }) {
  return (
    <section id="products" className="scroll-mt-24 bg-[#f4f4f4]/70 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Products"
          title="Everything your business runs on, in one console."
          body="Explore commerce, retail, cloud, and account tools from your Tiwlo workspace."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {products.map((product, index) => (
            <button
              key={product.title}
              type="button"
              onClick={() => onNavigate(product.destination)}
              className={`group flex flex-col justify-between gap-10 rounded-3xl p-6 text-left transition hover:-translate-y-0.5 ${
                index === 0
                  ? 'bg-[#121212] text-white sm:col-span-2 lg:col-span-2'
                  : 'bg-white ring-1 ring-[#e4e4e4] hover:ring-[#121212]'
              }`}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-full ${
                  index === 0 ? 'bg-[#1ed760] text-[#121212]' : 'bg-[#f4f4f4]'
                }`}
              >
                <product.icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-bold">{product.title}</span>
                <span
                  className={`mt-2 block text-sm leading-relaxed ${
                    index === 0 ? 'text-white/65' : 'text-[#6a6a6a]'
                  }`}
                >
                  {product.body}
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold">
                  Explore <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CloudSection({ onNavigate }) {
  return (
    <section id="cloud" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Cloud workspace"
            title="A clearer view of your digital world."
            body="Open your workspace and explore the cloud and account tools available to you."
          />
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-[#121212] px-6 text-sm font-bold text-white transition hover:bg-[#121212]/85"
          >
            <Plus className="size-4" aria-hidden="true" /> Open your workspace
          </button>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {cloudTools.map((tool, index) => (
            <article
              key={tool.name}
              className={`flex flex-col rounded-3xl p-7 ${
                index === 0 ? 'bg-[#1ed760] text-[#121212]' : 'bg-[#f4f4f4]'
              }`}
            >
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  index === 0 ? 'bg-[#121212] text-white' : 'bg-white'
                }`}
              >
                {tool.tag}
              </span>
              <h3 className="mt-6 text-2xl font-bold tracking-tight">{tool.name}</h3>
              <p
                className={`mt-3 text-sm leading-relaxed ${
                  index === 0 ? 'text-[#121212]/70' : 'text-[#6a6a6a]'
                }`}
              >
                {tool.description}
              </p>
              <ul className="mt-6 flex flex-col gap-3 border-t border-current/10 pt-6">
                {tool.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm font-medium">
                    <Check className="mt-0.5 size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommerceSection({ onNavigate }) {
  return (
    <section id="commerce" className="scroll-mt-24 bg-[#121212] py-20 text-white sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            inverted
            eyebrow="Commerce"
            title="Sell online and in-store from one catalog."
            body="Explore the storefront, retail, and inventory tools available in your Tiwlo workspace."
          />
          <button
            type="button"
            onClick={() => onNavigate('store')}
            className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-[#1ed760] px-6 text-sm font-bold text-[#121212] transition hover:bg-[#1ed760]/85"
          >
            Explore commerce <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {commerce.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => onNavigate(item.destination)}
              className="rounded-3xl bg-white/5 p-7 text-left ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-[#1ed760] text-[#121212]">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-6 block text-xl font-bold">{item.title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-white/65">{item.body}</span>
              <span className="mt-5 flex flex-wrap gap-2">
                {item.points.map((point) => (
                  <span key={point} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    {point}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const comparison = [
    ['Store and retail tools', 'Separate workflows', 'Tiwlo workspace'],
    ['Cloud and account access', 'Multiple destinations', 'One account'],
    ['Products and services', 'Different tools', 'Connected experience'],
    ['Everyday business tasks', 'Switch between tools', 'One workspace'],
  ];

  return (
    <section id="why" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why Tiwlo"
          title="Infrastructure you never have to think about."
          body="A workspace that brings the tools you use closer together."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-3xl bg-[#f4f4f4] p-6">
              <benefit.icon className="size-6" aria-hidden="true" />
              <h3 className="mt-5 font-bold">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6a6a6a]">{benefit.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-16 overflow-hidden rounded-3xl ring-1 ring-[#e4e4e4]">
          <div className="bg-[#121212] px-6 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1ed760]">
              One workspace
            </p>
            <h3 className="mt-1 text-xl font-bold">Your tools, connected through Tiwlo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#e4e4e4] text-xs uppercase tracking-wider text-[#6a6a6a]">
                  <th className="px-6 py-4 font-semibold">What you need</th>
                  <th className="px-6 py-4 font-semibold">Separate workflows</th>
                  <th className="px-6 py-4 font-semibold">Tiwlo</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(([feature, separate, tiwlo]) => (
                  <tr key={feature} className="border-b border-[#e4e4e4] last:border-0">
                    <td className="px-6 py-4 font-semibold">{feature}</td>
                    <td className="px-6 py-4 text-[#6a6a6a]">{separate}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1ed760]/15 px-3 py-1 text-xs font-bold text-[#0f7a37]">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                        {tiwlo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection({ onNavigate }) {
  return (
    <section id="faq" className="scroll-mt-24 bg-[#f4f4f4]/70 py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <SectionHeading
            eyebrow="FAQ"
            title="Questions, answered."
            body="Can’t find what you need? Visit our help and support page."
          />
          <button
            type="button"
            onClick={() => onNavigate('help-support')}
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold"
          >
            Get help <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-2">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              name="tiwlo-landing-faq"
              open={index === 0 || undefined}
              className="group rounded-2xl bg-white p-5 ring-1 ring-[#e4e4e4] open:ring-[#121212]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {faq.question}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f4f4f4] transition group-open:rotate-45 group-open:bg-[#1ed760]">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="mt-3 pr-12 text-sm leading-relaxed text-[#6a6a6a]">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ currentUser, onNavigate }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#1ed760] px-6 py-16 text-center text-[#121212] sm:px-16">
          <Cloud className="mx-auto size-10" aria-hidden="true" />
          <h2 className="mx-auto mt-6 max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Ready to build on Tiwlo?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base">
            Open your workspace and explore the tools for your next step.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate(currentUser ? 'dashboard' : 'create-account')}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#121212] px-7 text-sm font-bold text-white transition hover:bg-[#121212]/85"
            >
              {currentUser ? 'Open your workspace' : 'Create your account'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <a
              href="#cloud"
              className="inline-flex h-12 items-center rounded-full bg-white/30 px-7 text-sm font-bold transition hover:bg-white/50"
            >
              Explore cloud tools
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold">
            {['Commerce tools', 'Cloud workspace', 'One Tiwlo account'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LandingFooter({ onNavigate }) {
  const columns = [
    {
      title: 'Products',
      links: [
        ['Storefront', 'store'],
        ['Retail & POS', 'pos'],
        ['Cloud workspace', 'dashboard'],
      ],
    },
    {
      title: 'Explore',
      links: [
        ['Products', '#products'],
        ['Cloud tools', '#cloud'],
        ['Commerce', '#commerce'],
      ],
    },
    {
      title: 'Resources',
      links: [
        ['FAQ', '#faq'],
        ['Pricing', 'pricing'],
        ['Help & support', 'help-support'],
      ],
    },
  ];

  const handleFooterLink = (destination) => {
    if (destination.startsWith('#')) {
      document.querySelector(destination)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    onNavigate(destination);
  };

  return (
    <footer className="bg-[#121212] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo inverted onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              A unified workspace for commerce, retail, and cloud tools.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold">{column.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map(([label, destination]) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => handleFooterLink(destination)}
                      className="text-left text-sm text-white/60 transition hover:text-white"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="text-sm font-bold">Your workspace</h3>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="mt-4 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white"
            >
              Open Tiwlo <ArrowUpRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Tiwlo. All rights reserved.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-fit transition hover:text-white"
          >
            Back to top ↑
          </button>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage({ onNavigate, currentUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (destination) => {
    setMenuOpen(false);
    onNavigate?.(destination);
  };
  const start = () => navigate(currentUser ? 'dashboard' : 'create-account');

  const navigationLinks = [
    ['Products', '#products'],
    ['Cloud Compute', '#cloud'],
    ['Commerce', '#commerce'],
    ['Why Tiwlo', '#why'],
    ['FAQ', '#faq'],
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#121212] [font-family:var(--font-sans)]">
      <a
        href="#tiwlo-main"
        className="fixed left-4 top-[-5rem] z-[100] border-2 border-[#1ed760] bg-white px-5 py-3 focus:top-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[#e4e4e4] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <nav aria-label="Main navigation" className="hidden items-center gap-1 xl:flex">
            {navigationLinks.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-[#6a6a6a] transition hover:bg-[#f4f4f4] hover:text-[#121212]"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => navigate('pricing')}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#6a6a6a] transition hover:bg-[#f4f4f4] hover:text-[#121212]"
            >
              Pricing
            </button>
          </nav>
          <div className="ml-auto hidden items-center gap-2 xl:flex">
            <button
              type="button"
              onClick={() => navigate(currentUser ? 'dashboard' : 'login')}
              className="rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#f4f4f4]"
            >
              {currentUser ? 'Dashboard' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={start}
              className="rounded-full bg-[#121212] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#121212]/85"
            >
              {currentUser ? 'Open workspace' : 'Get started'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="ml-auto flex size-10 items-center justify-center rounded-full hover:bg-[#f4f4f4] xl:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="flex flex-col gap-1 border-t border-[#e4e4e4] px-4 py-4 xl:hidden"
          >
            {navigationLinks.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-[#f4f4f4]"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => navigate('pricing')}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-[#f4f4f4]"
            >
              Pricing
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate(currentUser ? 'dashboard' : 'login')}
                className="rounded-full py-2.5 text-center text-sm font-bold ring-1 ring-[#e4e4e4]"
              >
                {currentUser ? 'Dashboard' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={start}
                className="rounded-full bg-[#1ed760] py-2.5 text-center text-sm font-bold text-[#121212]"
              >
                {currentUser ? 'Open workspace' : 'Get started'}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="tiwlo-main">
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[1440px] items-center gap-7 px-4 pb-10 pt-10 sm:gap-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:px-8 lg:pb-24 lg:pt-24">
            <div>
              <h1 className="text-balance text-[2.5rem] font-bold leading-[1.02] tracking-tight sm:text-7xl">
                Accelerate your business with{' '}
                <span className="text-[#0f7a37]">Tiwlo</span>
              </h1>
              <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-[#6a6a6a] sm:mt-6 sm:text-lg">
                Bring your cloud workspace, online storefront, and retail tools together in one
                place, and explore the services that fit the way you work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1ed760] px-6 text-sm font-bold text-[#121212] transition hover:bg-[#1ed760]/85 sm:h-12 sm:px-7"
                >
                  {currentUser ? 'Open your workspace' : 'Get started'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <a
                  href="#products"
                  className="inline-flex h-11 items-center rounded-full px-6 text-sm font-bold ring-1 ring-[#e4e4e4] transition hover:bg-[#f4f4f4] sm:h-12 sm:px-7"
                >
                  Explore solutions
                </a>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#6a6a6a] sm:mt-8 sm:gap-x-6 sm:gap-y-2 sm:text-sm">
                {['Cloud workspace', 'Commerce tools', 'Retail & POS'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-[#0f7a37]" strokeWidth={3} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        <ProductSection onNavigate={navigate} />
        <CloudSection onNavigate={navigate} />
        <CommerceSection onNavigate={navigate} />
        <WhySection />
        <FaqSection onNavigate={navigate} />

        <CtaSection currentUser={currentUser} onNavigate={navigate} />
      </main>
      <LandingFooter onNavigate={navigate} />
    </div>
  );
}

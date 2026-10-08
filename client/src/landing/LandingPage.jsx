import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Cloud,
  Command,
  Globe2,
  Layers3,
  Menu,
  Monitor,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import HeroScene from "./components/HeroScene";
import "./landing.css";
import "./blueTheme.css";

const products = [
  {
    name: "Online store",
    icon: ShoppingBag,
    eyebrow: "YOUR BRAND. YOUR STOREFRONT.",
    title: "From a little idea to your next big thing.",
    description:
      "Give your products a home. Bring your catalog, customers, and orders together in a storefront that feels like you.",
    features: [
      "Your product catalog, beautifully organized",
      "Orders and inventory in one workspace",
      "A storefront that fits every screen",
    ],
    action: "Explore the storefront",
    route: "store",
  },
  {
    name: "Retail & POS",
    icon: Monitor,
    eyebrow: "BEHIND EVERY GREAT CHECKOUT.",
    title: "Less busywork. More happy customers.",
    description:
      "Keep your counter moving with a connected point of sale. Find products, build a cart, and manage the details of everyday retail.",
    features: [
      "Product search and barcode workflows",
      "Sales, purchases, and stock management",
      "Customer and supplier records together",
    ],
    action: "Explore retail tools",
    route: "pos",
  },
  {
    name: "Cloud workspace",
    icon: Cloud,
    eyebrow: "ROOM FOR YOUR NEXT CHAPTER.",
    title: "A clearer view of your digital world.",
    description:
      "Keep your cloud resources and business tools within reach. Start with your workspace and explore the services that fit your next step.",
    features: [
      "A dedicated cloud dashboard",
      "Domain management from your account",
      "Your services in one place",
    ],
    action: "Open your workspace",
    route: "dashboard",
  },
];
const faqs = [
  [
    "What can I do with Tiwlo?",
    "Tiwlo brings together online storefronts, retail and inventory tools, and a cloud workspace. Choose the tools that match how you work, and manage them through your account.",
  ],
  [
    "How do I get started?",
    "Create an account, verify your email, and complete the account setup. You can then explore your dashboard, add your products, and set up your store.",
  ],
  [
    "Can I use Tiwlo on my phone?",
    "Yes. The web experience adapts to phones, tablets, and larger screens, so you can open your workspace from your browser.",
  ],
  [
    "Where can I compare plans?",
    "Open the pricing page to compare the available plans and their features. The help center is there if you need a hand choosing or getting started.",
  ],
];

function StorePreview({ active }) {
  return (
    <div
      className={`tl-preview tl-preview-${active}`}
      aria-label={`${products[active].name} illustrative preview`}
    >
      <div className="tl-preview-toolbar">
        <span className="tl-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>
          {active === 0
            ? "Your next favorite store"
            : active === 1
              ? "Your retail workspace"
              : "Your cloud workspace"}
        </span>
        <span className="tl-demo-label">Preview</span>
      </div>
      {active === 0 ? (
        <div className="tl-store-demo">
          <div className="tl-demo-nav">
            <strong>
              form<span>&</span>field
            </strong>
            <span>Objects for everyday living</span>
            <ShoppingBag size={17} />
          </div>
          <div className="tl-demo-banner">
            <span>THOUGHTFULLY SIMPLE</span>
            <h3>
              Good things.
              <br />
              Every day.
            </h3>
            <span className="tl-demo-shop">
              The everyday collection <ArrowUpRight size={15} />
            </span>
            <div className="tl-vase">
              <i />
              <i />
            </div>
          </div>
          <div className="tl-demo-products">
            {["The daily carry", "A softer start", "Room to unwind"].map(
              (name, i) => (
                <div key={name}>
                  <div className={`tl-object tl-object-${i}`}>
                    <span />
                  </div>
                  <strong>{name}</strong>
                  <span>Everyday essentials</span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : active === 1 ? (
        <div className="tl-pos-demo">
          <div>
            <div className="tl-demo-heading">
              <strong>Your counter</strong>
              <Package size={19} />
            </div>
            <div className="tl-pos-products">
              {["Canvas tote", "Ceramic cup", "Desk light", "Linen throw"].map(
                (item, i) => (
                  <div key={item}>
                    <div className={`tl-object tl-object-${i % 3}`}>
                      <span />
                    </div>
                    <strong>{item}</strong>
                  </div>
                ),
              )}
            </div>
          </div>
          <aside>
            <strong>Current sale</strong>
            <p>Sample cart</p>
            <div>
              Canvas tote <span>× 1</span>
            </div>
            <div>
              Ceramic cup <span>× 2</span>
            </div>
            <hr />
            <span className="tl-demo-shop">
              Ready for checkout <Check size={15} />
            </span>
          </aside>
        </div>
      ) : (
        <div className="tl-cloud-demo">
          <div className="tl-demo-heading">
            <div>
              <span>YOUR WORKSPACE</span>
              <h3>Everything, connected.</h3>
            </div>
            <Cloud size={30} />
          </div>
          <div className="tl-cloud-stats">
            <div>
              <Layers3 />
              <strong>Resources</strong>
              <span>Organize your services</span>
            </div>
            <div>
              <Globe2 />
              <strong>Domains</strong>
              <span>Make it your own</span>
            </div>
          </div>
          <div className="tl-resource">
            <span className="tl-resource-icon">
              <Cloud />
            </span>
            <div>
              <strong>My cloud workspace</strong>
              <span>Your next project starts here</span>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="tl-resource">
            <span className="tl-resource-icon">
              <ShoppingBag />
            </span>
            <div>
              <strong>My storefront</strong>
              <span>A home for your products</span>
            </div>
            <ArrowUpRight size={19} />
          </div>
        </div>
      )}
      <div className="tl-preview-caption">
        <span className="tl-status-dot" /> A little look at what you can build{" "}
        <span>Illustrative demo</span>
      </div>
    </div>
  );
}

export default function LandingPage({ onNavigate, currentUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(0);
  const menuButton = useRef(null);
  const pageRoot = useRef(null);
  const product = products[activeProduct];
  const start = () => onNavigate(currentUser ? "dashboard" : "create-account");
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = pageRoot.current.querySelectorAll(
      ".tl-section-heading, .tl-product-panel, .tl-benefits article, .tl-start-section, .tl-faq-section, .tl-cta",
    );
    const animations = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          if (motion.matches) continue;
          const animation = entry.target.animate(
            [
              { opacity: 0.25, transform: "translateY(32px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 750, easing: "cubic-bezier(.2,.7,.2,1)", fill: "none" },
          );
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        }
      },
      { threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    const stopMotion = () => {
      if (motion.matches) animations.forEach((animation) => animation.cancel());
    };
    motion.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      motion.removeEventListener("change", stopMotion);
    };
  }, []);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Tiwlo — A little idea. Unlimited possibility.";
    return () => {
      document.title = previousTitle;
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const onOutside = (event) => {
      if (!event.target.closest(".tl-header")) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [menuOpen]);
  function switchProduct(event) {
    let next = activeProduct;
    if (event.key === "ArrowRight") next = (next + 1) % products.length;
    else if (event.key === "ArrowLeft")
      next = (next + products.length - 1) % products.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = products.length - 1;
    else return;
    event.preventDefault();
    setActiveProduct(next);
    document.getElementById(`tl-tab-${next}`)?.focus();
  }
  return (
    <div className="tl-landing tl-blue-theme" ref={pageRoot}>
      <a className="tl-skip" href="#tl-main">
        Skip to content
      </a>
      <header className="tl-header">
        <div className="tl-container tl-nav">
          <a className="tl-brand" href="#tl-main" aria-label="Tiwlo home">
            <img src="/tiwlologo.png" alt="Tiwlo" width="100" height="34" />
          </a>
          <nav className="tl-desktop-nav" aria-label="Main navigation">
            <a href="#tl-products">
              Products <ChevronDown size={13} />
            </a>
            <a href="#tl-possibilities">Why Tiwlo</a>
            <button onClick={() => onNavigate("pricing")}>Pricing</button>
            <a href="#tl-faq">Resources</a>
          </nav>
          <div className="tl-nav-actions">
            <button
              className="tl-signin"
              onClick={() => onNavigate(currentUser ? "dashboard" : "login")}
            >
              {currentUser ? "Dashboard" : "Sign in"} <ArrowUpRight size={15} />
            </button>
            <button className="tl-button tl-button-small" onClick={start}>
              {currentUser ? "Open workspace" : "Get started"}{" "}
              <ArrowRight size={15} />
            </button>
            <button
              ref={menuButton}
              className="tl-menu-toggle"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="tl-mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="tl-mobile-nav"
            className="tl-mobile-nav"
            aria-label="Mobile navigation"
          >
            <a href="#tl-products" onClick={() => setMenuOpen(false)}>
              Products <ArrowUpRight size={17} />
            </a>
            <a href="#tl-possibilities" onClick={() => setMenuOpen(false)}>
              Why Tiwlo <ArrowUpRight size={17} />
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                onNavigate("pricing");
              }}
            >
              Pricing <ArrowUpRight size={17} />
            </button>
            <a href="#tl-faq" onClick={() => setMenuOpen(false)}>
              Resources <ArrowUpRight size={17} />
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                onNavigate(currentUser ? "dashboard" : "login");
              }}
            >
              {currentUser ? "Your dashboard" : "Sign in"}{" "}
              <ArrowRight size={17} />
            </button>
          </nav>
        )}
      </header>
      <main id="tl-main">
        <div className="tl-hero-stage">
          <div className="tl-hero-backdrop" aria-hidden="true">
            <span />
            <span />
            <span />
            <div />
          </div>
          <section
            className="tl-hero tl-container"
            aria-labelledby="tl-hero-title"
          >
            <div className="tl-hero-copy">
              <a className="tl-announcement" href="#tl-products">
                <span>
                  <Sparkles size={13} /> Commerce. Cloud. Connected.
                </span>
                <ArrowUpRight size={15} />
              </a>
              <h1 id="tl-hero-title">
                Your business.
                <br />
                Beautifully
                <br />
                <span>connected.</span>
              </h1>
              <p>
                Your store. Your business. Your next big thing.
                <br className="tl-desktop-break" /> Bring it all together with
                Tiwlo’s connected commerce and cloud tools.
              </p>
              <div className="tl-hero-actions">
                <button className="tl-button" onClick={start}>
                  {currentUser
                    ? "Go to your workspace"
                    : "Start building with Tiwlo"}{" "}
                  <ArrowRight size={18} />
                </button>
                <a className="tl-text-link" href="#tl-products">
                  Take a look around{" "}
                  <ArrowRight size={16} className="tl-arrow-down" />
                </a>
              </div>
              <div className="tl-hero-note">
                <span>
                  <Check size={14} /> Start with a free account
                </span>
                <span className="tl-note-divider" />
                <span>Build at your own pace</span>
              </div>
            </div>
            <div className="tl-hero-art">
              <HeroScene />
            </div>
            <a className="tl-scroll-cue" href="#tl-products">
              <span /> Scroll to connect the possibilities{" "}
              <ArrowRight size={14} className="tl-arrow-down" />
            </a>
          </section>
        </div>
        <div className="tl-tool-strip">
          <div className="tl-container">
            <span>
              A place for every part
              <br />
              <strong>of your ambition.</strong>
            </span>
            <span>
              <ShoppingBag /> Online stores
            </span>
            <span>
              <Monitor /> Retail & POS
            </span>
            <span>
              <Cloud /> Cloud workspace
            </span>
            <span>
              <Globe2 /> Custom domains
            </span>
          </div>
        </div>
        <section
          id="tl-products"
          className="tl-section tl-container"
          aria-labelledby="tl-products-title"
        >
          <div className="tl-section-heading">
            <div>
              <span className="tl-eyebrow">LESS SWITCHING. MORE DOING.</span>
              <h2 id="tl-products-title">
                Big plans.
                <br />
                Meet your toolkit.
              </h2>
            </div>
            <p>
              Everything starts with an idea.
              <br />
              Here’s what helps you bring yours to life.
            </p>
          </div>
          <div
            className="tl-product-tabs"
            role="tablist"
            aria-label="Explore Tiwlo products"
          >
            {products.map((item, index) => (
              <button
                key={item.name}
                role="tab"
                id={`tl-tab-${index}`}
                aria-selected={activeProduct === index}
                aria-controls="tl-product-panel"
                tabIndex={activeProduct === index ? 0 : -1}
                onClick={() => setActiveProduct(index)}
                onKeyDown={switchProduct}
              >
                <item.icon size={18} />
                {item.name}
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div
            id="tl-product-panel"
            className="tl-product-panel"
            role="tabpanel"
            aria-labelledby={`tl-tab-${activeProduct}`}
            tabIndex={0}
          >
            <div className="tl-product-copy">
              <span className="tl-eyebrow">{product.eyebrow}</span>
              <h3>{product.title}</h3>
              <p>{product.description}</p>
              <ul>
                {product.features.map((feature) => (
                  <li key={feature}>
                    <Check size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className="tl-text-link"
                onClick={() =>
                  onNavigate(
                    product.route === "dashboard" && !currentUser
                      ? "login"
                      : product.route,
                  )
                }
              >
                {product.action} <ArrowRight size={17} />
              </button>
            </div>
            <StorePreview active={activeProduct} />
          </div>
        </section>
        <section id="tl-possibilities" className="tl-possibilities">
          <div className="tl-container">
            <div className="tl-section-heading">
              <div>
                <span className="tl-eyebrow">BUILT AROUND YOUR EVERYDAY.</span>
                <h2>
                  Less friction.
                  <br />
                  More forward.
                </h2>
              </div>
              <p>
                The small details make a big difference.
                <br />A workspace that keeps things simple.
              </p>
            </div>
            <div className="tl-benefits">
              <article>
                <span className="tl-benefit-icon">
                  <Layers3 />
                </span>
                <span className="tl-card-number">01 / CONNECTED</span>
                <h3>
                  Everything has
                  <br />
                  its place.
                </h3>
                <p>
                  Bring your products, stock, sales, and customers into a shared
                  workflow. Spend less time jumping between tools.
                </p>
                <div className="tl-connected-art" aria-hidden="true">
                  <span>
                    <ShoppingBag />
                  </span>
                  <i />
                  <span className="tl-connect-center">
                    <Command />
                  </span>
                  <i />
                  <span>
                    <Cloud />
                  </span>
                </div>
              </article>
              <article>
                <span className="tl-benefit-icon">
                  <Monitor />
                </span>
                <span className="tl-card-number">02 / FLEXIBLE</span>
                <h3>
                  Big ideas.
                  <br />
                  Any size screen.
                </h3>
                <p>
                  At the counter or on the couch. A thoughtful experience that
                  makes room for the way you work.
                </p>
                <div className="tl-device-art" aria-hidden="true">
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>
                    <i />
                    <i />
                  </span>
                </div>
              </article>
              <article>
                <span className="tl-benefit-icon">
                  <ShieldCheck />
                </span>
                <span className="tl-card-number">03 / YOURS</span>
                <h3>
                  Your business.
                  <br />
                  Your own space.
                </h3>
                <p>
                  Account verification, access controls, and store-specific data
                  help keep your workspace in your hands.
                </p>
                <div className="tl-shield-art" aria-hidden="true">
                  <span />
                  <ShieldCheck size={54} />
                  <span />
                </div>
              </article>
            </div>
          </div>
        </section>
        <section className="tl-start-section tl-container">
          <div>
            <span className="tl-eyebrow">YOUR NEXT CHAPTER STARTS SMALL.</span>
            <h2>
              From “what if”
              <br />
              to <span>“let’s go.”</span>
            </h2>
            <button className="tl-text-link" onClick={start}>
              Make your first move <ArrowRight size={18} />
            </button>
          </div>
          <ol className="tl-steps">
            {[
              [
                "Make yourself at home",
                "Create your account and set up your workspace.",
              ],
              [
                "Bring your idea to life",
                "Add your products, organize your tools, and make it yours.",
              ],
              [
                "Find your own momentum",
                "Manage the everyday details and plan what comes next.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowUpRight size={18} />
              </li>
            ))}
          </ol>
        </section>
        <section id="tl-faq" className="tl-faq-section tl-container">
          <div>
            <span className="tl-eyebrow">A LITTLE MORE CLARITY.</span>
            <h2>
              Good questions.
              <br />
              Simple answers.
            </h2>
            <p>Still curious about something?</p>
            <button
              className="tl-text-link"
              onClick={() => onNavigate("help-support")}
            >
              We’re here to help <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="tl-faq-list">
            {faqs.map(([question, answer], i) => (
              <details key={question} name="tl-faq" open={i === 0 || undefined}>
                <summary>
                  {question}
                  <Plus size={19} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="tl-cta tl-container">
          <div className="tl-cta-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="tl-eyebrow">
            SMALL BEGINNINGS. BIG POSSIBILITIES.
          </span>
          <h2>
            Your next big thing
            <br />
            is waiting for <em>you.</em>
          </h2>
          <p>Let’s give it a place to grow.</p>
          <button className="tl-button tl-button-white" onClick={start}>
            {currentUser ? "Open your workspace" : "Get started with Tiwlo"}{" "}
            <ArrowUpRight size={19} />
          </button>
          <span className="tl-cta-footnote">
            Your ideas. Your pace. Your Tiwlo.
          </span>
        </section>
      </main>
      <footer className="tl-footer tl-container">
        <div className="tl-footer-top">
          <div>
            <a className="tl-brand" href="#tl-main">
              <img src="/tiwlologo.png" alt="Tiwlo" width="100" height="34" />
            </a>
            <p>A little idea. Unlimited possibility.</p>
          </div>
          <div>
            <strong>Explore</strong>
            <a href="#tl-products">Our products</a>
            <button onClick={() => onNavigate("store")}>Storefront</button>
            <button onClick={() => onNavigate("pricing")}>
              Plans & pricing
            </button>
          </div>
          <div>
            <strong>Get in touch</strong>
            <button onClick={() => onNavigate("help-support")}>
              Help center
            </button>
            <a href="#tl-faq">Common questions</a>
            <button onClick={start}>
              Your workspace <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="tl-footer-note">
            <Globe2 size={22} />
            <p>
              Made for the way
              <br />
              you want to work.
            </p>
          </div>
        </div>
        <div className="tl-footer-bottom">
          <span>© {new Date().getFullYear()} Tiwlo. All rights reserved.</span>
          <span>Commerce. Cloud. Possibility.</span>
          <a href="#tl-main">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}

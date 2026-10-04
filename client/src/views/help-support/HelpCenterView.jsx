import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';

export default function HelpCenterView({ initialQuery = '', onBack, onOpenInbox }) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedArticle, setExpandedArticle] = useState(null);
  const [helpfulFeedback, setHelpfulFeedback] = useState({});

  const categories = [
    'All',
    'Droplets & Cloud',
    'Multi-Tenant Store',
    'POS & Hardware',
    'Billing & Invoices',
    'Security & SSL'
  ];

  const articles = [
    {
      id: 'art_1',
      category: 'Droplets & Cloud',
      title: 'How do I provision and reboot a cloud droplet?',
      snippet: 'Learn how to create high-performance Ubuntu droplets, assign CPU/RAM, and execute live reboots.',
      content: `Tiwlo Cloud Console allows instant provisioning of virtual compute droplets with zero downtime:
1. Navigate to the Cloud Dashboard and click "+ Create Droplet".
2. Select your OS distribution (Ubuntu 22.04 LTS is pre-configured for maximum speed and security).
3. Choose your compute tier (e.g. 2 vCPU / 4GB RAM / 80GB NVMe SSD).
4. Click "Provision Droplet". Within 15 seconds, your droplet will receive a public IPv4 and dedicated status monitoring.
5. To reboot or power-cycle, use the Actions menu next to your droplet in the Droplets table.`
    },
    {
      id: 'art_2',
      category: 'Multi-Tenant Store',
      title: 'How is store data completely isolated between tenants?',
      snippet: 'Understand the multi-tenant architecture that ensures strict row-level isolation and zero cross-leakage.',
      content: `Every online store created in Tiwlo receives a unique tenant identifier (e.g. TIW-XXXXX):
1. **Isolated Data Schema:** Products, inventory, transactions, customers, and orders are partitioned strictly by user ID and store ID.
2. **Subdomain Routing:** Each store gets a distinct *.tiwlo.com or custom domain with automated SSL.
3. **Database Security:** Cloud operations and POS transactions run through isolated GraphQL endpoints that verify authorization on every mutation.`
    },
    {
      id: 'art_3',
      category: 'POS & Hardware',
      title: 'Connecting USB & Bluetooth barcode scanners to Tiwlo POS',
      snippet: 'Set up hardware barcode guns, thermal receipt printers, and cash drawers with plug-and-play ease.',
      content: `Tiwlo POS natively supports standard HID (Human Interface Device) barcode scanners without drivers:
1. Plug your USB barcode scanner into your computer or connect via Bluetooth.
2. Open Tiwlo POS from the sidebar.
3. Simply scan any item barcode—the scanner will automatically locate the product and add it to the active cart.
4. You can also print barcode labels using the "Barcode Print Studio" modal in your inventory page.`
    },
    {
      id: 'art_4',
      category: 'Billing & Invoices',
      title: 'Managing subscription tiers and downloading VAT invoices',
      snippet: 'How to switch between Starter, Pro, and Enterprise plans, update cards, and export billing statements.',
      content: `Manage all billing details transparently with no hidden fees:
1. Go to "Upgrade & Plans" or "Billing" in the sidebar.
2. Choose between monthly or annual billing to unlock enterprise storage and multi-store expansions.
3. Invoices are automatically generated as verified PDF documents ready for accounting and tax reporting.
4. Payments are secured via Stripe 256-bit SSL encryption.`
    },
    {
      id: 'art_5',
      category: 'Security & SSL',
      title: 'How automated wildcard Let’s Encrypt SSL certificates work',
      snippet: 'Details on automated certificate generation, renewal cycles, and DDoS mitigation.',
      content: `All Tiwlo cloud droplets and custom store domains are secured automatically:
1. Wildcard certificates are provisioned upon domain attachment.
2. Automated renewal scripts run 30 days prior to expiry with zero manual intervention.
3. HTTP to HTTPS forced redirection is enabled by default to protect customer checkouts.`
    }
  ];

  const filteredArticles = articles.filter(a => {
    if (selectedCategory !== 'All' && a.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.snippet.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleArticle = (id) => {
    setExpandedArticle(prev => prev === id ? null : id);
  };

  const handleFeedback = (id, helpful) => {
    setHelpfulFeedback(prev => ({ ...prev, [id]: helpful }));
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Navigation Bar (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200/80 dark:border-gray-700 shadow-2xs cursor-pointer group"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Help Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Browse articles and find quick answers
            </p>
          </div>
        </div>

        {/* Quick Chat CTA */}
        <button
          onClick={onOpenInbox}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-bold transition self-start sm:self-auto cursor-pointer border border-blue-200/60 dark:border-blue-900/40"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat with Support</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search articles by keyword or question..."
          className="w-full pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700 focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 shadow-2xs"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-full sm:flex-wrap pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 border border-slate-200/70 dark:border-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {filteredArticles.map((article) => {
          const isExpanded = expandedArticle === article.id;
          return (
            <div
              key={article.id}
              className="rounded-2xl border border-slate-200/80 dark:border-gray-700/80 overflow-hidden bg-white dark:bg-gray-800/80 transition hover:border-blue-200 dark:hover:border-blue-800 shadow-2xs"
            >
              <div
                onClick={() => toggleArticle(article.id)}
                className="p-5 flex items-start justify-between gap-4 cursor-pointer select-none"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    {article.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white pt-1">
                    {article.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {article.snippet}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-gray-700 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-gray-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                  <div className="whitespace-pre-line bg-slate-50 dark:bg-gray-900/60 p-4 rounded-xl border border-slate-100 dark:border-gray-800">
                    {article.content}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Was this answer helpful?</span>
                      <button
                        onClick={() => handleFeedback(article.id, true)}
                        className={`px-3 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                          helpfulFeedback[article.id] === true
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-300'
                            : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" /> Yes
                      </button>
                      <button
                        onClick={() => handleFeedback(article.id, false)}
                        className={`px-3 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                          helpfulFeedback[article.id] === false
                            ? 'bg-red-50 text-red-600 border-red-300'
                            : 'border-slate-200 dark:border-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        No
                      </button>
                    </div>

                    <button
                      onClick={onOpenInbox}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                    >
                      Ask a Specialist &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-xs">
            No articles found matching "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
}

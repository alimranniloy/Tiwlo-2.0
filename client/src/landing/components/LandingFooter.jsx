import React, { useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

export default function LandingFooter({ onNavigate }) {
  const [logoError, setLogoError] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English (United States)');

  const footerColumns = [
    {
      title: 'Products',
      links: [
        { label: 'E-Commerce Storefront', action: () => onNavigate('store') },
        { label: 'Cloud Infrastructure', action: () => onNavigate('dashboard') },
        { label: 'Omnichannel POS Register', action: () => onNavigate('pos') },
        { label: 'Multi-Tenant Database', action: () => onNavigate('dashboard') },
        { label: 'Anycast DNS & SSL', action: () => onNavigate('domains') }
      ]
    },
    {
      title: 'Solutions',
      links: [
        { label: 'Fast-Growing Startups', action: () => onNavigate('create-account') },
        { label: 'Retail & Multi-Branch POS', action: () => onNavigate('store') },
        { label: 'Wholesale & Inventory', action: () => onNavigate('pos') },
        { label: 'Custom Domain Hosting', action: () => onNavigate('domains') },
        { label: 'Enterprise Security', action: () => onNavigate('help-support') }
      ]
    },
    {
      title: 'Resources',
      links: [
        { label: 'Platform Documentation', action: () => onNavigate('help-support') },
        { label: 'Developer REST APIs', action: () => window.open('/api', '_blank') },
        { label: 'System Uptime Status', action: () => onNavigate('help-support') },
        { label: 'Pricing Calculator', action: () => onNavigate('pricing') },
        { label: 'Changelog & Updates', action: () => onNavigate('help-support') }
      ]
    },
    {
      title: 'Support & Trust',
      links: [
        { label: '24/7 Help Desk', action: () => onNavigate('help-support') },
        { label: 'Live Engineer Chat', action: () => onNavigate('help-support') },
        { label: 'Security & Privacy Policy', action: () => onNavigate('help-support') },
        { label: 'Terms of Service', action: () => onNavigate('help-support') },
        { label: 'SLA Guarantee (99.99%)', action: () => onNavigate('help-support') }
      ]
    }
  ];

  return (
    <footer className="bg-[#f8f9fa] border-t border-[#f1f3f4] text-[13px] text-[#5f6368]">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        
        {/* Top Header Strip with Language / Region Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-10 border-b border-[#f1f3f4]">
          <div
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              onNavigate('landing');
            }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            {!logoError ? (
              <img
                src="/tiwlologo.png"
                alt="Tiwlo"
                onError={() => setLogoError(true)}
                className="h-6 w-auto object-contain transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="text-[20px] font-semibold text-[#1f1f1f]">
                Tiwlo
              </span>
            )}
            <span className="text-[14px] text-[#5f6368] pl-2 border-l border-[#e0e2ec]">
              Cloud Platform
            </span>
          </div>

          {/* Google-Style Language Selector */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e0e2ec] text-[12px] text-[#444746] hover:bg-[#f1f3f4] transition-colors cursor-pointer">
            <Globe className="w-3.5 h-3.5 text-[#5f6368]" />
            <span>{selectedLanguage}</span>
            <ChevronDown className="w-3 h-3 text-[#5f6368]" />
          </div>
        </div>

        {/* 4 Categorized Columns */}
        <div className="py-12 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {footerColumns.map((col, idx) => (
            <div key={idx} className="space-y-3">
              <h4 className="text-[14px] font-medium text-[#1f1f1f]">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <button
                      type="button"
                      onClick={link.action}
                      className="text-[#5f6368] hover:text-[#0b57d0] hover:underline text-left transition-colors cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar: Copyright & Subtle Legal Links */}
        <div className="pt-8 border-t border-[#f1f3f4] flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#747775]">
          <div>
            © 2026 Tiwlo Technologies Inc. All rights reserved.
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              onClick={() => onNavigate('help-support')}
              className="hover:text-[#1f1f1f] hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onNavigate('help-support')}
              className="hover:text-[#1f1f1f] hover:underline cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() => onNavigate('help-support')}
              className="hover:text-[#1f1f1f] hover:underline cursor-pointer"
            >
              System Status
            </button>
            <button
              onClick={() => onNavigate('help-support')}
              className="hover:text-[#1f1f1f] hover:underline cursor-pointer"
            >
              Cookie Preferences
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}

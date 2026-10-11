import React from 'react';
import { HelpCircle, Mail, MessageSquare, BookOpen, ExternalLink } from 'lucide-react';

export default function OneProfileSupportView() {
  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Help & Documentation</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Get assistance with custom domain routing, templates, and NFC smart cards.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <BookOpen className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-extrabold text-sm text-slate-900 mb-1">DNS Setup Guides</h3>
          <p className="text-xs text-slate-500 mb-4">Step-by-step guides for connecting GitHub Pages, Vercel, and Cloudflare.</p>
          <a href="#" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
            <span>Read Guides</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <MessageSquare className="w-6 h-6 text-purple-600 mb-3" />
          <h3 className="font-extrabold text-sm text-slate-900 mb-1">NFC Tap Card FAQ</h3>
          <p className="text-xs text-slate-500 mb-4">How to write custom URLs, rewrite NFC tags, and test with iOS/Android.</p>
          <a href="#" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
            <span>Learn More</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <Mail className="w-6 h-6 text-emerald-600 mb-3" />
          <h3 className="font-extrabold text-sm text-slate-900 mb-1">Developer Support</h3>
          <p className="text-xs text-slate-500 mb-4">Direct ticket and email support from the UIDs infrastructure engineering team.</p>
          <a href="mailto:support@tiwlo.com" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
            <span>Contact Support</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

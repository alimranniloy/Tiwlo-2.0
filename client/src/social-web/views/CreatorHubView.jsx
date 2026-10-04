import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Award,
  Users,
  Eye,
  Sparkles,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CreatorHubView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'tiers' | 'gigs' | 'mediakit'
  const [gigs, setGigs] = useState([]);

  useEffect(() => {
    TiwiSocialAPI.getGigs().then((data) => {
      setGigs(Array.isArray(data) ? data : []);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B57D0] to-[#4285F4] p-6 sm:p-8 rounded-3xl text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white uppercase tracking-wider">
            Creator Studio
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-2">Welcome to your Creator Hub</h1>
          <p className="text-xs text-blue-100 mt-1 max-w-md leading-relaxed">
            Manage your analytics, monetization tiers, freelance gigs, and brand partnerships on Tiwi.
          </p>
        </div>

        <button
          onClick={() => navigateTo('wallet')}
          className="bg-white text-[#0B57D0] px-5 py-2.5 rounded-full text-xs font-bold hover:bg-blue-50 transition-colors shadow-xs self-start sm:self-auto"
        >
          View Tiwi Wallet
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'analytics', label: 'Creator Analytics' },
          { id: 'tiers', label: 'Membership Tiers' },
          { id: 'gigs', label: 'Freelance Gigs' },
          { id: 'mediakit', label: 'Media Kit' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#0B57D0] text-white shadow-xs'
                : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Post Impressions</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F] dark:text-white mt-1">48.6K</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">↑ +24% this week</div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Engagement Rate</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F] dark:text-white mt-1">8.4%</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">↑ +3.2% vs avg</div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Audience Growth</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#1F1F1F] dark:text-white mt-1">+340</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">New followers</div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">Creator Earnings</div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#0B57D0] dark:text-[#8AB4F8] mt-1">$420.50</div>
              <div className="text-[11px] text-gray-400 font-medium mt-1">Available to payout</div>
            </div>
          </div>
        </div>
      )}

      {/* Tiers Tab */}
      {activeTab === 'tiers' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: 'Community Supporter', price: '$4.99/mo', perks: ['Supporter badge', 'Exclusive posts', 'Direct DM priority'] },
            { name: 'VIP Circle', price: '$14.99/mo', perks: ['All Supporter perks', 'Monthly Live Audio backstage pass', 'Early access to drops'] },
            { name: 'Patron Producer', price: '$49.99/mo', perks: ['All VIP perks', '1-on-1 consultation', 'Credits in all posts'] },
          ].map((tier, i) => (
            <div key={i} className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white">{tier.name}</h3>
                <div className="text-xl font-extrabold text-[#0B57D0] mt-1">{tier.price}</div>
                <div className="flex flex-col gap-2 mt-4">
                  {tier.perks.map((p, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0B57D0]" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => showToast('Tier configured for your profile', 'info')}
                className="w-full py-2 rounded-full border border-[#0B57D0] text-[#0B57D0] hover:bg-[#0B57D0] hover:text-white transition-colors text-xs font-bold"
              >
                Configure Tier
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Gigs Tab */}
      {activeTab === 'gigs' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white">Active Freelance Opportunities</h3>
            <button
              onClick={() => showToast('Create gig listing', 'info')}
              className="bg-[#0B57D0] text-white px-4 py-1.5 rounded-full text-xs font-semibold"
            >
              Post a Gig
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(gigs.length > 0 ? gigs : [
              { title: 'Custom UI/UX Mobile Design for App', price: '$250', username: 'alex_designer', deliveryDays: 3 },
              { title: 'Node.js & PostgreSQL Backend Optimization', price: '$400', username: 'dev_pro', deliveryDays: 5 },
            ]).map((gig, idx) => (
              <div key={idx} className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-[#1F1F1F] dark:text-white">{gig.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">Offered by @{gig.username} • {gig.deliveryDays} days delivery</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm font-extrabold text-[#0B57D0]">{gig.price}</span>
                  <button
                    onClick={() => showToast('Contacting freelancer...', 'info')}
                    className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold hover:bg-[#0B57D0] hover:text-white transition-colors"
                  >
                    Inquire
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Kit Tab */}
      {activeTab === 'mediakit' && (
        <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[#1F1F1F] dark:text-white">Official Creator Media Kit</h3>
              <p className="text-xs text-gray-500">Shareable verified stats for brand sponsorships</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.origin + '/tiwi/creator/mediakit');
                showToast('Media Kit link copied!', 'info');
              }}
              className="bg-[#0B57D0] text-white px-4 py-2 rounded-full text-xs font-semibold"
            >
              Export & Share
            </button>
          </div>
          <div className="p-4 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div><b>Primary Audience:</b> Tech Enthusiasts, Developers, Creative Designers (Ages 18-34)</div>
            <div><b>Top Regions:</b> North America (45%), Europe (30%), Asia (20%)</div>
            <div><b>Avg Post Reach:</b> 12.5K impressions per publication</div>
          </div>
        </div>
      )}
    </div>
  );
}

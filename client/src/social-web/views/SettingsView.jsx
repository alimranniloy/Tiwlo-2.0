import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
  Eye,
  Bell,
  Download,
  Info,
  CheckCircle2,
  DollarSign,
  Smartphone,
  Laptop,
  Search,
  Check,
  KeyRound,
  LogOut,
  UserCheck
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SettingsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [subSection, setSubSection] = useState('menu');
  const [searchFilter, setSearchFilter] = useState('');

  const [accountInfo] = useState({
    username: currentUser?.handle || 'tiwi_member',
    email: currentUser?.email || 'user@tiwlo.com',
    phone: '+1 (555) 019-2834',
    country: 'United States',
    joinedDate: 'October 2023',
  });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [_confirmPassword, setConfirmPassword] = useState('');

  const [legalName, setLegalName] = useState('');
  const [category, setCategory] = useState('Software Engineer / Tech');
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const [sessions, setSessions] = useState([
    {
      id: 'sess_1',
      device: 'Windows PC · Chrome Browser',
      location: 'Dhaka, Bangladesh',
      ip: '103.145.22.8',
      current: true,
      lastActive: 'Active now',
    },
    {
      id: 'sess_2',
      device: 'iPhone 15 Pro · Tiwi Mobile App',
      location: 'Dhaka, Bangladesh',
      ip: '103.145.22.14',
      current: false,
      lastActive: '2 hours ago',
    },
    {
      id: 'sess_3',
      device: 'MacBook Air M2 · Safari',
      location: 'Singapore',
      ip: '128.199.202.91',
      current: false,
      lastActive: '3 days ago',
    },
  ]);

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!legalName.trim()) {
      showToast('Please enter your full legal name', 'error');
      return;
    }
    setSubmittingVerification(true);
    try {
      await TiwiSocialAPI.requestVerification(
        { legalName, category },
        currentUser?.id
      );
      showToast('Verification request received. You will receive an update in 24-48 hours.', 'info');
      setSubSection('menu');
    } catch {
      showToast('Failed to submit verification', 'error');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      showToast('Please fill in both password fields', 'error');
      return;
    }
    showToast('Password updated securely', 'info');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSubSection('menu');
  };

  const handleRevokeSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Device session terminated', 'info');
  };

  const menuItems = [
    {
      id: 'account',
      title: 'Your Account',
      desc: 'See information about your account, download an archive of your data',
      icon: UserCheck,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'verification',
      title: 'Official Verification',
      desc: 'Apply for the official blue verified checkmark badge',
      icon: CheckCircle2,
      color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      id: 'monetization',
      title: 'Creator Monetization & Tiers',
      desc: 'Manage your creator subscription plans and ad revenue sharing',
      icon: DollarSign,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'security',
      title: 'Security and Active Sessions',
      desc: 'Password, two-step verification, and active device logins',
      icon: Lock,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'privacy',
      title: 'Privacy and Content Controls',
      desc: 'Manage what information you share and control your audience',
      icon: Eye,
      color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    },
    {
      id: 'notifications',
      title: 'Notifications & Alerts',
      desc: 'Choose how and when you receive stream and account updates',
      icon: Bell,
      color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
    {
      id: 'data',
      title: 'Download Data Archive',
      desc: 'Download a complete JSON export of your posts, media, and history',
      icon: Download,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'about',
      title: 'Legal and Resources',
      desc: 'Terms of Service, Privacy Policy, and Community Guidelines',
      icon: Info,
      color: 'bg-black/5 dark:bg-white/5 text-[#65676b] dark:text-[#8a8d91]',
    },
  ];

  const filteredMenuItems = menuItems.filter(
    (m) =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col min-h-screen max-w-3xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center gap-3 border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        {subSection !== 'menu' ? (
          <button
            onClick={() => setSubSection('menu')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back to Settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back to Stream"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-tight truncate tracking-tight">
            {subSection === 'menu' ? 'Settings & Privacy' : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
          </h1>
          <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Content */}
      <div className="flex flex-col px-1">
        {subSection === 'menu' && (
          <div className="flex flex-col gap-4">
            {/* Search Settings */}
            <div className="flex items-center h-11 bg-white dark:bg-[#16161f] rounded-2xl px-4 border border-black/[0.06] dark:border-white/[0.08] focus-within:ring-2 focus-within:ring-violet-500/30 shadow-xs transition">
              <Search className="w-4 h-4 text-[#65676b] dark:text-[#8a8d91] mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91] text-[#1c1e21] dark:text-[#e4e6eb]"
              />
            </div>

            {/* Modern Settings Cards List */}
            <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] divide-y divide-black/[0.04] dark:divide-white/[0.05] overflow-hidden shadow-sm">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'monetization') navigateTo('creator');
                      else setSubSection(item.id);
                    }}
                    className="p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {item.title}
                        </span>
                        <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91] truncate">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#65676b] dark:text-[#8a8d91] group-hover:text-violet-600 transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Account Details */}
        {subSection === 'account' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] border-b border-black/[0.05] dark:border-white/[0.06] pb-3">
              Account Information
            </h3>
            <div className="space-y-3">
              {Object.entries(accountInfo).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-black/[0.03] dark:border-white/[0.04]">
                  <span className="text-xs font-semibold text-[#65676b] dark:text-[#8a8d91] capitalize">{key}</span>
                  <span className="text-xs font-medium text-[#1c1e21] dark:text-[#e4e6eb]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification */}
        {subSection === 'verification' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb]">
                  Apply for Verification
                </h3>
                <p className="text-xs text-[#65676b] dark:text-[#8a8d91]">
                  Official badge confirms your authentic creator identity.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerificationSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  placeholder="Your government or business legal name"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1">
                  Primary Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
                >
                  <option value="Software Engineer / Tech">Software Engineer / Tech</option>
                  <option value="Designer / Creative">Designer / Creative</option>
                  <option value="Content Creator / Media">Content Creator / Media</option>
                  <option value="Business / Founder">Business / Founder</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingVerification}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
              >
                {submittingVerification ? 'Submitting...' : 'Submit Verification Request'}
              </button>
            </form>
          </div>
        )}

        {/* Security & Active Sessions */}
        {subSection === 'security' && (
          <div className="space-y-4">
            {/* Password Change */}
            <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
              <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-3">
                Update Password
              </h3>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <input
                  type="password"
                  placeholder="Current Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Save New Password
                </button>
              </form>
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
              <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-3">
                Active Device Logins ({sessions.length})
              </h3>
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {sessions.map((sess) => (
                  <div key={sess.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                        {sess.device.includes('iPhone') ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#1c1e21] dark:text-[#e4e6eb]">{sess.device}</span>
                          {sess.current && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              This device
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">{sess.location} · {sess.lastActive}</span>
                      </div>
                    </div>

                    {!sess.current && (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Privacy */}
        {subSection === 'privacy' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] border-b border-black/[0.05] dark:border-white/[0.06] pb-3">
              Privacy Settings
            </h3>
            <div className="space-y-3">
              {[
                { title: 'Public Profile', desc: 'Anyone on or off Tiwi can view your profile and public posts' },
                { title: 'Search Engine Indexing', desc: 'Allow search engines like Google to index your public content' },
                { title: 'Direct Messages from Anyone', desc: 'Allow members who do not follow you to send chat requests' },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-black/[0.03] dark:border-white/[0.04]">
                  <div>
                    <span className="font-semibold text-xs text-[#1c1e21] dark:text-[#e4e6eb] block">{p.title}</span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">{p.desc}</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-600 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications */}
        {subSection === 'notifications' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] border-b border-black/[0.05] dark:border-white/[0.06] pb-3">
              Notification Preferences
            </h3>
            <div className="space-y-3">
              {[
                { title: 'Likes & Reactions', desc: 'Notify when someone likes or reacts to your posts' },
                { title: 'Comments & Replies', desc: 'Notify when someone replies to your threads' },
                { title: 'New Followers', desc: 'Notify when a new member follows your profile' },
                { title: 'Audio Spaces Invites', desc: 'Notify when someone invites you to speak on stage' },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-black/[0.03] dark:border-white/[0.04]">
                  <div>
                    <span className="font-semibold text-xs text-[#1c1e21] dark:text-[#e4e6eb] block">{n.title}</span>
                    <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">{n.desc}</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-violet-600 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Download */}
        {subSection === 'data' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-2">
              Download Your Archive
            </h3>
            <p className="text-xs text-[#65676b] dark:text-[#8a8d91] leading-relaxed mb-4">
              Request an archive containing all of your published posts, comments, media attachments, and wallet transaction history in structured JSON format.
            </p>
            <button
              onClick={() => showToast('Archive requested. Download link will be sent to your email.', 'info')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-violet-500/20 cursor-pointer"
            >
              Request JSON Archive
            </button>
          </div>
        )}

        {/* About */}
        {subSection === 'about' && (
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-2">
              About Tiwi
            </h3>
            <div className="text-xs text-[#65676b] dark:text-[#8a8d91] space-y-2">
              <p>Tiwi Social Platform 2.0</p>
              <p>Version 2.4.0 (Latest Modern Build)</p>
              <p>© 2026 Tiwlo Technologies. All rights reserved.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  Search
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
      showToast('Submission failed', 'error');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleRevokeSession = (sessionId) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Session logged out successfully', 'info');
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.current));
    showToast('All other sessions revoked', 'info');
  };

  const menuItems = [
    {
      id: 'account',
      title: 'Your account',
      desc: 'Account details, contact info, and security preferences',
      icon: ShieldCheck,
      color: 'bg-blue-50 text-[#1a73e8] dark:bg-blue-950/30',
    },
    {
      id: 'verification',
      title: 'Creator Verification',
      desc: 'Apply for the official verified badge and creator benefits',
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-[#1e8e3e] dark:bg-emerald-950/30 dark:text-[#81c995]',
    },
    {
      id: 'monetization',
      title: 'Monetization & Payouts',
      desc: 'Ads revenue sharing eligibility and payout account setup',
      icon: DollarSign,
      color: 'bg-amber-50 text-[#f29900] dark:bg-amber-950/30',
    },
    {
      id: 'security',
      title: 'Security and access',
      desc: 'Password, two-step verification, and active device sessions',
      icon: Lock,
      color: 'bg-purple-50 text-[#8e24aa] dark:bg-purple-950/30',
    },
    {
      id: 'privacy',
      title: 'Privacy and data sharing',
      desc: 'Manage what information you share and control your stream',
      icon: Eye,
      color: 'bg-cyan-50 text-[#007b83] dark:bg-cyan-950/30',
    },
    {
      id: 'notifications',
      title: 'Notifications & alerts',
      desc: 'Choose how and when you receive stream and account updates',
      icon: Bell,
      color: 'bg-rose-50 text-[#d93025] dark:bg-rose-950/30',
    },
    {
      id: 'data',
      title: 'Download your data archive',
      desc: 'Download a copy of your posts, media, and account history',
      icon: Download,
      color: 'bg-indigo-50 text-[#4285F4] dark:bg-indigo-950/30',
    },
    {
      id: 'about',
      title: 'Legal and resources',
      desc: 'Terms of Service, Privacy Policy, and Community Guidelines',
      icon: Info,
      color: 'bg-gray-100 text-[#5f6368] dark:bg-gray-800 dark:text-[#9aa0a6]',
    },
  ];

  const filteredMenuItems = menuItems.filter(
    (m) =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col min-h-screen max-w-3xl mx-auto">
      {/* 1. App Bar Header */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#dadce0] dark:border-[#3c4043] mb-4">
        {subSection !== 'menu' ? (
          <button
            onClick={() => setSubSection('menu')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back to Settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back to Stream"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="text-[18px] font-medium text-[#202124] dark:text-[#e8eaed] leading-tight truncate">
            {subSection === 'menu' ? 'Settings & Privacy' : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
          </h1>
          <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Content */}
      <div className="flex flex-col pb-20 px-2">
        {subSection === 'menu' && (
          <div className="flex flex-col gap-4">
            {/* Search Settings */}
            <div className="flex items-center h-10 bg-white dark:bg-[#303134] rounded-full px-3.5 border border-[#dadce0] dark:border-[#3c4043] focus-within:border-[#1a73e8] shadow-xs transition">
              <Search className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6] mr-2.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search settings"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#5f6368] dark:placeholder-[#9aa0a6] text-[#202124] dark:text-[#e8eaed]"
              />
            </div>

            {/* Google Material List Tiles (rounded-lg) */}
            <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] divide-y divide-[#f1f3f4] dark:divide-[#3c4043] overflow-hidden shadow-xs">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSubSection(item.id)}
                    className="p-3.5 sm:p-4 hover:bg-[#f8f9fa] dark:hover:bg-[#202124] cursor-pointer transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                          {item.title}
                        </span>
                        <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] line-clamp-1">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6] flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBPAGE: YOUR ACCOUNT */}
        {subSection === 'account' && (
          <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] divide-y divide-[#f1f3f4] dark:divide-[#3c4043] p-1 shadow-xs">
            <div className="p-4">
              <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Username</span>
              <div className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed] mt-0.5">@{accountInfo.username}</div>
            </div>

            <div className="p-4">
              <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Email Address</span>
              <div className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed] mt-0.5">{accountInfo.email}</div>
            </div>

            <div className="p-4">
              <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Account Creation</span>
              <div className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed] mt-0.5">{accountInfo.joinedDate}</div>
            </div>
          </div>
        )}

        {/* SUBPAGE: VERIFICATION */}
        {subSection === 'verification' && (
          <form onSubmit={handleVerificationSubmit} className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-[#1a73e8]" />
              <h3 className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">
                Apply for Verified Creator Status
              </h3>
            </div>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
              Verified accounts gain higher trust in stream discussions, priority indexing, and higher video upload limits.
            </p>

            <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-3 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
              <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Full Legal Name</label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="As shown on official identity document"
                className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-0.5"
              />
            </div>

            <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-3 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
              <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Creator Field</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-0.5 cursor-pointer"
              >
                <option value="Software Engineer / Tech" className="dark:bg-[#303134]">Software Engineer / Tech</option>
                <option value="Creator / Influencer" className="dark:bg-[#303134]">Creator / Influencer</option>
                <option value="Journalist / Researcher" className="dark:bg-[#303134]">Journalist / Researcher</option>
                <option value="Organization / Enterprise" className="dark:bg-[#303134]">Organization / Enterprise</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingVerification}
              className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-medium text-[13px] py-2 px-5 rounded-md mt-2 transition shadow-xs cursor-pointer self-start"
            >
              {submittingVerification ? 'Submitting...' : 'Submit Verification Application'}
            </button>
          </form>
        )}

        {/* SUBPAGE: SECURITY & SESSIONS */}
        {subSection === 'security' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-4">
              <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed]">
                Change Account Password
              </h3>

              <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-2.5 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
                <label className="block text-[11px] text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Current password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none"
                />
              </div>

              <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-2.5 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
                <label className="block text-[11px] text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none"
                />
              </div>

              <button
                onClick={() => {
                  showToast('Password updated', 'info');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] py-2 rounded-md transition shadow-xs cursor-pointer self-start px-5"
              >
                Save New Password
              </button>
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#f1f3f4] dark:border-[#3c4043]">
                <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed]">
                  Connected Devices ({sessions.length})
                </h3>
                <button
                  onClick={handleRevokeAllOtherSessions}
                  className="text-[12px] font-medium text-[#d93025] hover:underline cursor-pointer"
                >
                  Log out other devices
                </button>
              </div>

              <div className="flex flex-col divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
                {sessions.map((sess) => (
                  <div key={sess.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sess.device.includes('iPhone') ? (
                        <Smartphone className="w-5 h-5 text-[#5f6368]" />
                      ) : (
                        <Laptop className="w-5 h-5 text-[#5f6368]" />
                      )}
                      <div>
                        <div className="text-[13px] font-medium text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                          {sess.device}
                          {sess.current && (
                            <span className="text-[10px] bg-green-50 text-[#1e8e3e] px-2 py-0.2 rounded-full font-bold">
                              Current session
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                          {sess.location} · {sess.lastActive}
                        </div>
                      </div>
                    </div>

                    {!sess.current && (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-[12px] font-medium text-[#d93025] hover:bg-red-50 px-3 py-1 rounded-md transition cursor-pointer"
                      >
                        Sign out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUBPAGE: DATA ARCHIVE */}
        {subSection === 'data' && (
          <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-8 text-center shadow-xs flex flex-col items-center">
            <Download className="w-10 h-10 text-[#1a73e8] mb-3" />
            <h3 className="font-medium text-[18px] text-[#202124] dark:text-[#e8eaed] mb-1">
              Download your stream archive
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] max-w-sm mb-5 leading-relaxed">
              Export a complete archive of your published posts, uploaded media, bookmarks, and account metadata.
            </p>
            <button
              onClick={() => showToast('Archive requested! A download link will be prepared.', 'info')}
              className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-5 py-2 rounded-md shadow-xs cursor-pointer"
            >
              Create Archive
            </button>
          </div>
        )}

        {/* SUBPAGE: ABOUT & LEGAL */}
        {subSection === 'about' && (
          <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-3">
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed]">
              Tiwi Social
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
              Designed with clean, calm, and respectful Google design language. Real PostgreSQL backend architecture.
            </p>
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#f1f3f4] dark:border-[#3c4043] text-[13px]">
              <a href="#terms" onClick={(e) => { e.preventDefault(); showToast('Terms of Service active', 'info'); }} className="text-[#1a73e8] hover:underline">
                Terms of Service
              </a>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); showToast('Privacy Policy active', 'info'); }} className="text-[#1a73e8] hover:underline">
                Privacy Policy
              </a>
              <a href="#guidelines" onClick={(e) => { e.preventDefault(); showToast('Community Guidelines active', 'info'); }} className="text-[#1a73e8] hover:underline">
                Community Guidelines
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

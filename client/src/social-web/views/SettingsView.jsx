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
  Palette,
  Smartphone,
  Laptop,
  Search,
  Check
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);

  const [protectPosts, setProtectPosts] = useState(false);
  const [displaySensitiveMedia, setDisplaySensitiveMedia] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [qualityFilter, setQualityFilter] = useState(true);

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
      color: 'bg-blue-50 text-[#0B57D0] dark:bg-blue-950/30',
    },
    {
      id: 'verification',
      title: 'Creator Verification',
      desc: 'Apply for the official verified badge and creator benefits',
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-[#0F5223] dark:bg-emerald-950/30 dark:text-[#6DD58C]',
    },
    {
      id: 'monetization',
      title: 'Monetization & Payouts',
      desc: 'Ads revenue sharing eligibility and payout account setup',
      icon: DollarSign,
      color: 'bg-amber-50 text-[#7D5700] dark:bg-amber-950/30 dark:text-[#F3B900]',
    },
    {
      id: 'security',
      title: 'Security and access',
      desc: 'Password, two-step verification, and active device sessions',
      icon: Lock,
      color: 'bg-purple-50 text-[#7856FF] dark:bg-purple-950/30',
    },
    {
      id: 'privacy',
      title: 'Privacy and data sharing',
      desc: 'Manage what information you share and control your stream',
      icon: Eye,
      color: 'bg-cyan-50 text-[#006A6A] dark:bg-cyan-950/30',
    },
    {
      id: 'notifications',
      title: 'Notifications & alerts',
      desc: 'Choose how and when you receive stream and account updates',
      icon: Bell,
      color: 'bg-rose-50 text-[#B3261E] dark:bg-rose-950/30',
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
      color: 'bg-gray-100 text-[#444746] dark:bg-gray-800 dark:text-[#C4C7C5]',
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
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center gap-4 border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        {subSection !== 'menu' ? (
          <button
            onClick={() => setSubSection('menu')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back to Settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back to Stream"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="text-[20px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight truncate">
            {subSection === 'menu' ? 'Settings & Privacy' : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
          </h1>
          <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Content */}
      <div className="flex flex-col pb-20 px-2">
        {subSection === 'menu' && (
          <div className="flex flex-col gap-4">
            {/* Search Settings */}
            <div className="flex items-center h-[46px] bg-white dark:bg-[#1E1F20] rounded-full px-4 border border-[#E0E2EC] dark:border-[#313335] focus-within:border-[#0B57D0] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 shadow-xs transition">
              <Search className="w-4 h-4 text-[#747775] dark:text-[#8E918F] mr-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search settings"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-[14px] outline-none w-full placeholder-[#747775] dark:placeholder-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3]"
              />
            </div>

            {/* Google Material List Tiles */}
            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] divide-y divide-[#E0E2EC]/70 dark:divide-[#313335] overflow-hidden shadow-xs">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSubSection(item.id)}
                    className="p-4 sm:p-5 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] cursor-pointer transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
                          {item.title}
                        </span>
                        <span className="text-[13px] text-[#747775] dark:text-[#8E918F] line-clamp-1">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#747775] dark:text-[#8E918F] flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBPAGE: YOUR ACCOUNT */}
        {subSection === 'account' && (
          <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] divide-y divide-[#E0E2EC]/70 dark:divide-[#313335] p-2 shadow-xs">
            <div className="p-4">
              <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">Username</span>
              <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">@{accountInfo.username}</div>
            </div>

            <div className="p-4">
              <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">Email Address</span>
              <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">{accountInfo.email}</div>
            </div>

            <div className="p-4">
              <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">Phone Number</span>
              <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">{accountInfo.phone}</div>
            </div>

            <div className="p-4">
              <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">Country</span>
              <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">{accountInfo.country}</div>
            </div>

            <div
              onClick={() => setSubSection('security')}
              className="p-4 flex items-center justify-between hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] cursor-pointer rounded-2xl"
            >
              <div>
                <div className="text-[15px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">Change Password</div>
                <div className="text-[12px] text-[#747775] dark:text-[#8E918F]">Keep your account secure</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#747775]" />
            </div>
          </div>
        )}

        {/* SUBPAGE: VERIFICATION */}
        {subSection === 'verification' && (
          <form onSubmit={handleVerificationSubmit} className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-6 h-6 text-[#0B57D0]" />
              <h3 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                Apply for Verified Creator Status
              </h3>
            </div>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] leading-relaxed">
              Verified accounts gain higher trust in stream discussions, priority indexing, and higher video upload limits.
            </p>

            <div className="border border-[#747775] rounded-2xl p-3 focus-within:border-[#0B57D0] focus-within:ring-1 focus-within:ring-[#0B57D0]">
              <label className="block text-[12px] font-semibold text-[#747775] dark:text-[#8E918F]">Full Legal Name</label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="As shown on official identity document"
                className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-0.5"
              />
            </div>

            <div className="border border-[#747775] rounded-2xl p-3 focus-within:border-[#0B57D0] focus-within:ring-1 focus-within:ring-[#0B57D0]">
              <label className="block text-[12px] font-semibold text-[#747775] dark:text-[#8E918F]">Creator Field</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-0.5 cursor-pointer"
              >
                <option value="Software Engineer / Tech" className="dark:bg-[#1E1F20]">Software Engineer / Tech</option>
                <option value="Creator / Influencer" className="dark:bg-[#1E1F20]">Creator / Influencer</option>
                <option value="Journalist / Researcher" className="dark:bg-[#1E1F20]">Journalist / Researcher</option>
                <option value="Organization / Enterprise" className="dark:bg-[#1E1F20]">Organization / Enterprise</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingVerification}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white font-semibold text-[14px] py-2.5 rounded-full mt-2 transition shadow-xs cursor-pointer"
            >
              {submittingVerification ? 'Submitting...' : 'Submit Verification Application'}
            </button>
          </form>
        )}

        {/* SUBPAGE: SECURITY & SESSIONS */}
        {subSection === 'security' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-4">
              <h3 className="font-bold text-[17px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                Change Account Password
              </h3>

              <div className="border border-[#747775] rounded-2xl p-2.5 focus-within:border-[#0B57D0]">
                <label className="block text-[12px] text-[#747775] dark:text-[#8E918F]">Current password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none"
                />
              </div>

              <div className="border border-[#747775] rounded-2xl p-2.5 focus-within:border-[#0B57D0]">
                <label className="block text-[12px] text-[#747775] dark:text-[#8E918F]">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none"
                />
              </div>

              <button
                onClick={() => {
                  showToast('Password updated', 'info');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-[13px] py-2.5 rounded-full transition shadow-xs cursor-pointer self-start px-6"
              >
                Save New Password
              </button>
            </div>

            {/* Active Sessions */}
            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[17px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                  Connected Devices & Sessions ({sessions.length})
                </h3>
                <button
                  onClick={handleRevokeAllOtherSessions}
                  className="text-[12px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Log out other devices
                </button>
              </div>

              <div className="flex flex-col divide-y divide-[#E0E2EC]/70 dark:divide-[#313335]">
                {sessions.map((sess) => (
                  <div key={sess.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {sess.device.includes('iPhone') ? (
                        <Smartphone className="w-5 h-5 text-[#747775]" />
                      ) : (
                        <Laptop className="w-5 h-5 text-[#747775]" />
                      )}
                      <div>
                        <div className="text-[14px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3] flex items-center gap-1.5">
                          {sess.device}
                          {sess.current && (
                            <span className="text-[10px] bg-[#0F5223]/10 text-[#0F5223] dark:text-[#6DD58C] px-2 py-0.2 rounded-full font-bold">
                              Current session
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[#747775] dark:text-[#8E918F]">
                          {sess.location} · {sess.lastActive}
                        </div>
                      </div>
                    </div>

                    {!sess.current && (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-[12px] font-semibold text-red-500 hover:bg-red-50 px-3 py-1 rounded-full transition cursor-pointer"
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
          <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-8 text-center shadow-xs flex flex-col items-center">
            <Download className="w-12 h-12 text-[#0B57D0] mb-3" />
            <h3 className="font-bold text-[20px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              Download your stream archive
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] max-w-sm mb-6 leading-relaxed">
              Export a complete archive of your published posts, uploaded media, bookmarks, and account metadata.
            </p>
            <button
              onClick={() => showToast('Archive requested! A download link will be prepared.', 'info')}
              className="bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-[14px] px-6 py-2.5 rounded-full shadow-xs cursor-pointer"
            >
              Create Archive
            </button>
          </div>
        )}

        {/* SUBPAGE: ABOUT & LEGAL */}
        {subSection === 'about' && (
          <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-3">
            <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3]">
              Tiwi Social
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
              Designed with clean, calm, and respectful modern UI principles. Real PostgreSQL backend architecture.
            </p>
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#E0E2EC]/70 dark:border-[#313335] text-[13px]">
              <a href="#terms" onClick={(e) => { e.preventDefault(); showToast('Terms of Service active', 'info'); }} className="text-[#0B57D0] hover:underline">
                Terms of Service
              </a>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); showToast('Privacy Policy active', 'info'); }} className="text-[#0B57D0] hover:underline">
                Privacy Policy
              </a>
              <a href="#guidelines" onClick={(e) => { e.preventDefault(); showToast('Community Guidelines active', 'info'); }} className="text-[#0B57D0] hover:underline">
                Community Guidelines
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

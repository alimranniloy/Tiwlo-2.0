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

  // 1. Account Info State
  const [accountInfo] = useState({
    username: currentUser?.handle || 'tiwi_member',
    email: currentUser?.email || 'user@tiwlo.com',
    phone: '+1 (555) 019-2834',
    country: 'United States',
    joinedDate: 'October 2023',
  });

  // 2. Password & Security State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);

  // 3. Privacy State
  const [protectPosts, setProtectPosts] = useState(false);
  const [photoTagging, setPhotoTagging] = useState('anyone'); // 'anyone' | 'following' | 'off'
  const [allowDMsFrom, setAllowDMsFrom] = useState('everyone'); // 'everyone' | 'verified'
  const [displaySensitiveMedia, setDisplaySensitiveMedia] = useState(false);

  // 4. Notifications State
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [qualityFilter, setQualityFilter] = useState(true);

  // 5. Display & Themes State
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedBg, setSelectedBg] = useState('lights_out'); // 'default' | 'dim' | 'lights_out'
  const [fontSize, setFontSize] = useState('medium'); // 'small' | 'medium' | 'large'

  // 6. Verification Form State
  const [legalName, setLegalName] = useState('');
  const [category, setCategory] = useState('Software Engineer / Tech');
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Active Sessions Mock Data (Real-device management)
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
      desc: 'See information about your account, download an archive of your data, or learn about account deactivation options.',
      icon: ShieldCheck,
    },
    {
      id: 'verification',
      title: 'Tiwi Blue & Verification',
      desc: 'Apply for the blue verification checkmark, manage subscriber benefits, and unlock creator features.',
      icon: CheckCircle2,
    },
    {
      id: 'monetization',
      title: 'Monetization & Creator Payouts',
      desc: 'View your ads revenue sharing eligibility, tips setup, and subscriber earnings.',
      icon: DollarSign,
    },
    {
      id: 'security',
      title: 'Security and account access',
      desc: 'Manage your password, two-factor authentication, connected accounts, and active device sessions.',
      icon: Lock,
    },
    {
      id: 'privacy',
      title: 'Privacy and safety',
      desc: 'Manage what information you see and share on Tiwi, direct message permissions, and content filters.',
      icon: Eye,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      desc: 'Select the kinds of notifications you get about your activities, interests, and recommendations.',
      icon: Bell,
    },
    {
      id: 'display',
      title: 'Accessibility, display, and languages',
      desc: 'Manage your theme color, background darkness (Lights out/Dim), font scaling, and language preferences.',
      icon: Palette,
    },
    {
      id: 'data',
      title: 'Download an archive of your data',
      desc: 'Get a downloadable ZIP archive of your account information, posts, images, and messages.',
      icon: Download,
    },
    {
      id: 'about',
      title: 'Additional resources & legal',
      desc: 'Release notes, Terms of Service, Privacy Policy, Cookie Policy, and open-source notices.',
      icon: Info,
    },
  ];

  const filteredMenuItems = menuItems.filter(
    (m) =>
      m.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Twitter Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center gap-7 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        {subSection !== 'menu' ? (
          <button
            onClick={() => setSubSection('menu')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
            title="Back to Settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col min-w-0">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight truncate">
            {subSection === 'menu'
              ? 'Settings'
              : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
          </h1>
          <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Main Settings Explorer */}
      <div className="flex flex-col pb-24 md:pb-12">
        {/* Main Settings Menu */}
        {subSection === 'menu' && (
          <div className="flex flex-col">
            {/* Search Settings Input */}
            <div className="p-3 border-b border-[#EFF3F4] dark:border-[#2F3336]">
              <div className="flex items-center h-[42px] bg-[#EFF3F4] dark:bg-[#202327] rounded-full px-4 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] border border-transparent transition">
                <Search className="w-4 h-4 text-[#536471] dark:text-[#71767B] mr-3 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search Settings"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-transparent text-[15px] outline-none w-full placeholder-[#536471] dark:placeholder-[#71767B]"
                />
              </div>
            </div>

            {/* Menu List */}
            <div className="divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSubSection(item.id)}
                    className="px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <Icon className="w-5 h-5 text-[#536471] dark:text-[#71767B] flex-shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">
                          {item.title}
                        </span>
                        <span className="text-[13px] text-[#536471] dark:text-[#71767B] line-clamp-1">
                          {item.desc}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B] flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 1: YOUR ACCOUNT */}
        {/* ============================================================== */}
        {subSection === 'account' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            <div className="p-4 flex flex-col gap-1">
              <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
                Account information
              </h3>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                See your account details, including phone number and email address.
              </p>
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer">
              <div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Username</div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">@{accountInfo.username}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer">
              <div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Email</div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">{accountInfo.email}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer">
              <div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Phone</div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">{accountInfo.phone}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer">
              <div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Country / Region</div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">{accountInfo.country}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div
              onClick={() => setSubSection('security')}
              className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer"
            >
              <div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">Change your password</div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Change your password at any time.</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div
              onClick={() => setSubSection('data')}
              className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer"
            >
              <div>
                <div className="text-[15px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">Download an archive of your data</div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Get an archive of your posts, media, and history.</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
            </div>

            <div
              onClick={() => showToast('Account deactivation requested. Your data will be preserved for 30 days.', 'info')}
              className="p-4 flex items-center justify-between hover:bg-red-500/10 cursor-pointer text-red-500"
            >
              <div>
                <div className="text-[15px] font-bold">Deactivate your account</div>
                <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Find out how you can deactivate your Tiwi account.</div>
              </div>
              <ChevronRight className="w-5 h-5 text-red-500" />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 2: TIWI BLUE & VERIFICATION */}
        {/* ============================================================== */}
        {subSection === 'verification' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-6 h-6 text-[#1D9BF0] fill-current" />
                <h3 className="text-[17px] font-bold text-[#0F1419] dark:text-[#E7E9EA]">
                  Tiwi Verified
                </h3>
              </div>
              <p className="text-[14px] text-[#536471] dark:text-[#71767B] leading-relaxed">
                Verified accounts receive the blue badge, prioritized rankings in conversations and search, and higher video upload limits.
              </p>
            </div>

            <form onSubmit={handleVerificationSubmit} className="flex flex-col gap-4 mt-2">
              <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2.5 focus-within:border-[#1D9BF0]">
                <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As shown on government ID"
                  className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
                />
              </div>

              <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2.5 focus-within:border-[#1D9BF0]">
                <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5 cursor-pointer"
                >
                  <option value="Software Engineer / Tech" className="dark:bg-black">Software Engineer / Tech</option>
                  <option value="Creator / Influencer" className="dark:bg-black">Creator / Influencer</option>
                  <option value="Journalist / News" className="dark:bg-black">Journalist / News</option>
                  <option value="Business / Enterprise" className="dark:bg-black">Business / Enterprise</option>
                  <option value="Government / Official" className="dark:bg-black">Government / Official</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingVerification}
                className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 text-white font-bold text-[15px] py-3 rounded-full mt-2 transition cursor-pointer"
              >
                {submittingVerification ? 'Submitting...' : 'Submit Verification Request'}
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 3: MONETIZATION & CREATOR PAYOUTS */}
        {/* ============================================================== */}
        {subSection === 'monetization' && (
          <div className="p-4 flex flex-col gap-5">
            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C] flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-[#00BA7C]" />
                <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Creator Monetization
                </h3>
              </div>
              <p className="text-[14px] text-[#536471] dark:text-[#71767B] leading-relaxed">
                Earn money from Ads Revenue Sharing and Creator Subscriptions when you engage your audience on Tiwi.
              </p>
            </div>

            <div className="flex flex-col gap-4 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4">
              <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                Ads Revenue Sharing Eligibility
              </h4>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#536471] dark:text-[#71767B]">Subscribed to Premium</span>
                  <span className="text-[#00BA7C] font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Eligible
                  </span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#536471] dark:text-[#71767B]">5M impressions in past 3 months</span>
                  <span className="font-bold text-[#0F1419] dark:text-[#E7E9EA]">2.4M / 5.0M (48%)</span>
                </div>
                <div className="w-full bg-[#EFF3F4] dark:bg-[#202327] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1D9BF0] h-full w-[48%]" />
                </div>
                <div className="flex justify-between text-[13px] mt-1">
                  <span className="text-[#536471] dark:text-[#71767B]">At least 500 followers</span>
                  <span className="text-[#00BA7C] font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Complete
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigateTo('creator')}
                className="bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] font-bold text-[14px] py-2.5 rounded-full mt-2 transition cursor-pointer"
              >
                Go to Creator Hub
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 4: SECURITY & ACCOUNT ACCESS */}
        {/* ============================================================== */}
        {subSection === 'security' && (
          <div className="p-4 flex flex-col gap-6">
            <div>
              <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA] mb-1">
                Password & Security
              </h3>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                Manage your credentials, 2-factor authentication, and connected sessions.
              </p>
            </div>

            {/* Change Password Card */}
            <div className="flex flex-col gap-3 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4">
              <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                Change Password
              </h4>

              <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0]">
                <label className="block text-[12px] text-[#536471] dark:text-[#71767B]">Current password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#0F1419] dark:text-[#E7E9EA] outline-none"
                />
              </div>

              <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0]">
                <label className="block text-[12px] text-[#536471] dark:text-[#71767B]">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#0F1419] dark:text-[#E7E9EA] outline-none"
                />
              </div>

              <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0]">
                <label className="block text-[12px] text-[#536471] dark:text-[#71767B]">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] text-[#0F1419] dark:text-[#E7E9EA] outline-none"
                />
              </div>

              <button
                onClick={() => {
                  if (!newPassword || newPassword !== confirmPassword) {
                    showToast('Passwords do not match or cannot be empty', 'error');
                    return;
                  }
                  showToast('Password updated successfully', 'info');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[14px] py-2 rounded-full mt-1 transition cursor-pointer"
              >
                Save Password
              </button>
            </div>

            {/* Two Factor Authentication Switch */}
            <div className="flex items-center justify-between p-4 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Two-factor authentication (2FA)
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Help protect your account from unauthorized access with a verification code.
                </p>
              </div>
              <input
                type="checkbox"
                checked={twoFactorAuth}
                onChange={(e) => {
                  setTwoFactorAuth(e.target.checked);
                  showToast(e.target.checked ? '2FA Enabled' : '2FA Disabled', 'info');
                }}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>

            {/* Active Sessions */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Active Sessions ({sessions.length})
                </h4>
                <button
                  onClick={handleRevokeAllOtherSessions}
                  className="text-[13px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Log out of all other sessions
                </button>
              </div>

              <div className="divide-y divide-[#EFF3F4] dark:divide-[#2F3336] border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl overflow-hidden">
                {sessions.map((sess) => (
                  <div key={sess.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {sess.device.includes('iPhone') ? (
                        <Smartphone className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                      ) : (
                        <Laptop className="w-5 h-5 text-[#536471] dark:text-[#71767B]" />
                      )}
                      <div>
                        <div className="text-[14px] font-bold text-[#0F1419] dark:text-[#E7E9EA] flex items-center gap-1.5">
                          {sess.device}
                          {sess.current && (
                            <span className="text-[11px] bg-[#00BA7C]/15 text-[#00BA7C] px-1.5 py-0.2 rounded font-semibold">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[#536471] dark:text-[#71767B]">
                          {sess.location} · {sess.ip} · {sess.lastActive}
                        </div>
                      </div>
                    </div>

                    {!sess.current && (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-[12px] font-bold text-red-500 hover:bg-red-500/10 px-2.5 py-1 rounded-full transition cursor-pointer"
                      >
                        Log out
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 5: PRIVACY AND SAFETY */}
        {/* ============================================================== */}
        {subSection === 'privacy' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            <div className="p-4 flex items-center justify-between">
              <div className="max-w-[85%]">
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Protect your posts
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B] leading-relaxed">
                  When selected, your posts and other account information are only visible to people who follow you.
                </p>
              </div>
              <input
                type="checkbox"
                checked={protectPosts}
                onChange={(e) => setProtectPosts(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="max-w-[85%]">
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Display media that may contain sensitive content
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B] leading-relaxed">
                  Allow viewing of sensitive images and videos directly without a confirmation warning.
                </p>
              </div>
              <input
                type="checkbox"
                checked={displaySensitiveMedia}
                onChange={(e) => setDisplaySensitiveMedia(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>

            <div className="p-4 flex flex-col gap-2">
              <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                Direct Messages Permissions
              </h4>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                Control who can send you direct message requests.
              </p>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-[14px] text-[#0F1419] dark:text-[#E7E9EA] cursor-pointer">
                  <input
                    type="radio"
                    name="dms"
                    checked={allowDMsFrom === 'everyone'}
                    onChange={() => setAllowDMsFrom('everyone')}
                    className="accent-[#1D9BF0]"
                  />
                  <span>Allow from everyone</span>
                </label>
                <label className="flex items-center gap-2 text-[14px] text-[#0F1419] dark:text-[#E7E9EA] cursor-pointer">
                  <input
                    type="radio"
                    name="dms"
                    checked={allowDMsFrom === 'verified'}
                    onChange={() => setAllowDMsFrom('verified')}
                    className="accent-[#1D9BF0]"
                  />
                  <span>Verified users only</span>
                </label>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                Photo Tagging
              </h4>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                Allow people to tag you in photos.
              </p>
              <div className="flex flex-col gap-1.5 mt-1">
                {['anyone', 'following', 'off'].map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-[14px] text-[#0F1419] dark:text-[#E7E9EA] cursor-pointer">
                    <input
                      type="radio"
                      name="photoTagging"
                      checked={photoTagging === mode}
                      onChange={() => setPhotoTagging(mode)}
                      className="accent-[#1D9BF0]"
                    />
                    <span className="capitalize">{mode === 'following' ? 'Only people you follow' : mode}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 6: NOTIFICATIONS */}
        {/* ============================================================== */}
        {subSection === 'notifications' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Quality filter
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Filter out lower-quality content from your notifications, such as duplicate posts.
                </p>
              </div>
              <input
                type="checkbox"
                checked={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Push notifications
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Receive alerts when someone interacts with your posts, replies, or mentions.
                </p>
              </div>
              <input
                type="checkbox"
                checked={pushNotifs}
                onChange={(e) => setPushNotifs(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Email notifications
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Receive periodic digest emails, product updates, and security alerts.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 7: ACCESSIBILITY, DISPLAY, AND LANGUAGES */}
        {/* ============================================================== */}
        {subSection === 'display' && (
          <div className="p-4 flex flex-col gap-6">
            <div>
              <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA] mb-1">
                Customize your view
              </h3>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                Manage your font size, color theme, and background. These settings affect all accounts on this browser.
              </p>
            </div>

            {/* Font scaling */}
            <div className="flex flex-col gap-2 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4">
              <span className="text-[13px] font-bold text-[#536471] dark:text-[#71767B]">Font Size</span>
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-[12px] font-bold">Aa</span>
                <div className="flex gap-2 flex-1 justify-around">
                  {['small', 'medium', 'large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setFontSize(size);
                        showToast(`Font set to ${size}`, 'info');
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition ${
                        fontSize === size
                          ? 'bg-[#1D9BF0] text-white'
                          : 'bg-[#EFF3F4] dark:bg-[#202327] text-[#0F1419] dark:text-[#E7E9EA]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <span className="text-[18px] font-bold">Aa</span>
              </div>
            </div>

            {/* Accent Color picker */}
            <div className="flex flex-col gap-2 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4">
              <span className="text-[13px] font-bold text-[#536471] dark:text-[#71767B]">Color Theme</span>
              <div className="flex items-center justify-between pt-2">
                {[
                  { id: 'blue', hex: '#1D9BF0' },
                  { id: 'yellow', hex: '#FFD400' },
                  { id: 'pink', hex: '#F91880' },
                  { id: 'purple', hex: '#7856FF' },
                  { id: 'orange', hex: '#FF7A00' },
                  { id: 'green', hex: '#00BA7C' },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => {
                      setSelectedColor(color.id);
                      showToast(`Accent set to ${color.id}`, 'info');
                    }}
                    style={{ backgroundColor: color.hex }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white transition transform active:scale-95 shadow-sm"
                  >
                    {selectedColor === color.id && <Check className="w-5 h-5 stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Selector: Default, Dim, Lights Out */}
            <div className="flex flex-col gap-2 border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4">
              <span className="text-[13px] font-bold text-[#536471] dark:text-[#71767B]">Background</span>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <button
                  onClick={() => setSelectedBg('default')}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[14px] bg-white text-black transition ${
                    selectedBg === 'default' ? 'border-[#1D9BF0]' : 'border-transparent shadow-xs'
                  }`}
                >
                  {selectedBg === 'default' && <Check className="w-4 h-4 text-[#1D9BF0]" />}
                  <span>Default</span>
                </button>

                <button
                  onClick={() => setSelectedBg('dim')}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[14px] bg-[#15202B] text-white transition ${
                    selectedBg === 'dim' ? 'border-[#1D9BF0]' : 'border-transparent shadow-xs'
                  }`}
                >
                  {selectedBg === 'dim' && <Check className="w-4 h-4 text-[#1D9BF0]" />}
                  <span>Dim</span>
                </button>

                <button
                  onClick={() => setSelectedBg('lights_out')}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-[14px] bg-black text-white transition ${
                    selectedBg === 'lights_out' ? 'border-[#1D9BF0]' : 'border-transparent shadow-xs'
                  }`}
                >
                  {selectedBg === 'lights_out' && <Check className="w-4 h-4 text-[#1D9BF0]" />}
                  <span>Lights out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 8: DATA ARCHIVE */}
        {/* ============================================================== */}
        {subSection === 'data' && (
          <div className="p-8 flex flex-col items-center text-center">
            <Download className="w-14 h-14 text-[#1D9BF0] mb-4" />
            <h3 className="font-extrabold text-[22px] text-[#0F1419] dark:text-[#E7E9EA] mb-2">
              Download an archive of your data
            </h3>
            <p className="text-[14px] text-[#536471] dark:text-[#71767B] max-w-sm mb-6 leading-relaxed">
              Get insights into the data Tiwi stores for your account. This includes your profile info, posts, direct messages, followers, and media.
            </p>
            <button
              onClick={() => showToast('Archive requested! We will notify you and send a link when ready (usually within 24 hours).', 'info')}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[15px] px-6 py-2.5 rounded-full cursor-pointer transition shadow-xs"
            >
              Request archive
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUBPAGE 9: ABOUT & LEGAL */}
        {/* ============================================================== */}
        {subSection === 'about' && (
          <div className="p-4 flex flex-col gap-4 text-[14px] text-[#536471] dark:text-[#71767B]">
            <div className="border-b border-[#EFF3F4] dark:border-[#2F3336] pb-4">
              <h3 className="font-extrabold text-[18px] text-[#0F1419] dark:text-[#E7E9EA]">
                Tiwi Social v2.5
              </h3>
              <p className="text-[13px] text-[#536471] dark:text-[#71767B] mt-1">
                Authentic Real-Time Social Platform powered by PostgreSQL and Node.js.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <a href="#terms" onClick={(e) => { e.preventDefault(); showToast('Terms of Service: Standard User Agreement applies.', 'info'); }} className="text-[#1D9BF0] hover:underline flex items-center justify-between">
                <span>Terms of Service</span>
                <ChevronRight className="w-4 h-4 text-[#536471]" />
              </a>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); showToast('Privacy Policy: End-to-end user encryption enforced.', 'info'); }} className="text-[#1D9BF0] hover:underline flex items-center justify-between">
                <span>Privacy Policy</span>
                <ChevronRight className="w-4 h-4 text-[#536471]" />
              </a>
              <a href="#cookies" onClick={(e) => { e.preventDefault(); showToast('Cookie Policy: Minimal essential cookies used.', 'info'); }} className="text-[#1D9BF0] hover:underline flex items-center justify-between">
                <span>Cookie Policy</span>
                <ChevronRight className="w-4 h-4 text-[#536471]" />
              </a>
              <a href="#legal" onClick={(e) => { e.preventDefault(); showToast('Legal Notices: © 2026 Tiwi Corporation.', 'info'); }} className="text-[#1D9BF0] hover:underline flex items-center justify-between">
                <span>Legal Notices</span>
                <ChevronRight className="w-4 h-4 text-[#536471]" />
              </a>
            </div>

            <div className="pt-4 text-[12px] text-[#536471] dark:text-[#71767B]">
              © 2026 Tiwi Corp. All rights reserved.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

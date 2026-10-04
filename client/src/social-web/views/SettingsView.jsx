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
  CheckCircle2
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SettingsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [subSection, setSubSection] = useState('menu');

  // Verification Form State
  const [legalName, setLegalName] = useState('');
  const [category, setCategory] = useState('Creator / Influencer');
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Security Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Privacy State
  const [protectPosts, setProtectPosts] = useState(false);
  const [photoTagging, setPhotoTagging] = useState(true);

  // Notification State
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);

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

  const menuItems = [
    {
      id: 'verification',
      title: 'Verified Organizations & Blue',
      desc: 'Sign up for Blue or apply for verified status',
      icon: ShieldCheck
    },
    {
      id: 'security',
      title: 'Security and account access',
      desc: 'Manage your account security, password, and connected apps',
      icon: Lock
    },
    {
      id: 'privacy',
      title: 'Privacy and safety',
      desc: 'Manage what information you see and share on Tiwi',
      icon: Eye
    },
    {
      id: 'notifications',
      title: 'Notifications',
      desc: 'Select the kinds of notifications you get about your activities',
      icon: Bell
    },
    {
      id: 'data',
      title: 'Download an archive of your data',
      desc: 'Get an archive of your account information, posts, and media',
      icon: Download
    },
    {
      id: 'about',
      title: 'Additional resources & legal',
      desc: 'Release notes, Terms of Service, Privacy Policy, and Cookies',
      icon: Info
    },
  ];

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center gap-7 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        {subSection !== 'menu' ? (
          <button
            onClick={() => setSubSection('menu')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
            {subSection === 'menu' ? 'Settings' : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
          </h1>
          <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
            @{currentUser?.handle || 'user'}
          </span>
        </div>
      </div>

      {/* 2. Settings Content */}
      <div className="flex flex-col pb-24 md:pb-12">
        {/* Main Settings Menu */}
        {subSection === 'menu' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            {menuItems.map((item) => {
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
        )}

        {/* Verification Subpage */}
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
                  className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
                >
                  <option value="Creator / Influencer">Creator / Influencer</option>
                  <option value="Journalist / News">Journalist / News</option>
                  <option value="Software Engineer / Tech">Software Engineer / Tech</option>
                  <option value="Business / Enterprise">Business / Enterprise</option>
                  <option value="Government / Official">Government / Official</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingVerification}
                className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[15px] py-3 rounded-full mt-2 transition"
              >
                {submittingVerification ? 'Submitting...' : 'Submit Verification Request'}
              </button>
            </form>
          </div>
        )}

        {/* Security Subpage */}
        {subSection === 'security' && (
          <div className="p-4 flex flex-col gap-5">
            <h3 className="font-bold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
              Password & Two-factor authentication
            </h3>

            <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2.5 focus-within:border-[#1D9BF0]">
              <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">
                Current password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
              />
            </div>

            <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2.5 focus-within:border-[#1D9BF0]">
              <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
              />
            </div>

            <button
              onClick={() => {
                showToast('Password updated', 'info');
                setOldPassword('');
                setNewPassword('');
                setSubSection('menu');
              }}
              className="bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] font-bold text-[15px] py-3 rounded-full transition"
            >
              Update password
            </button>
          </div>
        )}

        {/* Privacy Subpage */}
        {subSection === 'privacy' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Protect your posts
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Only current followers will be able to see your posts and media.
                </p>
              </div>
              <input
                type="checkbox"
                checked={protectPosts}
                onChange={(e) => setProtectPosts(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0]"
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Photo tagging
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Allow anyone to tag you in photos.
                </p>
              </div>
              <input
                type="checkbox"
                checked={photoTagging}
                onChange={(e) => setPhotoTagging(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0]"
              />
            </div>
          </div>
        )}

        {/* Notifications Subpage */}
        {subSection === 'notifications' && (
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Push notifications
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Receive alerts when someone interacts with your posts.
                </p>
              </div>
              <input
                type="checkbox"
                checked={pushNotifs}
                onChange={(e) => setPushNotifs(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0]"
              />
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
                  Email notifications
                </h4>
                <p className="text-[13px] text-[#536471] dark:text-[#71767B]">
                  Receive periodic digest emails and security notices.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="w-5 h-5 accent-[#1D9BF0]"
              />
            </div>
          </div>
        )}

        {/* Data Subpage */}
        {subSection === 'data' && (
          <div className="p-8 flex flex-col items-center text-center">
            <Download className="w-12 h-12 text-[#1D9BF0] mb-3" />
            <h3 className="font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] mb-1">
              Download your data archive
            </h3>
            <p className="text-[14px] text-[#536471] dark:text-[#71767B] max-w-sm mb-5">
              Request a ZIP archive of your posts, media, messages, and profile settings.
            </p>
            <button
              onClick={() => showToast('Archive requested. We will email you a download link when ready.', 'info')}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[15px] px-6 py-2.5 rounded-full"
            >
              Request archive
            </button>
          </div>
        )}

        {/* About Subpage */}
        {subSection === 'about' && (
          <div className="p-4 flex flex-col gap-3 text-[14px] text-[#536471] dark:text-[#71767B]">
            <p className="font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA]">
              Tiwi Social v2.4 (Twitter Clone Edition)
            </p>
            <p>© 2026 Tiwi Corporation. All rights reserved.</p>
            <div className="flex flex-col gap-2 mt-2">
              <a href="#terms" className="text-[#1D9BF0] hover:underline">Terms of Service</a>
              <a href="#privacy" className="text-[#1D9BF0] hover:underline">Privacy Policy</a>
              <a href="#rules" className="text-[#1D9BF0] hover:underline">Community Rules</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

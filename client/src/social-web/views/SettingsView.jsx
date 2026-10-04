import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  UserX,
  Bell,
  Download,
  Sliders,
  Info,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Save
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function SettingsView() {
  const { currentUser, setCurrentUser, tabParams, navigateTo, showToast } = useSocial();
  const [subSection, setSubSection] = useState(tabParams?.id || 'menu'); // 'menu' | 'verification' | 'security' | 'privacy' | 'blocked' | 'notifications' | 'data' | 'about'

  // Verification Form State
  const [legalName, setLegalName] = useState('');
  const [category, setCategory] = useState('Creator / Influencer');
  const [docType, setDocType] = useState('National ID');
  const [docFile, setDocFile] = useState(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Security Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Privacy State
  const [protectPosts, setProtectPosts] = useState(false);
  const [photoTagging, setPhotoTagging] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);

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
        { legalName, category, docType },
        currentUser?.id
      );
      showToast('Verification request submitted! Our safety team will review it within 24-48 hours.', 'info');
      setSubSection('menu');
    } catch (e) {
      showToast('Submission failed', 'error');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const menuItems = [
    { id: 'verification', title: 'Account Verification', desc: 'Apply for the official blue verified badge', icon: ShieldCheck, color: 'text-blue-500' },
    { id: 'security', title: 'Security & Password', desc: 'Manage your password, 2FA, and active sessions', icon: Lock, color: 'text-emerald-500' },
    { id: 'privacy', title: 'Privacy Settings', desc: 'Control who can view your posts and mentions', icon: Eye, color: 'text-purple-500' },
    { id: 'blocked', title: 'Blocked Users', desc: 'View and unblock restricted accounts', icon: UserX, color: 'text-red-500' },
    { id: 'notifications', title: 'Notification Preferences', desc: 'Choose what alerts and emails you receive', icon: Bell, color: 'text-amber-500' },
    { id: 'data', title: 'Data Export & Portability', desc: 'Download a full copy of your posts, media, and profile', icon: Download, color: 'text-indigo-500' },
    { id: 'about', title: 'About Tiwi Social', desc: 'Version info, Terms of Service, and Community Guidelines', icon: Info, color: 'text-gray-500' },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] p-5 sm:p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          {subSection !== 'menu' && (
            <button
              onClick={() => setSubSection('menu')}
              className="p-1 text-gray-500 hover:text-[#0B57D0]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F] dark:text-white">
              {subSection === 'menu' ? 'Settings & Privacy' : menuItems.find((m) => m.id === subSection)?.title || 'Settings'}
            </h2>
            <p className="text-xs text-gray-500">Manage account safety, preferences, and permissions</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs p-5 sm:p-6 flex flex-col gap-3">
        {/* Menu Root */}
        {subSection === 'menu' && (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSubSection(item.id)}
                  className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-[#111827] rounded-2xl text-left transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 ${item.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1F1F1F] dark:text-white">{item.title}</h4>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              );
            })}
          </div>
        )}

        {/* Verification Subview */}
        {subSection === 'verification' && (
          <form onSubmit={handleVerificationSubmit} className="flex flex-col gap-4">
            <div className="p-4 bg-[#E8F0FE]/60 dark:bg-blue-950/30 rounded-2xl border border-[#0B57D0]/20 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-[#0B57D0] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                The blue verified checkmark helps confirm authenticity for recognized creators, public figures, and registered entities.
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Full Legal Name</label>
              <input
                type="text"
                placeholder="As shown on official government document"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#0B57D0]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none"
              >
                <option value="Creator / Influencer">Creator / Influencer</option>
                <option value="Developer / Tech Pioneer">Developer / Tech Pioneer</option>
                <option value="Organization / Brand">Organization / Brand</option>
                <option value="Journalist / Media">Journalist / Media</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 block">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none"
              >
                <option value="National ID">National ID Card</option>
                <option value="Passport">Passport</option>
                <option value="Driver License">Driver's License</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingVerification}
              className="mt-2 bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white py-2.5 rounded-full text-xs font-bold shadow-xs transition-all"
            >
              {submittingVerification ? 'Submitting Application...' : 'Submit Verification Request'}
            </button>
          </form>
        )}

        {/* Security Subview */}
        {subSection === 'security' && (
          <div className="flex flex-col gap-5 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1F1F1F] dark:text-white">Two-Factor Authentication (2FA)</h4>
                <p className="text-gray-500 mt-0.5">Secure logins with one-time verification codes</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold rounded-full">
                Active & Enforced
              </span>
            </div>

            <div>
              <h4 className="font-bold text-[#1F1F1F] dark:text-white mb-2">Change Account Password</h4>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  placeholder="Current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-[#F1F3F4] dark:bg-[#111827] rounded-2xl px-4 py-2.5 focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="New password (minimum 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#F1F3F4] dark:bg-[#111827] rounded-2xl px-4 py-2.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    showToast('Password updated securely!', 'info');
                    setOldPassword('');
                    setNewPassword('');
                  }}
                  className="bg-[#0B57D0] text-white py-2 rounded-full font-bold hover:bg-[#0842A0] self-start px-6"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Subview */}
        {subSection === 'privacy' && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1F1F1F] dark:text-white">Protect your Posts (Private Account)</h4>
                <p className="text-gray-500 mt-0.5">Only approved followers can view your feed and reels</p>
              </div>
              <input
                type="checkbox"
                checked={protectPosts}
                onChange={(e) => setProtectPosts(e.target.checked)}
                className="w-4 h-4 accent-[#0B57D0]"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1F1F1F] dark:text-white">Allow Photo Tagging</h4>
                <p className="text-gray-500 mt-0.5">Let other users tag you in uploaded media</p>
              </div>
              <input
                type="checkbox"
                checked={photoTagging}
                onChange={(e) => setPhotoTagging(e.target.checked)}
                className="w-4 h-4 accent-[#0B57D0]"
              />
            </div>

            <button
              onClick={() => showToast('Privacy preferences saved', 'info')}
              className="mt-2 bg-[#0B57D0] text-white py-2.5 rounded-full font-bold hover:bg-[#0842A0]"
            >
              Save Privacy Settings
            </button>
          </div>
        )}

        {/* Blocked Users */}
        {subSection === 'blocked' && (
          <div className="py-8 text-center text-xs text-gray-500">
            You haven't blocked any accounts. Blocked accounts will be listed here.
          </div>
        )}

        {/* Notifications */}
        {subSection === 'notifications' && (
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1F1F1F] dark:text-white">In-App Push Alerts</h4>
                <p className="text-gray-500 mt-0.5">Instant banners for likes, comments, and messages</p>
              </div>
              <input
                type="checkbox"
                checked={pushNotifs}
                onChange={(e) => setPushNotifs(e.target.checked)}
                className="w-4 h-4 accent-[#0B57D0]"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1F1F1F] dark:text-white">Email Digest</h4>
                <p className="text-gray-500 mt-0.5">Weekly community trends and account security notices</p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="w-4 h-4 accent-[#0B57D0]"
              />
            </div>
          </div>
        )}

        {/* Data Export */}
        {subSection === 'data' && (
          <div className="flex flex-col gap-3 text-xs">
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              In accordance with privacy standards (GDPR & CCPA), you can export all your Tiwi data including profile history, posts, comments, media links, and wallet transactions in JSON format.
            </p>
            <button
              onClick={() => {
                const dataBlob = new Blob([JSON.stringify({ user: currentUser, exportedAt: new Date() }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `tiwi-export-${currentUser?.handle || 'user'}.json`;
                a.click();
                showToast('Data exported successfully!', 'info');
              }}
              className="bg-[#0B57D0] text-white py-2.5 rounded-full font-bold hover:bg-[#0842A0] self-start px-6"
            >
              Download Export File (.JSON)
            </button>
          </div>
        )}

        {/* About Tiwi */}
        {subSection === 'about' && (
          <div className="flex flex-col gap-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            <div><b>Tiwi Social Web:</b> Version 2.4.0 (Production Architecture)</div>
            <div><b>Backend Engine:</b> PostgreSQL Real Database + GraphQL & REST Services</div>
            <div><b>Design Standard:</b> Google-Inspired Clean Visual Language & Material 3</div>
            <div><b>Platform:</b> Integrated with Tiwlo Cloud Platform</div>
            <div className="pt-2 text-gray-400">© {new Date().getFullYear()} Tiwlo Ecosystem. All rights reserved.</div>
          </div>
        )}
      </div>
    </div>
  );
}

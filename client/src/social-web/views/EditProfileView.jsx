import React, { useState } from 'react';
import { ArrowLeft, Camera, Check, Sparkles, MapPin, Globe, User, FileText } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function EditProfileView() {
  const { currentUser, setCurrentUser, navigateTo, showToast } = useSocial();
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [location, setLocation] = useState('Worldwide');
  const [website, setWebsite] = useState(currentUser?.website || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [coverPhoto, setCoverPhoto] = useState(currentUser?.coverPhoto || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await TiwiSocialAPI.uploadMedia(file);
      setAvatar(url);
      showToast('Avatar updated', 'info');
    } catch {
      showToast('Avatar upload failed', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await TiwiSocialAPI.uploadMedia(file);
      setCoverPhoto(url);
      showToast('Header banner updated', 'info');
    } catch {
      showToast('Header banner upload failed', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be blank', 'error');
      return;
    }

    setSaving(true);
    try {
      await TiwiSocialAPI.updateProfile(
        {
          name: name.trim(),
          bio: bio.trim(),
          location: location.trim(),
          website: website.trim(),
          avatar,
          coverPhoto,
        },
        currentUser?.id
      );

      if (setCurrentUser) {
        setCurrentUser((prev) => ({
          ...prev,
          name: name.trim(),
          bio: bio.trim(),
          location: location.trim(),
          website: website.trim(),
          avatar,
          coverPhoto,
        }));
      }

      showToast('Profile updated successfully', 'info');
      navigateTo('profile', currentUser?.handle || currentUser?.id);
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('profile', currentUser?.handle || currentUser?.id)}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
            Edit Profile
          </h1>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[13px] px-5 py-2 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* 2. Main Profile Edit Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden mb-4">
        {/* Cover Photo Editor */}
        <div className="relative h-44 sm:h-52 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600">
          {coverPhoto && (
            <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          )}
          <label className="absolute inset-0 bg-black/30 hover:bg-black/40 flex items-center justify-center gap-2 text-white font-semibold text-xs cursor-pointer transition-all backdrop-blur-[1px]">
            <Camera className="w-5 h-5" />
            <span>{uploadingCover ? 'Uploading...' : 'Change Cover Photo'}</span>
            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </label>
        </div>

        {/* Avatar Editor */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="relative -mt-14 mb-5 inline-block">
            <img
              src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop'}
              alt="Avatar"
              className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white dark:ring-[#16161f] shadow-lg"
            />
            <label className="absolute inset-0 rounded-2xl bg-black/40 hover:bg-black/50 flex items-center justify-center text-white cursor-pointer transition-all">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] mb-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Display Name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] mb-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Bio</span>
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the Tiwi community about yourself..."
                className="w-full p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30 resize-none leading-relaxed"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA or Worldwide"
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            {/* Website */}
            <div>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] mb-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Website / Portfolio</span>
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

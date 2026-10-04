import React, { useState } from 'react';
import { ArrowLeft, Camera, Check } from 'lucide-react';
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
          website: website.trim(),
          avatar,
          coverPhoto,
        },
        currentUser?.id
      );

      const mergedUser = {
        ...currentUser,
        name: name.trim(),
        bio: bio.trim(),
        website: website.trim(),
        avatar: avatar || currentUser?.avatar,
        coverPhoto: coverPhoto || currentUser?.coverPhoto,
      };

      setCurrentUser(mergedUser);
      showToast('Profile saved successfully', 'info');
      navigateTo('profile', mergedUser.handle || mergedUser.id);
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen pb-24 md:pb-12">
      {/* 1. Google M3 Header */}
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#1E1F20]/90 backdrop-blur-md px-4 sm:px-6 h-[64px] flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('profile')}
            className="w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-[#1F1F1F] dark:text-[#E3E3E3] transition active:scale-95"
            title="Back to profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] sm:text-[20px] font-semibold text-[#1F1F1F] dark:text-[#E3E3E3]">
              Profile information
            </h1>
            <p className="text-[12px] text-[#747775] dark:text-[#8E918F]">
              Personalize your public profile on Tiwi
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="inline-flex items-center gap-2 bg-[#0B57D0] hover:bg-[#0842A0] text-white dark:bg-[#A8C7FA] dark:hover:bg-[#80AAEF] dark:text-[#062E6F] font-medium text-[14px] px-6 py-2 rounded-full transition shadow-xs active:scale-95 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* 2. Cover Banner */}
      <div className="relative w-full h-[180px] sm:h-[220px] bg-gradient-to-r from-[#D3E3FD] via-[#E8DEF8] to-[#FCE8E6] dark:from-[#004A77] dark:via-[#4A4458] dark:to-[#601410] flex items-center justify-center overflow-hidden">
        {coverPhoto && (
          <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
        )}
        <label className="absolute w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition z-10 backdrop-blur-xs">
          <Camera className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* 3. Avatar & Form Section */}
      <div className="px-4 sm:px-6 relative max-w-[680px] mx-auto w-full">
        {/* Profile Avatar with M3 elevation */}
        <div className="relative -mt-16 sm:-mt-20 mb-6 flex items-end justify-between">
          <div className="relative w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] rounded-full border-4 border-white dark:border-[#1E1F20] shadow-md overflow-hidden bg-white dark:bg-[#1E1F20] flex items-center justify-center group">
            <img
              src={
                avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
              }
              alt="Avatar"
              className="w-full h-full object-cover"
            />
            <label className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition">
              <Camera className="w-6 h-6" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 4. Google Material 3 Outlined Fields Card */}
        <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-5">
          {/* Name Field */}
          <div className="rounded-2xl border border-[#C4C7C5] dark:border-[#444746] p-3.5 focus-within:border-[#0B57D0] dark:focus-within:border-[#A8C7FA] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 dark:focus-within:ring-[#A8C7FA]/20 bg-[#F8FAFD]/50 dark:bg-[#131314]/50 transition">
            <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5]">Display Name</label>
            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-1 font-medium"
            />
          </div>

          {/* Bio Field */}
          <div className="rounded-2xl border border-[#C4C7C5] dark:border-[#444746] p-3.5 focus-within:border-[#0B57D0] dark:focus-within:border-[#A8C7FA] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 dark:focus-within:ring-[#A8C7FA]/20 bg-[#F8FAFD]/50 dark:bg-[#131314]/50 transition">
            <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5]">Bio</label>
            <textarea
              rows={3}
              value={bio}
              maxLength={160}
              placeholder="Tell the community about yourself..."
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none resize-none mt-1 leading-relaxed placeholder-[#747775] dark:placeholder-[#8E918F]"
            />
          </div>

          {/* Location Field */}
          <div className="rounded-2xl border border-[#C4C7C5] dark:border-[#444746] p-3.5 focus-within:border-[#0B57D0] dark:focus-within:border-[#A8C7FA] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 dark:focus-within:ring-[#A8C7FA]/20 bg-[#F8FAFD]/50 dark:bg-[#131314]/50 transition">
            <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5]">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-1"
            />
          </div>

          {/* Website Field */}
          <div className="rounded-2xl border border-[#C4C7C5] dark:border-[#444746] p-3.5 focus-within:border-[#0B57D0] dark:focus-within:border-[#A8C7FA] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 dark:focus-within:ring-[#A8C7FA]/20 bg-[#F8FAFD]/50 dark:bg-[#131314]/50 transition">
            <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5]">Website</label>
            <input
              type="text"
              value={website}
              placeholder="https://yourwebsite.com"
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-1 placeholder-[#747775] dark:placeholder-[#8E918F]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

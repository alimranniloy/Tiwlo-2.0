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
      {/* 1. Google Account Style Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#202124]/95 backdrop-blur-md px-4 sm:px-6 h-[56px] flex items-center justify-between border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('profile')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back to profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed]">
              Profile information
            </h1>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="inline-flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-5 py-2 rounded-md transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* 2. Cover Banner */}
      <div className="relative w-full h-[160px] sm:h-[200px] bg-gradient-to-r from-[#d2e3fc] via-[#e8eaed] to-[#ceead6] dark:from-[#183153] dark:to-[#202124] flex items-center justify-center overflow-hidden">
        {coverPhoto && (
          <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
        )}
        <label className="absolute w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition z-10">
          <Camera className="w-4 h-4" />
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
        {/* Profile Avatar */}
        <div className="relative -mt-14 sm:-mt-16 mb-6 flex items-end justify-between">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-[#202124] shadow-sm overflow-hidden bg-white dark:bg-[#303134] flex items-center justify-center group">
            <img
              src={
                avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
              }
              alt="Avatar"
              className="w-full h-full object-cover"
            />
            <label className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition">
              <Camera className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 4. Google Account Card (rounded-lg) */}
        <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-4">
          {/* Name Field */}
          <div className="rounded-md border border-[#dadce0] dark:border-[#5f6368] p-3 focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8] focus-within:ring-1 focus-within:ring-[#1a73e8] bg-white dark:bg-[#202124] transition">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-1 font-medium"
            />
          </div>

          {/* Bio Field */}
          <div className="rounded-md border border-[#dadce0] dark:border-[#5f6368] p-3 focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8] focus-within:ring-1 focus-within:ring-[#1a73e8] bg-white dark:bg-[#202124] transition">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Bio</label>
            <textarea
              rows={3}
              value={bio}
              maxLength={160}
              placeholder="Tell the community about yourself..."
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none resize-none mt-1 leading-relaxed placeholder-[#5f6368] dark:placeholder-[#9aa0a6]"
            />
          </div>

          {/* Location Field */}
          <div className="rounded-md border border-[#dadce0] dark:border-[#5f6368] p-3 focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8] focus-within:ring-1 focus-within:ring-[#1a73e8] bg-white dark:bg-[#202124] transition">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-1"
            />
          </div>

          {/* Website Field */}
          <div className="rounded-md border border-[#dadce0] dark:border-[#5f6368] p-3 focus-within:border-[#1a73e8] dark:focus-within:border-[#8ab4f8] focus-within:ring-1 focus-within:ring-[#1a73e8] bg-white dark:bg-[#202124] transition">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Website</label>
            <input
              type="text"
              value={website}
              placeholder="https://yourwebsite.com"
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-1 placeholder-[#5f6368] dark:placeholder-[#9aa0a6]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

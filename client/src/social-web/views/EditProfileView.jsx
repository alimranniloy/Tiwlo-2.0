import React, { useState } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';
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
      showToast('Profile saved', 'info');
      navigateTo('profile', mergedUser.handle || mergedUser.id);
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          <button
            onClick={() => navigateTo('profile')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA]">
            Edit profile
          </h1>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] font-bold text-[15px] px-5 py-1.5 rounded-full hover:opacity-90 active:scale-95 transition"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* 2. Cover Banner with Upload Button */}
      <div className="h-[200px] w-full bg-[#CFD9DE] dark:bg-[#333639] relative flex items-center justify-center overflow-hidden group">
        {coverPhoto && (
          <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
        )}
        <label className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition z-10">
          <Camera className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* 3. Avatar with Upload Button */}
      <div className="px-4 pb-4 relative">
        <div className="absolute -top-[67px] left-4">
          <div className="relative w-[134px] h-[134px] rounded-full border-4 border-white dark:border-black overflow-hidden bg-white dark:bg-black flex items-center justify-center group">
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

        {/* 4. Twitter Input Fields */}
        <div className="mt-20 flex flex-col gap-5">
          {/* Name Field */}
          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0] focus-within:ring-1 focus-within:ring-[#1D9BF0] transition">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">Name</label>
            <input
              type="text"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[16px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
            />
          </div>

          {/* Bio Field */}
          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0] focus-within:ring-1 focus-within:ring-[#1D9BF0] transition">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">Bio</label>
            <textarea
              rows={3}
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-transparent text-[16px] text-[#0F1419] dark:text-[#E7E9EA] outline-none resize-none mt-0.5 leading-relaxed"
            />
          </div>

          {/* Location Field */}
          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0] focus-within:ring-1 focus-within:ring-[#1D9BF0] transition">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-[16px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5"
            />
          </div>

          {/* Website Field */}
          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-2 focus-within:border-[#1D9BF0] focus-within:ring-1 focus-within:ring-[#1D9BF0] transition">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B]">Website</label>
            <input
              type="text"
              value={website}
              placeholder="https://yourwebsite.com"
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-transparent text-[16px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-0.5 placeholder-[#536471] dark:placeholder-[#71767B]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

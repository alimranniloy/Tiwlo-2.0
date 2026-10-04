import React, { useState } from 'react';
import { ArrowLeft, Camera, UploadCloud, CheckCircle2, Save } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function EditProfileView() {
  const { currentUser, setCurrentUser, navigateTo, showToast } = useSocial();
  const [name, setName] = useState(currentUser?.name || '');
  const [handle, setHandle] = useState(currentUser?.handle || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
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
    } catch (err) {
      showToast('Failed to upload image', 'error');
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
      showToast('Cover photo updated', 'info');
    } catch (err) {
      showToast('Failed to upload cover', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await TiwiSocialAPI.updateProfile(
        {
          name: name.trim(),
          handle: handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
          bio: bio.trim(),
          website: website.trim(),
          avatar,
          coverPhoto,
        },
        currentUser?.id
      );

      const mergedUser = {
        ...currentUser,
        ...(updated?.user || updated),
        name: name.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        website: website.trim(),
        avatar: avatar || currentUser?.avatar,
        coverPhoto: coverPhoto || currentUser?.coverPhoto,
      };

      setCurrentUser(mergedUser);
      try {
        localStorage.setItem('stockpro_user', JSON.stringify(mergedUser));
      } catch (e) {}

      showToast('Profile updated successfully!', 'info');
      navigateTo('profile', mergedUser.handle || mergedUser.id);
    } catch (err) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 md:pb-10 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
        <button
          onClick={() => navigateTo('profile')}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-[#0B57D0]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Profile</span>
        </button>
        <h2 className="text-sm font-bold text-[#1F1F1F] dark:text-white">Edit Profile</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white px-5 py-2 rounded-full text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {/* Main Edit Form Box */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 sm:p-8 border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-6">
        {/* Cover Photo */}
        <div>
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 block">
            Cover Banner
          </label>
          <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden bg-gradient-to-r from-[#0B57D0] to-[#4285F4] flex items-center justify-center group">
            {coverPhoto && (
              <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            )}
            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-xs font-semibold gap-2">
              <Camera className="w-5 h-5" />
              <span>{uploadingCover ? 'Uploading...' : 'Change Cover Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={uploadingCover}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <img
              src={avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-[#1E293B] shadow-md"
            />
            <label className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white">
              <Camera className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <span className="text-sm font-bold text-[#1F1F1F] dark:text-white block">Profile Picture</span>
            <span className="text-xs text-gray-500">
              {uploadingAvatar ? 'Uploading new avatar...' : 'JPG, PNG or GIF. Square 1:1 recommended.'}
            </span>
          </div>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F8F9FA] dark:bg-[#111827] text-sm text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 border border-transparent focus:border-[#0B57D0] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Username (@handle)
            </label>
            <div className="flex items-center bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl px-4 py-2.5">
              <span className="text-sm text-gray-400 mr-1">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full bg-transparent text-sm text-[#1F1F1F] dark:text-white border-none focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself..."
              className="w-full bg-[#F8F9FA] dark:bg-[#111827] text-sm text-[#1F1F1F] dark:text-white rounded-2xl p-4 border border-transparent focus:border-[#0B57D0] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
              Website / Link
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-[#F8F9FA] dark:bg-[#111827] text-sm text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 border border-transparent focus:border-[#0B57D0] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

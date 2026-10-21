import React, { useEffect, useState } from 'react';
import { Camera, Check } from 'lucide-react';

export default function OneProfileSettingsView({ currentUser, profile, onProfileUpdated, onUserUpdated }) {
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(currentUser?.name || '');
    setStoreName(currentUser?.storeName || '');
    setAvatar(currentUser?.avatar || '');
    setDateOfBirth(currentUser?.dateOfBirth || '');
    setAddress(currentUser?.address || '');
    setHeadline(profile?.headline || '');
    setBio(profile?.bio || '');
  }, [currentUser, profile]);

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Choose a JPG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photos must be 5 MB or smaller.');
      return;
    }

    setError('');
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/social/upload?type=profile_pic', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Profile photo upload failed.');
      }
      setAvatar(data.url);
    } catch (uploadError) {
      setError(uploadError.message || 'Profile photo upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          storeName: storeName.trim(),
          avatar,
          dateOfBirth,
          address: address.trim()
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save settings');
      onUserUpdated?.(data.user);
      const profileResponse = await fetch('/api/oneprofile/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, bio })
      });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok || !profileData.success) {
        throw new Error(profileData.error || 'Failed to save OneProfile details');
      }
      onProfileUpdated?.(profileData.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Account Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your personal details, profile photo, and security preferences.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5 max-w-2xl">
        {saved && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">{error}</div>}

        <div className="flex items-center gap-4">
          <img
            src={avatar || '/tiwlo-icon.png'}
            alt="Profile"
            className="h-16 w-16 rounded-full border border-slate-200 object-cover"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Camera className="h-4 w-4" />
            {uploadingAvatar ? 'Uploading…' : 'Upload JPG or PNG'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
              className="sr-only"
            />
          </label>
          <span className="text-xs text-slate-500">Max 5 MB</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
          <input
            type="email"
            value={currentUser?.email || ''}
            readOnly
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Date of Birth</label>
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Address</label>
          <textarea
            maxLength={2000}
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Your address"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Store / Profile Name</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Profile Headline</label>
          <input
            type="text"
            maxLength={255}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="What do you do?"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Bio</label>
          <textarea
            maxLength={5000}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={uploadingAvatar}
          className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

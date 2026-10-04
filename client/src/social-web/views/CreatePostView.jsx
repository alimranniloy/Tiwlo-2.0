import React, { useState } from 'react';
import {
  ArrowLeft,
  Image,
  Video,
  Smile,
  Globe,
  Users,
  Lock,
  X,
  UploadCloud,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CreatePostView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [caption, setCaption] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaUrls, setMediaUrls] = useState([]);
  const [audience, setAudience] = useState('public');
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState('');

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map((f) => TiwiSocialAPI.uploadMedia(f));
      const urls = await Promise.all(uploadPromises);
      setMediaUrls((prev) => [...prev, ...urls]);
      showToast('Media uploaded successfully!', 'info');
    } catch (err) {
      showToast(err.message || 'Media upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMedia = (index) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && mediaUrls.length === 0) {
      showToast('Please add some text or photos to your post', 'error');
      return;
    }

    setUploading(true);
    try {
      const parsedTags = tags
        .split(/[ ,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);

      await TiwiSocialAPI.createPost({
        caption: caption.trim(),
        images: mediaUrls,
        tags: parsedTags,
        userId: currentUser?.id,
      });

      showToast('Post created successfully!', 'info');
      navigateTo('feed');
    } catch (err) {
      showToast(err.message || 'Failed to publish post', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 md:pb-10 flex flex-col gap-5">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
        <button
          onClick={() => navigateTo('feed')}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-[#0B57D0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <h2 className="text-sm font-bold text-[#1F1F1F] dark:text-white">Create New Post</h2>

        <div className="w-16" />
      </div>

      {/* Main Form Box */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-5">
        {/* User Info & Audience Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
              alt={currentUser?.name}
              className="w-11 h-11 rounded-full object-cover"
            />
            <div>
              <div className="text-sm font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1">
                {currentUser?.name || 'Creator'}
                {currentUser?.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] inline" />}
              </div>
              <div className="text-xs text-gray-500">@{currentUser?.handle || 'user'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#F1F3F4] dark:bg-[#111827] p-1 rounded-full text-xs text-gray-600 dark:text-gray-300">
            <button
              type="button"
              onClick={() => setAudience('public')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all ${
                audience === 'public' ? 'bg-white dark:bg-[#1E293B] text-[#0B57D0] font-bold shadow-xs' : ''
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Public</span>
            </button>
            <button
              type="button"
              onClick={() => setAudience('followers')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full transition-all ${
                audience === 'followers' ? 'bg-white dark:bg-[#1E293B] text-[#0B57D0] font-bold shadow-xs' : ''
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Followers</span>
            </button>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          rows={5}
          placeholder="What would you like to share today?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-transparent text-sm sm:text-base text-[#1F1F1F] dark:text-white placeholder:text-gray-400 focus:outline-none resize-none leading-relaxed"
        />

        {/* Uploaded Media Previews */}
        {mediaUrls.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mediaUrls.map((url, i) => (
              <div key={i} className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100 group">
                <img src={url} alt={`Upload preview ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(i)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hashtags Input */}
        <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800">
          <span className="text-xs font-bold text-[#0B57D0]">Tags</span>
          <input
            type="text"
            placeholder="e.g. Technology, AI, Photography (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[#1F1F1F] dark:text-white focus:outline-none"
          />
        </div>

        {/* Media Upload Buttons & Publish Action */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111827] cursor-pointer transition-colors">
            <UploadCloud className="w-4 h-4 text-[#0B57D0]" />
            <span>{uploading ? 'Uploading...' : 'Upload Photos / Video'}</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            onClick={handleSubmit}
            disabled={uploading || (!caption.trim() && mediaUrls.length === 0)}
            className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white px-7 py-2.5 rounded-full text-xs font-bold shadow-xs hover:shadow transition-all"
          >
            {uploading ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

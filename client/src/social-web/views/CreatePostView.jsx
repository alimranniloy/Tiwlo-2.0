import React, { useState } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Film,
  Smile,
  Globe,
  Vote,
  X,
  Send,
  Sparkles,
  Lock
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CreatePostView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState('public'); // 'public' | 'followers'

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map((f) => TiwiSocialAPI.uploadMedia(f));
      const urls = await Promise.all(uploadPromises);
      setMediaUrls((prev) => [...prev, ...urls]);
      showToast('Media attached', 'info');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMedia = (idx) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!caption.trim() && mediaUrls.length === 0) {
      showToast('Please enter text or attach media', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await TiwiSocialAPI.createPost({
        caption: caption.trim(),
        images: mediaUrls,
        userId: currentUser?.id,
      });

      showToast('Published to your stream!', 'info');
      navigateTo('feed');
    } catch (err) {
      showToast(err.message || 'Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto">
      {/* 1. Modern Header */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
            Create Post
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showToast('Draft saved locally', 'info')}
            className="text-[13px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
          >
            Save Draft
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!caption.trim() && mediaUrls.length === 0) || submitting || uploading}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[13px] px-5 py-2 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {/* 2. Composer Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-5 shadow-sm">
        {/* Creator Info */}
        <div className="flex items-center gap-3 mb-4">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
            alt={currentUser?.name || 'Account'}
            className="w-11 h-11 rounded-xl object-cover ring-2 ring-violet-500/40"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb]">
              {currentUser?.name || 'Tiwi Creator'}
            </span>
            {/* Audience Selector Pill */}
            <button
              type="button"
              onClick={() => setAudience(audience === 'public' ? 'followers' : 'public')}
              className="flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full w-fit mt-0.5 hover:bg-violet-500/20 transition cursor-pointer"
            >
              {audience === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>{audience === 'public' ? 'Public' : 'Followers Only'}</span>
            </button>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          rows={5}
          placeholder="What's on your mind? Share updates, technical insights, or creative work..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-transparent text-[15px] text-[#1c1e21] dark:text-[#e4e6eb] placeholder-[#65676b] dark:placeholder-[#8a8d91] outline-none resize-none leading-relaxed"
        />

        {/* Media Preview Grid */}
        {mediaUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-3 my-4">
            {mediaUrls.map((url, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden group aspect-video bg-black/5 dark:bg-white/5">
                <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar / Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-black/[0.05] dark:border-white/[0.06] mt-4">
          <div className="flex items-center gap-1">
            <label className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-violet-600 dark:text-violet-400 cursor-pointer transition flex items-center gap-1.5 text-xs font-semibold">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Photo</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => navigateTo('ai-studio')}
              className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-amber-500 cursor-pointer transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI Assist</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('polls')}
              className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-emerald-500 cursor-pointer transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <Vote className="w-4 h-4" />
              <span className="hidden sm:inline">Poll</span>
            </button>
          </div>

          <div className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
            {uploading ? (
              <span className="text-violet-500 animate-pulse">Uploading media...</span>
            ) : (
              <span>{caption.length}/1000</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

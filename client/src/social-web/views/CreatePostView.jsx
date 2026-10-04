import React, { useState } from 'react';
import {
  ArrowLeft,
  Image,
  Film,
  Smile,
  Globe,
  Vote,
  X,
  Radio
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CreatePostView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

      showToast('Your post was published', 'info');
      navigateTo('feed');
    } catch (err) {
      showToast(err.message || 'Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Draft saved locally', 'info')}
            className="text-[15px] font-bold text-[#1D9BF0] hover:underline"
          >
            Drafts
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!caption.trim() && mediaUrls.length === 0) || submitting || uploading}
            className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 text-white font-bold text-[15px] min-w-[68px] h-[36px] flex items-center justify-center rounded-full shadow-xs transition active:scale-95 cursor-pointer"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* 2. Composer Body */}
      <div className="px-4 py-3 flex gap-3 flex-1 flex-col">
        <div className="flex gap-3">
          <img
            src={
              currentUser?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
            }
            alt={currentUser?.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 pt-0.5"
          />

          <div className="flex-1 flex flex-col">
            {/* Audience Pill */}
            <div className="flex items-center gap-1.5 text-[#1D9BF0] border border-[#1D9BF0]/40 rounded-full px-3 py-0.5 text-[13px] font-bold w-fit mb-2 cursor-pointer hover:bg-[#1D9BF0]/10 transition">
              <Globe className="w-3.5 h-3.5" />
              <span>Everyone</span>
            </div>

            <textarea
              autoFocus
              rows={6}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What is happening?!"
              className="w-full bg-transparent text-[20px] placeholder-[#536471] dark:placeholder-[#71767B] text-[#0F1419] dark:text-[#E7E9EA] outline-none resize-none pt-1 leading-relaxed"
            />
          </div>
        </div>

        {/* Media Attachments Preview */}
        {mediaUrls.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl overflow-hidden border border-[#EFF3F4] dark:border-[#2F3336]">
            {mediaUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt="upload" className="w-full h-44 object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(i)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reply Permission Indicator */}
        <div className="flex items-center gap-1.5 text-[#1D9BF0] font-bold text-[13px] pt-4 pb-3 border-b border-[#EFF3F4] dark:border-[#2F3336] mt-auto">
          <Globe className="w-3.5 h-3.5" />
          <span>Everyone can reply</span>
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between py-2 text-[#1D9BF0]">
          <div className="flex items-center gap-1 -ml-2">
            <label className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center cursor-pointer transition">
              <Image className="w-5 h-5" />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => showToast('GIF picker ready', 'info')}
              className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
            >
              <Film className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('polls')}
              className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
            >
              <Vote className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => showToast('Emoji picker ready', 'info')}
              className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('audio-spaces')}
              className="w-9 h-9 rounded-full hover:bg-[#1D9BF0]/10 flex items-center justify-center transition"
            >
              <Radio className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[13px] text-[#536471] dark:text-[#71767B]">
            {280 - caption.length}
          </div>
        </div>
      </div>
    </div>
  );
}

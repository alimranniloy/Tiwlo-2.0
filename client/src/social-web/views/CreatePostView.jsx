import React, { useState } from 'react';
import {
  ArrowLeft,
  Image,
  Film,
  Smile,
  Globe,
  Vote,
  X,
  Send
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
    <div className="w-full flex flex-col min-h-screen max-w-2xl mx-auto">
      {/* 1. Header App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
            Create Post
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Draft saved', 'info')}
            className="text-[13px] font-semibold text-[#0B57D0] hover:underline cursor-pointer"
          >
            Save Draft
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!caption.trim() && mediaUrls.length === 0) || submitting || uploading}
            className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white font-semibold text-[14px] px-5 py-2 rounded-full shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Publishing...' : 'Post'}</span>
          </button>
        </div>
      </div>

      {/* 2. Composer Card (Material Surface) */}
      <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs flex-1 flex flex-col justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <img
              src={
                currentUser?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={currentUser?.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#E0E2EC] dark:ring-[#444746]"
            />

            <div>
              <div className="text-[14px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                {currentUser?.name || 'You'}
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[#0B57D0] font-medium">
                <Globe className="w-3.5 h-3.5" />
                <span>Public stream</span>
              </div>
            </div>
          </div>

          <textarea
            autoFocus
            rows={6}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What would you like to share with the community?"
            className="w-full bg-transparent text-[17px] placeholder-[#747775] dark:placeholder-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none resize-none pt-2 leading-relaxed"
          />

          {/* Media Attachments Preview */}
          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden border border-[#E0E2EC] dark:border-[#313335] mt-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative group aspect-video bg-black/5">
                  <img src={url} alt="upload" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(i)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E0E2EC]/70 dark:border-[#313335] text-[#444746] dark:text-[#C4C7C5] mt-6">
          <div className="flex items-center gap-1">
            <label className="w-10 h-10 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center cursor-pointer transition text-[#0B57D0]" title="Upload photo">
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
              onClick={() => showToast('Video attachment ready', 'info')}
              className="w-10 h-10 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition text-[#0F5223]"
              title="Add video"
            >
              <Film className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => navigateTo('polls')}
              className="w-10 h-10 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition text-[#7D5700]"
              title="Create poll"
            >
              <Vote className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => showToast('Emoji picker', 'info')}
              className="w-10 h-10 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] flex items-center justify-center transition text-[#444746]"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
            {caption.length} / 500
          </span>
        </div>
      </div>
    </div>
  );
}

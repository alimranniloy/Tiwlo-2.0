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

      showToast('Announced to network', 'info');
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
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#dadce0] dark:border-[#3c4043] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed]">
            Announce something
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showToast('Draft saved', 'info')}
            className="text-[13px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:underline cursor-pointer"
          >
            Save Draft
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!caption.trim() && mediaUrls.length === 0) || submitting || uploading}
            className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-medium text-[13px] px-5 py-1.5 rounded-md shadow-xs active:scale-95 transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Publishing...' : 'Post'}</span>
          </button>
        </div>
      </div>

      {/* 2. Composer Card (Google rounded-lg) */}
      <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex-1 flex flex-col justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <img
              src={
                currentUser?.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
              }
              alt={currentUser?.name}
              className="w-10 h-10 rounded-full object-cover border border-[#dadce0] dark:border-[#5f6368]"
            />

            <div>
              <div className="text-[14px] font-medium text-[#202124] dark:text-[#e8eaed]">
                {currentUser?.name || 'You'}
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[#1a73e8] dark:text-[#8ab4f8] font-medium">
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
            placeholder="What would you like to announce to your community?"
            className="w-full bg-transparent text-[15px] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] text-[#202124] dark:text-[#e8eaed] outline-none resize-none pt-2 leading-relaxed"
          />

          {/* Media Attachments Preview */}
          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-md overflow-hidden border border-[#dadce0] dark:border-[#3c4043] mt-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative group aspect-video bg-black/5">
                  <img src={url} alt="upload" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(i)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition cursor-pointer"
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
        <div className="flex items-center justify-between pt-4 border-t border-[#f1f3f4] dark:border-[#3c4043] text-[#5f6368] dark:text-[#9aa0a6] mt-6">
          <div className="flex items-center gap-1">
            <label className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center cursor-pointer transition text-[#1e8e3e]" title="Upload photo">
              <Image className="w-5 h-5" />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <label className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center cursor-pointer transition text-[#d93025]" title="Upload video">
              <Film className="w-5 h-5" />
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <button
              type="button"
              onClick={() => navigateTo('polls')}
              className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#f29900]"
              title="Add Poll"
            >
              <Vote className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setCaption((prev) => prev + ' 🚀')}
              className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] flex items-center justify-center transition cursor-pointer text-[#1a73e8]"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          <div className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
            {uploading ? 'Attaching media...' : `${caption.length} / 500`}
          </div>
        </div>
      </div>
    </div>
  );
}

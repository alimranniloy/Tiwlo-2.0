import React, { useState } from 'react';
import { ArrowLeft, UploadCloud, Sparkles, CheckCircle2, X } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CreateStoryView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await TiwiSocialAPI.uploadMedia(file);
      setMediaUrl(url);
      showToast('Media uploaded', 'info');
    } catch (err) {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mediaUrl) {
      showToast('Please select an image or video for your story', 'error');
      return;
    }

    setUploading(true);
    try {
      await TiwiSocialAPI.createStory({
        mediaUrl,
        caption: caption.trim(),
        userId: currentUser?.id,
      });
      showToast('Story published successfully! Active for 24 hours.', 'info');
      navigateTo('feed');
    } catch (e) {
      showToast('Failed to post story', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full pb-20 md:pb-10 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#202124] p-4 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs">
        <button
          onClick={() => navigateTo('feed')}
          className="flex items-center gap-2 text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a73e8] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h2 className="text-sm font-bold text-[#202124] dark:text-[#e8eaed]">Add to Story</h2>
        <div className="w-12" />
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#202124] rounded-lg p-6 border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex flex-col gap-5">
        <div className="text-center py-1">
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">Stories disappear automatically after 24 hours.</p>
        </div>

        {/* Media Preview Box */}
        {mediaUrl ? (
          <div className="relative aspect-[9/16] max-h-[460px] rounded-lg overflow-hidden bg-black mx-auto w-full max-w-[320px] shadow-sm">
            <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setMediaUrl('')}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="border-2 border-dashed border-[#dadce0] dark:border-[#5f6368] rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer hover:border-[#1a73e8] transition-colors">
            <UploadCloud className="w-10 h-10 text-[#1a73e8] mb-3" />
            <span className="text-sm font-semibold text-[#202124] dark:text-[#e8eaed]">
              {uploading ? 'Uploading media...' : 'Upload photo or video'}
            </span>
            <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">High quality 9:16 portrait recommended</span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}

        {/* Story Caption */}
        <input
          type="text"
          placeholder="Add a caption to your story..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-[#f8f9fa] dark:bg-[#303134] text-xs text-[#202124] dark:text-[#e8eaed] rounded-md px-3.5 py-2.5 border border-[#dadce0] dark:border-[#5f6368] focus:border-[#1a73e8] focus:outline-none"
        />

        <button
          onClick={handleSubmit}
          disabled={!mediaUrl || uploading}
          className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white py-2.5 rounded-md text-xs font-bold shadow-xs transition-all w-full cursor-pointer"
        >
          {uploading ? 'Sharing...' : 'Share to Story'}
        </button>
      </div>
    </div>
  );
}

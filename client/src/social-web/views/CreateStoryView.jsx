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
    <div className="max-w-xl mx-auto w-full pb-20 md:pb-10 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs">
        <button
          onClick={() => navigateTo('feed')}
          className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-[#0B57D0]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h2 className="text-sm font-bold text-[#1F1F1F] dark:text-white">Add to Story</h2>
        <div className="w-12" />
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-5">
        <div className="text-center py-2">
          <p className="text-xs text-gray-500">Stories disappear automatically after 24 hours.</p>
        </div>

        {/* Media Preview Box */}
        {mediaUrl ? (
          <div className="relative aspect-[9/16] max-h-[460px] rounded-3xl overflow-hidden bg-black mx-auto w-full max-w-[320px] shadow-lg">
            <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setMediaUrl('')}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-[#0B57D0] transition-colors">
            <UploadCloud className="w-10 h-10 text-[#0B57D0] mb-3" />
            <span className="text-sm font-semibold text-[#1F1F1F] dark:text-white">
              {uploading ? 'Uploading media...' : 'Upload photo or video'}
            </span>
            <span className="text-xs text-gray-400 mt-1">High quality 9:16 portrait recommended</span>
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
          className="w-full bg-[#F8F9FA] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-3 border border-transparent focus:border-[#0B57D0] focus:outline-none"
        />

        <button
          onClick={handleSubmit}
          disabled={!mediaUrl || uploading}
          className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white py-3 rounded-full text-xs font-bold shadow-xs transition-all w-full"
        >
          {uploading ? 'Sharing...' : 'Share to Story'}
        </button>
      </div>
    </div>
  );
}

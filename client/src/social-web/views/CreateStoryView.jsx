import React, { useState } from 'react';
import { ArrowLeft, UploadCloud, Sparkles, CheckCircle2, X, Clock, Image as ImageIcon } from 'lucide-react';
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
      showToast('Media attached to story', 'info');
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
      showToast('Story published! Active for 24 hours.', 'info');
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
      <div className="flex items-center justify-between bg-white dark:bg-[#16161f] p-4 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm">
        <button
          onClick={() => navigateTo('feed')}
          className="flex items-center gap-2 text-xs font-semibold text-[#65676b] dark:text-[#b0b3b8] hover:text-violet-600 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Stream</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold">
          <Clock className="w-3.5 h-3.5" />
          <span>24 Hours Expiry</span>
        </div>
      </div>

      {/* Main Story Creator Card */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm flex flex-col gap-5">
        <div>
          <h2 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
            Share a Story
          </h2>
          <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91]">
            Capture moments that disappear after 24 hours. Stories appear at the top of the feed.
          </p>
        </div>

        {/* Media Upload / Preview Canvas */}
        {mediaUrl ? (
          <div className="relative rounded-2xl overflow-hidden aspect-[9/16] max-h-[480px] bg-black mx-auto w-full max-w-[270px] shadow-xl ring-2 ring-violet-500/40">
            <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setMediaUrl('')}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            {caption && (
              <div className="absolute bottom-4 left-3 right-3 p-3 bg-black/50 backdrop-blur-md rounded-xl text-white text-xs font-medium text-center">
                {caption}
              </div>
            )}
          </div>
        ) : (
          <label className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-violet-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-black/[0.01] dark:bg-white/[0.02]">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="text-center">
              <span className="text-[14px] font-semibold text-[#1c1e21] dark:text-[#e4e6eb] block">
                Click to upload image or video
              </span>
              <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91] mt-0.5 block">
                Supports JPG, PNG, MP4 up to 50MB
              </span>
            </div>
            <input type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
          </label>
        )}

        {/* Caption */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91]">
            Story Caption (Optional)
          </label>
          <input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!mediaUrl || uploading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[14px] shadow-lg shadow-violet-500/25 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>{uploading ? 'Publishing Story...' : 'Publish to Stories'}</span>
        </button>
      </div>
    </div>
  );
}

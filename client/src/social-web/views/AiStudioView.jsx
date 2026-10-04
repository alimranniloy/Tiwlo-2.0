import React, { useState } from 'react';
import { Sparkles, Copy, ArrowRight, Wand2, Hash, Edit3 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function AiStudioView() {
  const { navigateTo, showToast } = useSocial();
  const [prompt, setPrompt] = useState('');
  const [outputType, setOutputType] = useState('caption'); // 'caption' | 'hashtags' | 'bio'
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState('');

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      if (outputType === 'caption') {
        setGeneratedResult(
          `✨ "${prompt.trim()}" — Designing seamless experiences that blend aesthetics with precision. Every detail matters when creating tools that empower people. #DesignSystem #WebDevelopment #Innovation`
        );
      } else if (outputType === 'hashtags') {
        setGeneratedResult('#TechNews #AIRevolution #WebArchitecture #CleanCode #UXDesign #Frontend #NextGen');
      } else {
        setGeneratedResult(`🚀 Building the future of digital connectivity | Passionate about ${prompt.trim()} | Follow for updates & deep-dives`);
      }
      showToast('AI content generated!', 'info');
    }, 600);
  };

  const handleCopy = () => {
    if (!generatedResult) return;
    navigator.clipboard?.writeText(generatedResult);
    showToast('Copied to clipboard!', 'info');
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0B57D0] to-[#A855F7] flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1F1F1F] dark:text-white">Tiwi AI Studio</h1>
            <p className="text-xs text-gray-500">Intelligent writing assistant for captions, hashtags, and bios</p>
          </div>
        </div>
      </div>

      {/* Main Generator Box */}
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-5">
        {/* Output Selector */}
        <div className="flex items-center gap-2 p-1 bg-[#F1F3F4] dark:bg-[#111827] rounded-full text-xs font-semibold">
          {[
            { id: 'caption', label: 'Post Caption', icon: Edit3 },
            { id: 'hashtags', label: 'Hashtags', icon: Hash },
            { id: 'bio', label: 'Profile Bio', icon: Wand2 },
          ].map((type) => {
            const Icon = type.icon;
            const isActive = outputType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setOutputType(type.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full transition-all ${
                  isActive
                    ? 'bg-white dark:bg-[#1E293B] text-[#0B57D0] shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
            What is your post or topic about?
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Launching our new high-performance web dashboard with PostgreSQL integration..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-[#F8F9FA] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl p-4 focus:outline-none focus:border-[#0B57D0] border border-transparent"
          />

          <button
            type="submit"
            disabled={!prompt.trim() || generating}
            className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white py-2.5 rounded-full text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generating ? 'Crafting with AI...' : 'Generate Content'}</span>
          </button>
        </form>

        {/* Result Area */}
        {generatedResult && (
          <div className="mt-2 p-5 bg-[#F8F9FA] dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-gray-800 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Generated Suggestion</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[#0B57D0] hover:underline"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#1F1F1F] dark:text-gray-200 leading-relaxed whitespace-pre-line">
              {generatedResult}
            </p>

            <button
              onClick={() => navigateTo('create-post')}
              className="self-end mt-2 flex items-center gap-1.5 bg-[#0B57D0] text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0842A0] transition-colors"
            >
              <span>Use in New Post</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Send,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Repeat,
  Image,
  RefreshCw,
  Share2,
  Flame,
  Zap
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function AiStudioView() {
  const { navigateTo, showToast } = useSocial();
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('fun'); // 'fun' | 'normal'
  const [model, setModel] = useState('Grok 2'); // 'Grok 2' | 'Grok 2 mini'
  const [copiedId, setCopiedId] = useState(null);

  const starterPrompts = [
    { label: 'Roast my timeline', prompt: 'Roast my social media timeline and hot takes with savage humor!' },
    { label: 'Explain Quantum Computing', prompt: 'Explain quantum computing and qubits using simple analogies.' },
    { label: 'Draft a viral tech post', prompt: 'Draft a viral, high-engagement tech post about clean architecture.' },
    { label: 'Summarize today’s AI trends', prompt: 'What are the top 3 breakthrough developments in AI agents right now?' },
  ];

  const handleSendPrompt = (promptText) => {
    const textToSend = promptText || inputPrompt;
    if (!textToSend.trim() || loading) return;

    const userMsg = { id: Date.now(), sender: 'user', text: textToSend.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    setTimeout(() => {
      let reply = '';
      const lower = textToSend.toLowerCase();

      if (lower.includes('roast')) {
        reply = `Alright, brace yourself:\n\nYour timeline looks like an obsessive compilation of "I woke up at 5 AM to rewrite my CSS in vanilla tokens" combined with 40-tweet threads that could have been a single bullet point. You're debating tab vs space while the AI is already building entire startups. But hey, at least your dark mode borders are immaculate! 🔥`;
      } else if (lower.includes('quantum') || lower.includes('qubit')) {
        reply = `Imagine a normal coin on a table: it's either Heads (0) or Tails (1). Classical computers work with those.\n\nA Quantum bit (Qubit) is like spinning that coin at lightspeed—while it's spinning in the air, it's simultaneously both Heads AND Tails (Superposition). This lets quantum computers test trillions of possibilities all at the same instant instead of checking them one by one.`;
      } else if (lower.includes('viral') || lower.includes('post') || lower.includes('draft')) {
        reply = `Here is a high-engagement, viral post formatted for Tiwi:\n\n"Most developers spend 80% of their time fixing bugs that good architecture would have prevented in the first place.\n\nCode quality isn't about looking smart. It's about respecting the developer who has to touch your code at 2 AM.\n\nSimplicity is the ultimate sophistication. Agree or disagree?"`;
      } else if (lower.includes('trend') || lower.includes('ai')) {
        reply = `Top AI Developments on Tiwi radar right now:\n\n1. **Autonomous Tool-Use Agents**: Shift from passive chat bots to proactive systems that execute tests, modify files, and run database migrations.\n2. **Reasoning Models**: Near-zero hallucination on logic and architectural verification.\n3. **Local Inference**: Ultra-fast latency on consumer hardware without third-party cloud lock-in.`;
      } else {
        reply = `Grok (${model} · ${mode === 'fun' ? 'Spicy Mode' : 'Standard'}):\n\nHere is my perspective on "${textToSend}":\n\nIn our rapidly evolving digital cosmos, the winning strategy is relentlessly high taste and minimal bloat. Whether you're optimizing software or building a life, cutting through noise with conviction always wins. What next frontier should we explore?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'grok',
          text: reply,
        },
      ]);
      setLoading(false);
    }, 700);
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareToFeed = (text) => {
    navigateTo('create-post');
    showToast('Quote ready to post', 'info');
  };

  return (
    <div className="w-full flex flex-col h-screen select-none">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              Grok
            </h1>

            {/* Model Selector Pill */}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-[12px] font-bold bg-[#EFF3F4] dark:bg-[#202327] text-[#0F1419] dark:text-[#E7E9EA] px-2.5 py-1 rounded-full border-none outline-none cursor-pointer"
            >
              <option value="Grok 2" className="dark:bg-black">Grok 2</option>
              <option value="Grok 2 mini" className="dark:bg-black">Grok 2 mini (Fast)</option>
            </select>
          </div>
        </div>

        {/* Fun Mode / Normal Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#EFF3F4] dark:bg-[#202327] p-1 rounded-full text-[12px] font-bold">
          <button
            onClick={() => setMode('fun')}
            className={`px-3 py-1 rounded-full transition flex items-center gap-1 cursor-pointer ${
              mode === 'fun'
                ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                : 'text-[#536471] dark:text-[#71767B]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Fun</span>
          </button>
          <button
            onClick={() => setMode('normal')}
            className={`px-3 py-1 rounded-full transition flex items-center gap-1 cursor-pointer ${
              mode === 'normal'
                ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                : 'text-[#536471] dark:text-[#71767B]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#1D9BF0]" />
            <span>Normal</span>
          </button>
        </div>
      </div>

      {/* 2. Messages Stream or Starter Screen */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 pb-28">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto text-center px-4 my-auto">
            {/* Grok Stylized Star/Sparkle Emblem */}
            <div className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className="text-[26px] font-black text-[#0F1419] dark:text-[#E7E9EA] tracking-tight">
              Understand the universe
            </h2>
            <p className="text-[14px] text-[#536471] dark:text-[#71767B] mt-1 max-w-sm leading-relaxed">
              Ask anything, generate witty post ideas, analyze real-time trends, or solve complex logic.
            </p>

            {/* Quick Starter Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-6">
              {starterPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendPrompt(item.prompt)}
                  className="p-3.5 rounded-2xl border border-[#EFF3F4] dark:border-[#2F3336] bg-[#F7F9F9] dark:bg-[#16181C] hover:bg-black/5 dark:hover:bg-white/5 text-left transition cursor-pointer flex flex-col"
                >
                  <span className="font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">
                    {item.label}
                  </span>
                  <span className="text-[12px] text-[#536471] dark:text-[#71767B] line-clamp-1 mt-0.5">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  isUser ? 'self-end flex-row-reverse' : 'self-start'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div
                    className={`p-4 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-[#1D9BF0] text-white rounded-br-xs'
                        : 'bg-[#F7F9F9] dark:bg-[#16181C] border border-[#EFF3F4] dark:border-[#2F3336] text-[#0F1419] dark:text-[#E7E9EA] rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Grok Action Toolbar */}
                  {!isUser && (
                    <div className="flex items-center gap-1 text-[#536471] dark:text-[#71767B] text-[12px] pl-1">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? <Check className="w-4 h-4 text-[#00BA7C]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => showToast('Thanks for feedback!', 'info')}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Good response"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => showToast('Feedback recorded', 'info')}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Poor response"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShareToFeed(msg.text)}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Post quote to Tiwi"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2.5 text-[#536471] dark:text-[#71767B] text-sm p-3 bg-[#F7F9F9] dark:bg-[#16181C] rounded-2xl w-fit border border-[#EFF3F4] dark:border-[#2F3336]">
            <Sparkles className="w-4 h-4 animate-spin text-[#1D9BF0]" />
            <span className="font-semibold">Grok is reasoning...</span>
          </div>
        )}
      </div>

      {/* 3. Bottom Grok Input Bar */}
      <div className="p-3 border-t border-[#EFF3F4] dark:border-[#2F3336] bg-white dark:bg-black sticky bottom-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center h-[50px] bg-[#EFF3F4] dark:bg-[#202327] rounded-full px-4 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] border border-transparent transition"
        >
          <button
            type="button"
            onClick={() => showToast('Image analysis mode enabled', 'info')}
            className="p-2 text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition cursor-pointer"
            title="Attach image for Grok"
          >
            <Image className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder="Ask Grok anything..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="bg-transparent text-[15px] outline-none flex-1 placeholder-[#536471] dark:placeholder-[#71767B] px-2"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="w-8 h-8 rounded-full bg-[#1D9BF0] disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 cursor-pointer flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

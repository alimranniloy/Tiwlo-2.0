import React, { useState } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Send,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Image,
  RefreshCw,
  Share2,
  Trash2,
  Cpu
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function AiStudioView() {
  const { navigateTo, showToast } = useSocial();
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const starterPrompts = [
    { label: 'Draft a stream post', prompt: 'Draft a thoughtful post about clean UI architecture and user respect.' },
    { label: 'Summarize today’s trends', prompt: 'What are the top 3 technology and AI agent breakthroughs happening now?' },
    { label: 'Explain Quantum Computing', prompt: 'Explain quantum computing using an intuitive analogy.' },
    { label: 'Community event ideas', prompt: 'Give me 3 creative virtual event ideas for a software developer community.' },
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

      if (lower.includes('post') || lower.includes('draft') || lower.includes('architecture')) {
        reply = `Here is a thoughtful post crafted for your stream:\n\n"The best software experiences are not the ones loaded with decoration; they are the ones where every interaction feels calm, predictable, and respectful of the user's attention.\n\nSimplicity isn't the lack of features—it's the clarity of purpose. What principle guides your team's design decisions?"`;
      } else if (lower.includes('quantum')) {
        reply = `Think of classical computing like a light switch: it is either completely OFF (0) or completely ON (1).\n\nA quantum bit (qubit) operates in quantum superposition—like a coin spinning on a table. While it is spinning, it is mathematically both heads and tails at once. This enables quantum algorithms to explore vast solution spaces simultaneously instead of sequentially checking every path.`;
      } else if (lower.includes('trend') || lower.includes('breakthrough')) {
        reply = `Key technology signals currently trending across Tiwi:\n\n1. **Autonomous Tool-Calling Agents**: Evolution from single-turn chatbots to agents performing multi-step verification and clean commits.\n2. **Google-Inspired Material Systems**: Interfaces shifting toward calm whitespace, semantic containers, and accessible contrast.\n3. **Real-Database Backends**: Prioritizing PostgreSQL and structured schemas over ephemeral mock layers.`;
      } else {
        reply = `Tiwi Assistant:\n\nRegarding "${textToSend}":\n\nWhen designing solutions in modern computing, the highest ROI always comes from reducing unnecessary complexity. Whether in system architecture, UX hierarchy, or team communication, clarity creates leverage. How would you like to build on this?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
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

  const handleInsertIntoPost = (text) => {
    navigateTo('create-post');
    showToast('Draft ready in Post editor', 'info');
  };

  return (
    <div className="w-full flex flex-col h-screen select-none max-w-3xl mx-auto">
      {/* 1. Header: Google Gemini-inspired Assistant App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0B57D0] via-[#7856FF] to-[#FF7A00] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight flex items-center gap-1.5">
                <span>Tiwi Assistant</span>
                <span className="text-[10px] font-semibold bg-[#D3E3FD] dark:bg-[#004A77] text-[#041E49] dark:text-[#C2E7FF] px-2 py-0.5 rounded-full">
                  Flash 2.5
                </span>
              </h1>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-[12px] font-semibold text-[#747775] hover:text-[#B3261E] flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] transition cursor-pointer"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 2. Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-28">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto">
            <div className="w-14 h-14 rounded-xl bg-[#1a73e8]/10 text-[#1a73e8] flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7" />
            </div>

            <h2 className="text-[24px] font-bold text-[#202124] dark:text-[#e8eaed]">
              How can I assist your stream today?
            </h2>
            <p className="text-[14px] text-[#5f6368] dark:text-[#9aa0a6] max-w-sm mt-1 leading-relaxed">
              Generate posts, research engineering topics, explore ideas, or summarize discussions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-8">
              {starterPrompts.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendPrompt(item.prompt)}
                  className="p-4 rounded-lg bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] hover:border-[#1a73e8] text-left transition shadow-xs cursor-pointer flex flex-col justify-between"
                >
                  <span className="font-semibold text-[14px] text-[#202124] dark:text-[#e8eaed]">
                    {item.label}
                  </span>
                  <span className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] line-clamp-1 mt-1">
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
                  <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div
                    className={`p-4 rounded-lg text-[15px] leading-relaxed whitespace-pre-wrap shadow-xs ${
                      isUser
                        ? 'bg-[#e8f0fe] dark:bg-[#174ea6] text-[#1967d2] dark:text-[#e8eaed]'
                        : 'bg-white dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] text-[#202124] dark:text-[#e8eaed]'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-1 text-[#5f6368] dark:text-[#9aa0a6] text-[12px] pl-1">
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition cursor-pointer"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? <Check className="w-4 h-4 text-[#188038]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => showToast('Feedback recorded', 'info')}
                        className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition cursor-pointer"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => showToast('Feedback recorded', 'info')}
                        className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition cursor-pointer"
                        title="Unhelpful"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleInsertIntoPost(msg.text)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition cursor-pointer font-medium"
                        title="Create post with this draft"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Post to Stream</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex items-center gap-2.5 text-[#5f6368] dark:text-[#9aa0a6] text-sm p-3.5 bg-white dark:bg-[#202124] rounded-lg w-fit border border-[#dadce0] dark:border-[#3c4043] shadow-xs">
            <Sparkles className="w-4 h-4 animate-spin text-[#1a73e8]" />
            <span className="font-medium">Tiwi Assistant is reasoning...</span>
          </div>
        )}
      </div>

      {/* 3. Input Bar: Google Pill Input Container */}
      <div className="p-3 bg-[#F8FAFD] dark:bg-[#131314] sticky bottom-0 border-t border-[#E0E2EC] dark:border-[#313335]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center h-[52px] bg-white dark:bg-[#1E1F20] rounded-full px-4 text-[#1F1F1F] dark:text-[#E3E3E3] border border-[#E0E2EC] dark:border-[#313335] focus-within:border-[#0B57D0] focus-within:ring-2 focus-within:ring-[#0B57D0]/20 shadow-xs transition-all"
        >
          <button
            type="button"
            onClick={() => showToast('Image analysis attached', 'info')}
            className="p-2 text-[#747775] dark:text-[#8E918F] hover:text-[#0B57D0] transition cursor-pointer"
            title="Attach image"
          >
            <Image className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder="Ask Tiwi Assistant anything..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="bg-transparent text-[15px] outline-none flex-1 placeholder-[#747775] dark:placeholder-[#8E918F] px-2"
          />

          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="w-9 h-9 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-30 text-white flex items-center justify-center transition active:scale-95 cursor-pointer flex-shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

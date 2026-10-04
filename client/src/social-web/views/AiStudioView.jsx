import React, { useState } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Send,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Share2,
  Trash2,
  Cpu,
  PenTool
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
        reply = `Key technology signals currently trending across Tiwi:\n\n1. **Autonomous Tool-Calling Agents**: Evolution from single-turn chatbots to agents performing multi-step verification and clean commits.\n2. **Modern Material Systems**: Interfaces shifting toward calm whitespace, semantic containers, and accessible contrast.\n3. **Real-Database Backends**: Prioritizing PostgreSQL and structured schemas over ephemeral mock layers.`;
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

  const handleInsertIntoPost = (_text) => {
    navigateTo('create-post');
    showToast('Draft ready in Post editor', 'info');
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-6.5rem)] max-w-3xl mx-auto pb-4">
      {/* 1. Header */}
      <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] px-4 py-3 flex items-center justify-between shadow-sm mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-tight">
                Tiwi AI Studio
              </h1>
              <span className="text-[11px] text-violet-500 font-semibold">Gemini Intelligence Powered</span>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#65676b] dark:text-[#8a8d91] transition cursor-pointer"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Messages Container */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 sm:p-6 shadow-sm flex flex-col justify-between">
        {messages.length === 0 ? (
          <div className="my-auto text-center max-w-md mx-auto py-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-violet-500/20">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1c1e21] dark:text-[#e4e6eb] mb-2">
              What would you like to create?
            </h2>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] mb-6 leading-relaxed">
              Ask questions, brainstorm content ideas, refine post drafts, or explore trending technical concepts.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {starterPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSendPrompt(p.prompt)}
                  className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] hover:bg-violet-500/10 dark:hover:bg-violet-500/15 border border-black/[0.04] dark:border-white/[0.06] transition-all text-left group cursor-pointer"
                >
                  <span className="text-[13px] font-semibold text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 block">
                    {p.label}
                  </span>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91] line-clamp-1 mt-0.5">
                    {p.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-4">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl text-[14px] leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-xs'
                        : 'bg-black/[0.03] dark:bg-white/[0.05] text-[#1c1e21] dark:text-[#e4e6eb] rounded-bl-xs border border-black/[0.05] dark:border-white/[0.06] whitespace-pre-wrap'
                    }`}
                  >
                    {m.text}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[#65676b] dark:text-[#8a8d91]">
                      <button
                        onClick={() => handleCopyText(m.id, m.text)}
                        className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={() => handleInsertIntoPost(m.text)}
                        className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition text-xs flex items-center gap-1 cursor-pointer text-violet-600 dark:text-violet-400 font-medium"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Post draft</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-black/[0.03] dark:bg-white/[0.05] rounded-2xl w-fit border border-black/[0.05] dark:border-white/[0.06]">
                <Sparkles className="w-4 h-4 text-violet-500 animate-spin" />
                <span className="text-xs text-[#65676b] dark:text-[#8a8d91]">Generating response...</span>
              </div>
            )}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="pt-3 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center gap-2"
        >
          <div className="flex-1 flex items-center bg-black/[0.03] dark:bg-white/[0.05] rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
            <input
              type="text"
              placeholder="Ask anything or request a stream draft..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              className="bg-transparent text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91]"
            />
          </div>

          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="w-11 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

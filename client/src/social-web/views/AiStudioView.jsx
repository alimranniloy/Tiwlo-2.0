import React, { useState } from 'react';
import { Sparkles, ArrowLeft, Send } from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function AiStudioView() {
  const { navigateTo } = useSocial();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'grok',
      text: "Hello! I am Grok on Tiwi. Ask me anything, or have me draft a spicy post, analyze trends, or explain complex ideas.",
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('fun'); // 'fun' | 'normal'

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputPrompt.trim() || loading) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');
    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: userText }]);
    setLoading(true);

    setTimeout(() => {
      let reply = '';
      if (userText.toLowerCase().includes('post') || userText.toLowerCase().includes('tweet')) {
        reply = `Here is a high-engagement post draft:\n\n"The best software feels effortless not because it's simple, but because someone cared enough to obsess over every single border and millisecond. Quality isn't an accident. #Engineering #UI"`;
      } else if (userText.toLowerCase().includes('trend') || userText.toLowerCase().includes('ai')) {
        reply = `Current pulse on Tiwi:\n• Artificial Intelligence discussions are up +140%\n• PostgreSQL real-database architectures favored over mock setups\n• Next-gen developer velocity tools gaining massive traction`;
      } else {
        reply = `Grok analysis on "${userText}":\n\nA fascinating perspective! In the grand cosmic circus of social connectivity, building with genuine care and clean architecture always beats superficial hype. Keep shipping!`;
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'grok', text: reply }]);
      setLoading(false);
    }, 600);
  };

  return (
    <div className="w-full flex flex-col h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          <button
            onClick={() => navigateTo('feed')}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              Grok
            </h1>
            <span className="text-[11px] bg-[#1D9BF0]/10 text-[#1D9BF0] font-bold px-2 py-0.5 rounded-full">
              BETA
            </span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#EFF3F4] dark:bg-[#202327] p-1 rounded-full text-xs font-bold">
          <button
            onClick={() => setMode('fun')}
            className={`px-3 py-1 rounded-full transition ${
              mode === 'fun'
                ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                : 'text-[#536471] dark:text-[#71767B]'
            }`}
          >
            Fun Mode
          </button>
          <button
            onClick={() => setMode('normal')}
            className={`px-3 py-1 rounded-full transition ${
              mode === 'normal'
                ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                : 'text-[#536471] dark:text-[#71767B]'
            }`}
          >
            Normal
          </button>
        </div>
      </div>

      {/* 2. Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-28">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                isUser ? 'self-end flex-row-reverse' : 'self-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#1D9BF0] text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
              <div
                className={`p-4 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-[#1D9BF0] text-white rounded-br-xs'
                    : 'bg-[#F7F9F9] dark:bg-[#16181C] border border-[#EFF3F4] dark:border-[#2F3336] text-[#0F1419] dark:text-[#E7E9EA] rounded-bl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-[#536471] dark:text-[#71767B] text-sm p-2">
            <Sparkles className="w-4 h-4 animate-spin text-[#1D9BF0]" />
            <span>Grok is thinking...</span>
          </div>
        )}
      </div>

      {/* 3. Input Bar at Bottom */}
      <div className="p-3 border-t border-[#EFF3F4] dark:border-[#2F3336] bg-white dark:bg-black sticky bottom-0">
        <form
          onSubmit={handleSend}
          className="flex items-center h-[46px] bg-[#EFF3F4] dark:bg-[#202327] rounded-3xl px-4 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] border border-transparent transition"
        >
          <input
            type="text"
            placeholder="Ask Grok anything..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="bg-transparent text-[15px] outline-none flex-1 placeholder-[#536471] dark:placeholder-[#71767B]"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="p-1.5 text-[#1D9BF0] disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

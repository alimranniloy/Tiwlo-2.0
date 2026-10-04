import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Headphones,
  Paperclip,
  Send,
  MoreHorizontal,
  CheckCheck,
  User
} from 'lucide-react';

export default function SupportInboxView({ currentUser, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState('conv_support_team');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileChatView, setMobileChatView] = useState(false);
  const messagesEndRef = useRef(null);

  // Load real conversations from backend database
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/support/conversations');
      if (res.ok) {
        const data = await res.json();
        if (data?.conversations && data.conversations.length > 0) {
          setConversations(data.conversations);
          if (!activeConvId || !data.conversations.some(c => c.id === activeConvId)) {
            setActiveConvId(data.conversations[0].id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load conversations from server:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0] || {
    id: 'conv_support_team',
    name: 'Support Team',
    role: 'Support Team',
    messages: []
  };

  const activeMessages = activeConv.messages || [];

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isTyping]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');

    const targetConvId = activeConv.id;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Optimistically append user message
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      sender: 'user',
      text: userText,
      time: timeStr
    };

    setConversations(prev => prev.map(c => {
      if (c.id === targetConvId) {
        return {
          ...c,
          lastMessage: userText,
          time: timeStr,
          messages: [...(c.messages || []), tempUserMsg]
        };
      }
      return c;
    }));

    setIsTyping(true);

    try {
      // Real API call to post message and generate AI response
      const res = await fetch(`/api/support/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          sender: 'user',
          userName: currentUser?.name || 'Imran',
          userId: currentUser?.id || currentUser?.tiwiId || ''
        })
      });

      const data = await res.json();
      if (data?.conversation) {
        setConversations(prev => prev.map(c => {
          if (c.id === targetConvId) {
            return data.conversation;
          }
          return c;
        }));
      }
    } catch (err) {
      console.warn('Error sending message:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Navigation Bar (Full Width) */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200/80 dark:border-gray-700 shadow-2xs cursor-pointer group"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Support Inbox
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Chat with our support team
          </p>
        </div>
      </div>

      {/* 2-Column Split: Left Conversations, Right Chat Window matching screenshot View 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 overflow-hidden min-h-[540px] sm:min-h-[620px] bg-white dark:bg-gray-900/60 shadow-xs">
        {/* Left Column: Conversations List (col-span-4) */}
        <div className={`lg:col-span-4 border-r border-slate-200/80 dark:border-gray-700/80 flex flex-col bg-slate-50/40 dark:bg-gray-800/30 ${mobileChatView ? 'hidden lg:flex' : 'flex'}`}>
          {/* Search conversations input */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800/60">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversation items list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800/60">
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setMobileChatView(true);
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600'
                      : 'hover:bg-slate-100/60 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60">
                    {conv.isSupport !== false ? (
                      <Headphones className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {conv.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap ml-1">
                        {conv.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                  </div>

                  {conv.unread > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 self-center">
                      {conv.unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Chat Stream (col-span-8) */}
        <div className={`lg:col-span-8 flex flex-col h-[540px] sm:h-[620px] bg-white dark:bg-gray-900/90 ${!mobileChatView ? 'hidden lg:flex' : 'flex'}`}>
          {/* Top Bar matching screenshot View 4 */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-gray-700/80 flex items-center justify-between bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Mobile Back to List Button */}
              <button
                type="button"
                onClick={() => setMobileChatView(false)}
                className="lg:hidden p-1.5 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-600 dark:text-slate-300"
                title="Back to conversations"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60">
                {activeConv.isSupport !== false ? (
                  <Headphones className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {activeConv.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Online</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 flex items-center justify-center transition"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 dark:bg-gray-900/40">
            {activeMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mb-1">
                      <Headphones className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-gray-700/80 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    <div className={`flex items-center gap-1 text-[10px] text-slate-400 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck className="w-3.5 h-3.5 text-blue-500 stroke-[2.5]" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Headphones className="w-3.5 h-3.5" />
                </div>
                <div className="px-4 py-2 rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 text-slate-500 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar matching screenshot View 4 */}
          <form
            onSubmit={handleSendMessage}
            className="p-3.5 border-t border-slate-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900 flex items-center gap-2"
          >
            <button
              type="button"
              className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 flex items-center justify-center transition"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 rounded-full text-xs sm:text-sm bg-slate-50 dark:bg-gray-800 border border-slate-200/80 dark:border-gray-700 focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition disabled:opacity-40 shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

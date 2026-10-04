import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Settings,
  Send,
  Info,
  CheckCircle2,
  ArrowLeft,
  Phone,
  Video,
  Image as ImageIcon,
  Smile,
  MoreVertical
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function MessagesView() {
  const { currentUser, tabParams, navigateTo } = useSocial();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(tabParams?.convId || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    TiwiSocialAPI.getConversations(currentUser?.id).then((convs) => {
      if (Array.isArray(convs) && convs.length > 0) {
        setConversations(convs);
        if (!activeConvId) {
          setActiveConvId(convs[0].id);
        }
      } else {
        const sampleConvs = [
          {
            id: 'c1',
            name: 'Sarah Jenkins',
            handle: 'sarah_j',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
            lastMessage: 'Let’s sync on the new UI design tokens!',
            lastMessageTime: '12m',
            isVerified: true,
            online: true,
          },
          {
            id: 'c2',
            name: 'Alex Rivera',
            handle: 'arivera',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            lastMessage: 'The PostgreSQL migrations look super clean.',
            lastMessageTime: '2h',
            isVerified: false,
            online: false,
          },
          {
            id: 'c3',
            name: 'Elena Rostova',
            handle: 'elena_dev',
            avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
            lastMessage: 'Check out the new audio spaces feature!',
            lastMessageTime: '1d',
            isVerified: true,
            online: true,
          }
        ];
        setConversations(sampleConvs);
        if (!activeConvId) setActiveConvId('c1');
      }
    });
  }, [currentUser?.id, activeConvId]);

  useEffect(() => {
    if (!activeConvId) return;
    TiwiSocialAPI.getMessages(activeConvId).then((msgs) => {
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(msgs);
      } else {
        setMessages([
          {
            id: 'm1',
            senderId: 'other',
            text: 'Hello! I checked out your latest stream post on the new modern redesign.',
            createdAt: '10:45 AM',
          },
          {
            id: 'm2',
            senderId: currentUser?.id,
            text: 'Thanks! We just upgraded everything to ultra-modern aesthetics with violet accents.',
            createdAt: '10:47 AM',
          },
          {
            id: 'm3',
            senderId: 'other',
            text: 'It looks exceptionally polished and clean! The cards and typography are spot on.',
            createdAt: '10:48 AM',
          },
        ]);
      }
    });
  }, [activeConvId, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      id: `m_${Date.now()}`,
      senderId: currentUser?.id,
      text: inputText.trim(),
      createdAt: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    try {
      await TiwiSocialAPI.sendMessage(activeConvId, {
        text: newMsg.text,
        senderId: currentUser?.id,
      });
    } catch {
      // quiet
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="w-full flex h-[calc(100vh-6.5rem)] rounded-2xl bg-white dark:bg-[#16161f] border border-black/[0.05] dark:border-white/[0.06] overflow-hidden shadow-sm dark:shadow-black/20">
      {/* 1. Left Panel: Conversations List */}
      <div
        className={`w-full sm:w-[320px] md:w-[340px] flex-shrink-0 border-r border-black/[0.05] dark:border-white/[0.06] flex flex-col h-full ${
          activeConvId ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
            Messages
          </h1>
          <button
            onClick={() => navigateTo('settings')}
            className="w-8 h-8 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition-all cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-center h-9 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl px-3 text-[#1c1e21] dark:text-[#e4e6eb] focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
            <Search className="w-3.5 h-3.5 text-[#65676b] dark:text-[#8a8d91] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91]"
            />
          </div>
        </div>

        {/* Conversations Scroll */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.map((c) => {
            const isSelected = c.id === activeConvId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-violet-500/10 dark:bg-violet-500/15 text-violet-900 dark:text-violet-100'
                    : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#1c1e21] dark:text-[#e4e6eb]'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'}
                    alt={c.name}
                    className="w-11 h-11 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                  />
                  {c.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#16161f]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[13.5px] truncate font-semibold ${isSelected ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                        {c.name}
                      </span>
                      {c.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91] flex-shrink-0">
                      {c.lastMessageTime}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91] truncate mt-0.5">
                    {c.lastMessage}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Panel: Active Chat Thread */}
      <div
        className={`flex-1 flex flex-col h-full bg-[#f8f9fa] dark:bg-[#111118] ${
          !activeConvId ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {activeConv ? (
          <>
            {/* Chat Top Bar */}
            <div className="h-14 px-4 bg-white dark:bg-[#16161f] border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="sm:hidden p-1.5 rounded-xl hover:bg-black/[0.04] text-[#65676b]"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative">
                  <img
                    src={activeConv.avatar}
                    alt={activeConv.name}
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10"
                  />
                  {activeConv.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-[#16161f]" />
                  )}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-1">
                    {activeConv.name}
                    {activeConv.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 fill-current inline" />}
                  </span>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8a8d91]">
                    @{activeConv.handle} · {activeConv.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Audio Call, Video Call, Profile Info */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateTo('call')}
                  className="w-8 h-8 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] hover:text-violet-600 transition-all cursor-pointer"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateTo('call')}
                  className="w-8 h-8 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] hover:text-violet-600 transition-all cursor-pointer"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateTo('profile', activeConv.handle)}
                  className="w-8 h-8 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition-all cursor-pointer"
                  title="Profile Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.map((msg) => {
                const isMine = msg.senderId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[75%] ${
                      isMine ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 text-[13.5px] leading-relaxed shadow-xs ${
                        isMine
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl rounded-br-xs'
                          : 'bg-white dark:bg-[#1a1a26] text-[#1c1e21] dark:text-[#e4e6eb] rounded-2xl rounded-bl-xs border border-black/[0.05] dark:border-white/[0.06]'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-[#65676b] dark:text-[#8a8d91] mt-1 px-1">
                      {msg.createdAt || 'Just now'}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white dark:bg-[#16161f] border-t border-black/[0.05] dark:border-white/[0.06] flex items-center gap-2"
            >
              <div className="flex-1 flex items-center bg-black/[0.04] dark:bg-white/[0.05] rounded-xl px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="bg-transparent text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none w-full placeholder-[#65676b] dark:placeholder-[#8a8d91]"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <p className="text-sm text-[#65676b] dark:text-[#8a8d91]">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

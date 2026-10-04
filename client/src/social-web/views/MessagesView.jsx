import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Settings,
  Send,
  Image,
  Smile,
  Info,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function MessagesView() {
  const { currentUser, tabParams, navigateTo, showToast } = useSocial();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(tabParams?.id || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    TiwiSocialAPI.getConversations(currentUser?.id).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setConversations(data);
        if (!activeConvId) setActiveConvId(data[0].id);
      } else {
        const defaultConv = [
          {
            id: 'conv_support',
            name: 'Tiwi Community Team',
            handle: 'tiwi_support',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            lastMessage: 'Welcome to your Direct Messages on Tiwi!',
            lastMessageTime: '10:00 AM',
            isVerified: true,
          }
        ];
        setConversations(defaultConv);
        if (!activeConvId) setActiveConvId('conv_support');
      }
    });
  }, [currentUser?.id, activeConvId]);

  useEffect(() => {
    if (tabParams?.id) {
      setActiveConvId(tabParams.id);
    }
  }, [tabParams?.id]);

  useEffect(() => {
    if (activeConvId) {
      TiwiSocialAPI.getMessages(activeConvId, currentUser?.id).then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
        } else {
          setMessages([
            {
              id: 'm1',
              senderId: 'other',
              senderName: 'Tiwi Support',
              text: 'Hello! You can chat directly with other creators, share thoughts, or coordinate projects.',
              createdAt: '10:00 AM'
            }
          ]);
        }
      });
      TiwiSocialAPI.markSeen(activeConvId, currentUser?.id);
    }
  }, [activeConvId, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const currentText = inputText.trim();
    setInputText('');

    const optimisticMsg = {
      id: `msg_${Date.now()}`,
      senderId: currentUser?.id,
      senderName: currentUser?.name || 'You',
      text: currentText,
      createdAt: 'Just now',
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await TiwiSocialAPI.sendMessage(activeConvId, currentText, currentUser?.id);
    } catch {
      showToast('Failed to deliver message', 'error');
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.handle?.toLowerCase().includes(q);
  });

  return (
    <div className="w-full flex h-screen overflow-hidden">
      {/* 1. Left Panel: Conversations List */}
      <div className={`w-full sm:w-[380px] flex-shrink-0 border-r border-[#EFF3F4] dark:border-[#2F3336] flex flex-col h-full ${
        activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {/* Sticky Header: 53px height */}
        <div className="h-[53px] px-4 border-b border-[#EFF3F4] dark:border-[#2F3336] flex items-center justify-between">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] tracking-tight">
            Messages
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateTo('settings')}
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#0F1419] dark:text-[#E7E9EA] transition"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Direct Messages Bar: 42px */}
        <div className="p-3 border-b border-[#EFF3F4] dark:border-[#2F3336]">
          <div className="flex items-center h-[42px] bg-[#EFF3F4] dark:bg-[#202327] rounded-full px-4 text-[#0F1419] dark:text-[#E7E9EA] focus-within:bg-transparent focus-within:ring-1 focus-within:ring-[#1D9BF0] border border-transparent transition">
            <Search className="w-4 h-4 text-[#536471] dark:text-[#71767B] mr-3" />
            <input
              type="text"
              placeholder="Search Direct Messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[14px] outline-none w-full placeholder-[#536471] dark:placeholder-[#71767B]"
            />
          </div>
        </div>

        {/* Conversations Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
          {filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`p-3.5 flex items-start gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer transition ${
                  isSelected ? 'bg-black/[0.03] dark:bg-white/[0.05] border-r-2 border-[#1D9BF0]' : ''
                }`}
              >
                <img
                  src={
                    conv.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                  }
                  alt={conv.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] truncate">
                      <span className="truncate">{conv.name || 'User'}</span>
                      {conv.isVerified && (
                        <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[13px] text-[#536471] dark:text-[#71767B] flex-shrink-0">
                      {conv.lastMessageTime || ''}
                    </span>
                  </div>
                  <span className="text-[13px] text-[#536471] dark:text-[#71767B] block truncate">
                    @{conv.handle || 'user'}
                  </span>
                  <p className="text-[14px] text-[#536471] dark:text-[#71767B] truncate mt-0.5">
                    {conv.lastMessage || 'Sent a message'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Panel: Active Chat Thread */}
      <div className={`flex-1 flex flex-col h-full bg-white dark:bg-black ${
        !activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {activeConv ? (
          <>
            {/* Thread Header: 53px height */}
            <div className="h-[53px] px-4 border-b border-[#EFF3F4] dark:border-[#2F3336] flex items-center justify-between bg-white/85 dark:bg-black/85 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="sm:hidden p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <img
                  src={
                    activeConv.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                  }
                  alt={activeConv.name}
                  className="w-9 h-9 rounded-full object-cover"
                />

                <div className="flex flex-col">
                  <div className="flex items-center gap-1 font-bold text-[15px] text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
                    <span>{activeConv.name}</span>
                    {activeConv.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-[#1D9BF0] fill-current inline flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
                    @{activeConv.handle}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigateTo('profile', activeConv.handle || activeConv.id)}
                className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[#536471] dark:text-[#71767B]"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {/* Profile Intro Header in Chat */}
              <div className="py-8 flex flex-col items-center text-center border-b border-[#EFF3F4] dark:border-[#2F3336] mb-3">
                <img
                  src={
                    activeConv.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                  }
                  alt={activeConv.name}
                  className="w-16 h-16 rounded-full object-cover mb-2"
                />
                <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
                  {activeConv.name}
                </h3>
                <span className="text-[14px] text-[#536471] dark:text-[#71767B]">
                  @{activeConv.handle}
                </span>
              </div>

              {messages.map((msg) => {
                const isMine = msg.senderId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[70%] ${
                      isMine ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 text-[15px] leading-relaxed ${
                        isMine
                          ? 'bg-[#1D9BF0] text-white rounded-2xl rounded-br-xs'
                          : 'bg-[#EFF3F4] dark:bg-[#2F3336] text-[#0F1419] dark:text-[#E7E9EA] rounded-2xl rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[11px] text-[#536471] dark:text-[#71767B] mt-1 px-1">
                      {msg.createdAt || 'Just now'}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Message Input Bar */}
            <div className="p-3 border-t border-[#EFF3F4] dark:border-[#2F3336] bg-white dark:bg-black">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 bg-[#EFF3F4] dark:bg-[#202327] rounded-3xl px-3 py-1.5"
              >
                <div className="flex items-center text-[#1D9BF0]">
                  <button
                    type="button"
                    onClick={() => showToast('Attach media', 'info')}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
                  >
                    <Image className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast('Emoji picker', 'info')}
                    className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Start a new message"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="bg-transparent text-[15px] outline-none flex-1 text-[#0F1419] dark:text-[#E7E9EA] placeholder-[#536471] dark:placeholder-[#71767B]"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-1.5 text-[#1D9BF0] disabled:opacity-40 hover:opacity-80 transition cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="font-extrabold text-[28px] text-[#0F1419] dark:text-[#E7E9EA] mb-2 leading-tight">
              Select a message
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-sm">
              Choose from your existing conversations, start a new one, or just keep swimming.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

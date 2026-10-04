import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Settings,
  Send,
  Info,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function MessagesView() {
  const { currentUser, tabParams, navigateTo, showToast } = useSocial();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(tabParams?.recipientId || null);
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
            lastMessage: 'Let’s sync on the new UI tokens!',
            lastMessageTime: '12m',
            isVerified: true,
          },
          {
            id: 'c2',
            name: 'Alex Rivera',
            handle: 'arivera',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            lastMessage: 'The PostgreSQL migrations look clean.',
            lastMessageTime: '2h',
            isVerified: false,
          },
        ];
        setConversations(sampleConvs);
        if (!activeConvId) setActiveConvId('c1');
      }
    });
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeConvId) return;
    TiwiSocialAPI.getMessages(activeConvId, currentUser?.id).then((msgs) => {
      if (Array.isArray(msgs) && msgs.length > 0) {
        setMessages(msgs);
      } else {
        setMessages([
          {
            id: 'm1',
            senderId: 'other',
            text: 'Hey! Loved the new Google Material design direction on Tiwi.',
            createdAt: '10:45 AM',
          },
          {
            id: 'm2',
            senderId: currentUser?.id,
            text: 'Thanks! The calm colors and generous whitespace make a huge difference.',
            createdAt: '10:46 AM',
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
      await TiwiSocialAPI.sendMessage(activeConvId, newMsg.text, currentUser?.id);
    } catch {
      // ignore
    }
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="w-full flex h-[calc(100vh-2rem)] rounded-3xl bg-white dark:bg-[#1E1F20] border border-[#E0E2EC] dark:border-[#313335] overflow-hidden shadow-xs">
      {/* 1. Left Panel: Conversations List */}
      <div className={`w-full sm:w-[340px] flex-shrink-0 border-r border-[#E0E2EC] dark:border-[#313335] flex flex-col h-full ${
        activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="h-[56px] px-4 border-b border-[#E0E2EC] dark:border-[#313335] flex items-center justify-between">
          <h1 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
            Messages
          </h1>
          <button
            onClick={() => navigateTo('settings')}
            className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-[#747775] dark:text-[#8E918F] transition"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Search Direct Messages Bar */}
        <div className="p-3 border-b border-[#E0E2EC] dark:border-[#313335]">
          <div className="flex items-center h-[40px] bg-[#EEF2F6] dark:bg-[#282A2C] rounded-full px-4 text-[#1F1F1F] dark:text-[#E3E3E3] border border-transparent focus-within:border-[#0B57D0] focus-within:bg-white dark:focus-within:bg-[#1E1F20] transition">
            <Search className="w-4 h-4 text-[#747775] dark:text-[#8E918F] mr-2" />
            <input
              type="text"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] outline-none w-full placeholder-[#747775] dark:placeholder-[#8E918F]"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E0E2EC]/70 dark:divide-[#313335]">
          {filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`p-3.5 flex items-start gap-3 hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] cursor-pointer transition ${
                  isSelected ? 'bg-[#D3E3FD]/30 dark:bg-[#004A77]/30 border-l-4 border-[#0B57D0]' : ''
                }`}
              >
                <img
                  src={
                    conv.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                  }
                  alt={conv.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-[#E0E2EC]"
                />
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                      <span className="truncate">{conv.name || 'User'}</span>
                      {conv.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#747775] dark:text-[#8E918F] flex-shrink-0">
                      {conv.lastMessageTime || ''}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#747775] dark:text-[#8E918F] truncate mt-1">
                    {conv.lastMessage || 'Sent a message'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Panel: Active Chat Thread */}
      <div className={`flex-1 flex flex-col h-full bg-[#F8FAFD] dark:bg-[#131314] ${
        !activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {activeConv ? (
          <>
            {/* Header */}
            <div className="h-[56px] px-4 border-b border-[#E0E2EC] dark:border-[#313335] flex items-center justify-between bg-white dark:bg-[#1E1F20]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="sm:hidden p-1.5 rounded-full hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <img
                  src={
                    activeConv.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                  }
                  alt={activeConv.name}
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E0E2EC]"
                />

                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-1 font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3]">
                    <span>{activeConv.name}</span>
                    {activeConv.isVerified && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0] fill-current inline flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#747775] dark:text-[#8E918F]">
                    @{activeConv.handle}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigateTo('profile', activeConv.handle || activeConv.id)}
                className="p-2 rounded-full hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C] text-[#747775] dark:text-[#8E918F] cursor-pointer"
              >
                <Info className="w-5 h-5" />
              </button>
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
                      className={`px-4 py-2.5 text-[14px] leading-relaxed rounded-3xl shadow-xs ${
                        isMine
                          ? 'bg-[#D3E3FD] dark:bg-[#004A77] text-[#041E49] dark:text-[#C2E7FF] rounded-tr-sm'
                          : 'bg-white dark:bg-[#1E1F20] border border-[#E0E2EC] dark:border-[#313335] text-[#1F1F1F] dark:text-[#E3E3E3] rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-[#747775] dark:text-[#8E918F] mt-1 px-1">
                      {msg.createdAt || 'Just now'}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input */}
            <div className="p-3 border-t border-[#E0E2EC] dark:border-[#313335] bg-white dark:bg-[#1E1F20]">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 bg-[#EEF2F6] dark:bg-[#282A2C] rounded-full px-3 py-1.5 focus-within:bg-white dark:focus-within:bg-[#1E1F20] border border-transparent focus-within:border-[#0B57D0] transition"
              >
                <input
                  type="text"
                  placeholder="Send a message"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="bg-transparent text-[14px] outline-none flex-1 text-[#1F1F1F] dark:text-[#E3E3E3] placeholder-[#747775] dark:placeholder-[#8E918F] px-2"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-8 h-8 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="font-bold text-[20px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              Select a conversation
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] max-w-sm">
              Choose a contact from the left list to view or continue your conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

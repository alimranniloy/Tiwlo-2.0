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
            lastMessage: 'Let’s sync on the new Google tokens!',
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
            text: 'Hello! I checked out your latest stream post.',
            createdAt: '10:45 AM',
          },
          {
            id: 'm2',
            senderId: currentUser?.id,
            text: 'Thanks! We just updated to full Google Material styling.',
            createdAt: '10:47 AM',
          },
          {
            id: 'm3',
            senderId: 'other',
            text: 'The crisp cards and hairline borders feel genuinely Google-like!',
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
    <div className="w-full flex h-[calc(100vh-6rem)] rounded-lg bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] overflow-hidden shadow-xs">
      {/* 1. Left Panel: Conversations List */}
      <div className={`w-full sm:w-[320px] flex-shrink-0 border-r border-[#dadce0] dark:border-[#3c4043] flex flex-col h-full ${
        activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="h-[52px] px-4 border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between">
          <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed]">
            Messages
          </h1>
          <button
            onClick={() => navigateTo('settings')}
            className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] text-[#5f6368] dark:text-[#9aa0a6] transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Search Direct Messages Bar */}
        <div className="p-2.5 border-b border-[#dadce0] dark:border-[#3c4043]">
          <div className="flex items-center h-9 bg-[#f1f3f4] dark:bg-[#202124] rounded-full px-3 text-[#202124] dark:text-[#e8eaed] border border-transparent focus-within:border-[#1a73e8] transition">
            <Search className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6] mr-2" />
            <input
              type="text"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[13px] outline-none w-full placeholder-[#5f6368] dark:placeholder-[#9aa0a6]"
            />
          </div>
        </div>

        {/* Conversations Scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#f1f3f4] dark:divide-[#3c4043]">
          {filteredConversations.map((c) => {
            const isSelected = c.id === activeConvId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition ${
                  isSelected
                    ? 'bg-[#e8f0fe] dark:bg-[#183153]'
                    : 'hover:bg-[#f8f9fa] dark:hover:bg-[#202124]'
                }`}
              >
                <img
                  src={c.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'}
                  alt={c.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#dadce0]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-[13px] truncate ${isSelected ? 'font-semibold text-[#1967d2] dark:text-[#8ab4f8]' : 'font-medium text-[#202124] dark:text-[#e8eaed]'}`}>
                        {c.name}
                      </span>
                      {c.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1a73e8] fill-current inline flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6] flex-shrink-0">
                      {c.lastMessageTime}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] truncate mt-0.5">
                    {c.lastMessage}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Right Panel: Active Chat Thread */}
      <div className={`flex-1 flex flex-col h-full bg-[#f8f9fa] dark:bg-[#202124] ${
        !activeConvId ? 'hidden sm:flex' : 'flex'
      }`}>
        {activeConv ? (
          <>
            {/* Chat Top Bar */}
            <div className="h-[52px] px-4 bg-white dark:bg-[#303134] border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="sm:hidden p-1.5 rounded-full hover:bg-[#f1f3f4] text-[#5f6368]"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeConv.avatar}
                  alt={activeConv.name}
                  className="w-8 h-8 rounded-full object-cover border border-[#dadce0]"
                />
                <div className="flex flex-col leading-tight">
                  <span className="font-medium text-[14px] text-[#202124] dark:text-[#e8eaed]">
                    {activeConv.name}
                  </span>
                  <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                    @{activeConv.handle}
                  </span>
                </div>
              </div>

              <button
                onClick={() => navigateTo('profile', activeConv.handle)}
                className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#202124] text-[#5f6368] transition"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
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
                      className={`px-3.5 py-2 text-[13px] leading-relaxed rounded-2xl shadow-xs ${
                        isMine
                          ? 'bg-[#d2e3fc] dark:bg-[#183153] text-[#0d652d] dark:text-[#8ab4f8] text-[#174ea6] rounded-br-xs'
                          : 'bg-white dark:bg-[#303134] border border-[#dadce0] dark:border-[#3c4043] text-[#202124] dark:text-[#e8eaed] rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5 px-1">
                      {msg.createdAt || 'Just now'}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input */}
            <div className="p-3 border-t border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#303134]">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 bg-[#f1f3f4] dark:bg-[#202124] rounded-full px-3 py-1.5 focus-within:bg-white dark:focus-within:bg-[#202124] border border-transparent focus-within:border-[#1a73e8] transition"
              >
                <input
                  type="text"
                  placeholder="Send a message"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="bg-transparent text-[13px] outline-none flex-1 text-[#202124] dark:text-[#e8eaed] placeholder-[#5f6368] dark:placeholder-[#9aa0a6] px-2"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-7 h-7 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
              Select a conversation
            </h3>
            <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6]">
              Choose from your existing chats or start a new direct message.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

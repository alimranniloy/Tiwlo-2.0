import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Search,
  Plus,
  Send,
  Phone,
  Video,
  Image,
  Paperclip,
  CheckCheck,
  ArrowLeft,
  MoreVertical,
  Smile
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
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, [currentUser?.id]);

  useEffect(() => {
    if (tabParams?.id) {
      setActiveConvId(tabParams.id);
    }
  }, [tabParams?.id]);

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
      TiwiSocialAPI.markSeen(activeConvId, currentUser?.id);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    setLoadingConvs(true);
    try {
      const data = await TiwiSocialAPI.getConversations(currentUser?.id);
      if (Array.isArray(data) && data.length > 0) {
        setConversations(data);
        if (!activeConvId) {
          setActiveConvId(data[0].id);
        }
      } else {
        // Fallback default conversation if fresh database
        const defaultConv = [
          {
            id: 'conv_welcome',
            type: 'direct',
            name: 'Tiwi Support & Community',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            lastMessage: 'Welcome to Tiwi Messenger! Feel free to chat here.',
            lastMessageTime: 'Just now',
            unreadCount: 0
          }
        ];
        setConversations(defaultConv);
        if (!activeConvId) setActiveConvId('conv_welcome');
      }
    } catch (e) {
      console.warn('Error fetching conversations:', e);
    } finally {
      setLoadingConvs(false);
    }
  };

  const fetchMessages = async (convId) => {
    setLoadingMessages(true);
    try {
      const data = await TiwiSocialAPI.getMessages(convId, currentUser?.id);
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data);
      } else {
        setMessages([
          {
            id: 'm1',
            senderId: 'other',
            senderName: 'Tiwi Community',
            text: 'Hello! Welcome to Tiwi Messenger. Real-time conversations powered by PostgreSQL and WebRTC.',
            createdAt: '10:00 AM'
          }
        ]);
      }
    } catch (e) {
      console.warn('Failed to load messages:', e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;

    const messageText = inputText.trim();
    setInputText('');

    const optimisticMessage = {
      id: `m_${Date.now()}`,
      senderId: currentUser?.id,
      senderName: currentUser?.name || 'You',
      text: messageText,
      createdAt: 'Just now'
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await TiwiSocialAPI.sendMessage(activeConvId, { text: messageText }, currentUser?.id);
      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, lastMessage: messageText, lastMessageTime: 'Just now' } : c))
      );
    } catch (err) {
      showToast('Could not deliver message', 'error');
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  const filteredConversations = conversations.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto w-full h-[calc(100vh-6.5rem)] pb-16 md:pb-4 flex bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs overflow-hidden">
      {/* Left Conversations Sidebar */}
      <div className={`w-full md:w-80 flex-shrink-0 border-r border-gray-200/80 dark:border-gray-800/80 flex flex-col ${
        activeConvId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#0B57D0]" />
            Messages
          </h2>
          <button
            onClick={() => showToast('Create group or start chat', 'info')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#111827] text-[#0B57D0] dark:text-[#8AB4F8]"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-full border border-transparent focus:border-[#0B57D0] focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
          {loadingConvs ? (
            <div className="p-4 text-xs text-gray-400 text-center">Loading chats...</div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    navigateTo('messages', conv.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                    isActive
                      ? 'bg-[#E8F0FE]/70 dark:bg-[#111827]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#111827]/60'
                  }`}
                >
                  <img
                    src={conv.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt={conv.name}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-[#1F1F1F] dark:text-white truncate">
                        {conv.name || 'Conversation'}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {conv.lastMessageTime || ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {conv.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#0B57D0] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-6 text-xs text-gray-400 text-center">No conversations found</div>
          )}
        </div>
      </div>

      {/* Right Chat Conversation View */}
      <div className={`flex-1 flex flex-col ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between bg-white dark:bg-[#1E293B]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden p-1.5 -ml-1 text-gray-600 dark:text-gray-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <img
                  src={activeConversation.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                  alt={activeConversation.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white">
                    {activeConversation.name}
                  </h3>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Active on Tiwi
                  </span>
                </div>
              </div>

              {/* Action Buttons: Audio & Video Call */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTo('call', { recipientId: activeConversation.id, type: 'audio' })}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#111827] text-[#0B57D0] transition-colors"
                  title="Audio Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateTo('call', { recipientId: activeConversation.id, type: 'video' })}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#111827] text-[#0B57D0] transition-colors"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-[#F8F9FA]/60 dark:bg-[#111827]/40">
              {loadingMessages ? (
                <div className="text-xs text-gray-400 text-center py-10">Loading messages...</div>
              ) : messages.map((m) => {
                const isMine = m.senderId === currentUser?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[75%] sm:max-w-[60%] ${
                      isMine ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-[#0B57D0] text-white rounded-br-xs shadow-xs'
                          : 'bg-white dark:bg-[#1E293B] text-[#1F1F1F] dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-bl-xs shadow-xs'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">{m.createdAt || 'Just now'}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-full px-4 py-2.5 focus:outline-none focus:border-[#0B57D0]"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2.5 rounded-full bg-[#0B57D0] text-white hover:bg-[#0842A0] disabled:opacity-40 transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <MessageCircle className="w-12 h-12 stroke-[1.5] text-gray-300 dark:text-gray-600 mb-2" />
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Your Conversations</h4>
            <p className="text-xs text-gray-400 max-w-xs mt-1">Select a chat from the left or start a new direct conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}

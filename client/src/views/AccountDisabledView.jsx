import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  LogOut,
  CheckCircle2,
  Send,
  X,
  ShieldCheck,
  ChevronRight,
  Shield,
  Clock,
  UserCheck,
  Globe
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AccountDisabledView({ bannedInfo, onSignOut, onAccountRestored }) {
  const [showAiModal, setShowAiModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewStepText, setReviewStepText] = useState('');
  const [isRestored, setIsRestored] = useState(false);
  const [restoredData, setRestoredData] = useState(null);
  const messagesEndRef = useRef(null);

  // Dynamic user data resolution
  const resolvedProfile = useMemo(() => {
    let base = bannedInfo || {};
    try {
      const stockUserRaw = localStorage.getItem('stockpro_user');
      if (stockUserRaw) {
        const stockUser = JSON.parse(stockUserRaw);
        base = { ...stockUser, ...base };
      }
      const bannedSavedRaw = sessionStorage.getItem('tiwlo_banned_info') || localStorage.getItem('tiwlo_banned_info');
      if (bannedSavedRaw) {
        const bannedSaved = JSON.parse(bannedSavedRaw);
        base = { ...bannedSaved, ...base };
      }
    } catch (e) {}
    return base;
  }, [bannedInfo]);

  const email = useMemo(() => {
    return resolvedProfile?.email ||
           resolvedProfile?.user?.email ||
           '';
  }, [resolvedProfile]);

  const name = useMemo(() => {
    return resolvedProfile?.name ||
           resolvedProfile?.storeName ||
           (email ? email.split('@')[0] : 'User');
  }, [resolvedProfile, email]);

  const avatar = useMemo(() => {
    return resolvedProfile?.avatar ||
           resolvedProfile?.user?.avatar ||
           null;
  }, [resolvedProfile]);

  const userInitial = useMemo(() => {
    const candidate = name || email || 'T';
    return candidate.charAt(0).toUpperCase();
  }, [name, email]);

  const reason = useMemo(() => {
    return resolvedProfile?.banReason || 'Your account was disabled due to a violation of platform policies.';
  }, [resolvedProfile]);

  // Initial welcome message from Security Specialist
  useEffect(() => {
    if (showAiModal && messages.length === 0) {
      setMessages([
        {
          id: 'init_msg_1',
          sender: 'specialist',
          text: `Welcome to the Tiwlo Account Integrity & Compliance Investigation Board. I have opened your security review case file for ${email || 'your merchant account'}.\n\nYour account access has been suspended under security record: "${reason}".\n\nTo begin your formal case review, please explain the nature of your recent activities or submit your appeal statement below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [showAiModal, email, reason]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isReviewing, reviewStepText]);

  // Send appeal statement to verification agent
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isReviewing || isRestored) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsReviewing(true);

    // Multi-stage realistic review steps
    setReviewStepText('Connecting with Security Review Specialist...');
    const t1 = setTimeout(() => {
      setReviewStepText('Auditing security logs & account flags...');
    }, 2200);

    const t2 = setTimeout(() => {
      setReviewStepText('Evaluating statement against platform safety rules...');
    }, 4500);

    const t3 = setTimeout(() => {
      setReviewStepText('Security Specialist is drafting decision...');
    }, 6200);

    try {
      const historyPayload = messages.map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const startTime = Date.now();
      const res = await fetch(`${API_BASE}/support/appeal-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          message: text,
          conversationHistory: historyPayload
        })
      });

      const data = await res.json();

      // Ensure minimum realistic delay (at least 6.5s)
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 6800 - elapsed);
      await new Promise(r => setTimeout(r, remainingDelay));

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (res.ok) {
        const specialistMsg = {
          id: `spc_${Date.now()}`,
          sender: 'specialist',
          text: data.reply || 'Your appeal has been received. Our security team has documented your case.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          restored: !!data.restored
        };
        setMessages(prev => [...prev, specialistMsg]);

        if (data.restored) {
          setIsRestored(true);
          setRestoredData(data);
        }
      } else {
        setMessages(prev => [...prev, {
          id: `err_${Date.now()}`,
          sender: 'specialist',
          text: data.error || 'The security server is momentarily busy. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'specialist',
        text: 'Network connection interrupted. Please verify your connection and resubmit your statement.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsReviewing(false);
      setReviewStepText('');
    }
  };

  const quickPrompts = [
    "Why was my account disabled?",
    "I was performing legitimate store setup and testing.",
    "I can verify my business identity and agree to all compliance terms."
  ];

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans antialiased text-[#202124] flex flex-col justify-between select-none">
      
      {/* ============================================================== */}
      {/* 1. TOP ACCOUNT NAVIGATION BAR (UNIFIED DESIGN SYSTEM)          */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#dadce0] h-16 px-4 sm:px-8 flex items-center justify-between">
        {/* Left: Tiwlo Brand + Account Label */}
        <div className="flex items-center gap-3">
          <a href="https://tiwlo.com" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <img
              src="/tiwlologo.png"
              alt="Tiwlo"
              className="h-7 sm:h-8 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="hidden items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#1a73e8] text-white font-bold flex items-center justify-center text-sm">
                T
              </div>
              <span className="font-semibold text-lg text-[#202124] tracking-tight">Tiwlo</span>
            </div>
          </a>
          <span className="text-[18px] text-[#5f6368] font-normal pl-3 border-l border-[#dadce0] hidden sm:inline-block leading-none">
            Account
          </span>
        </div>

        {/* Right: Authenticated User Chip & Real Avatar */}
        <div className="flex items-center gap-3">
          {email && (
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f1f3f4] text-[#3c4043] text-xs font-normal border border-[#dadce0]">
              <UserCheck className="w-3.5 h-3.5 text-[#5f6368]" />
              <span className="max-w-[220px] truncate font-medium">{email}</span>
            </div>
          )}

          <div
            title={email ? `${name} (${email})` : 'Account'}
            className="w-9 h-9 rounded-full bg-[#d93025] text-white flex items-center justify-center text-sm font-medium shadow-xs ring-2 ring-red-50 cursor-pointer overflow-hidden relative"
          >
            {avatar ? (
              <>
                <img
                  src={avatar}
                  alt={name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center bg-[#d93025] text-white font-medium text-sm">
                  {userInitial}
                </div>
              </>
            ) : (
              <span>{userInitial}</span>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN CARD CANVAS (IDENTICAL UNIFIED DESIGN SYSTEM)          */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-[520px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 flex flex-col items-center justify-center">
        
        {/* Main Card */}
        <div className="w-full bg-white border border-[#dadce0] rounded-[8px] p-6 sm:p-10 shadow-[0_1px_2px_0_rgba(60,64,67,0.15)] text-center transition-all">
          
          {/* Circular Red Shield Icon */}
          <div className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full bg-[#fce8e6] flex items-center justify-center mx-auto text-[#d93025] mb-5 shadow-xs transition-transform hover:scale-105 duration-300">
            <ShieldAlert className="w-10 h-10 sm:w-11 sm:h-11" strokeWidth={2.2} />
          </div>

          {/* Title */}
          <h1 className="text-[26px] sm:text-[30px] font-normal text-[#202124] tracking-tight leading-tight mb-2">
            Your Tiwlo Account is disabled
          </h1>

          {/* User Chip */}
          {email && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f1f3f4] text-[#3c4043] text-xs font-normal border border-[#dadce0] mb-4">
              <UserCheck className="w-3.5 h-3.5 text-[#5f6368]" />
              <span className="font-medium">{email}</span>
            </div>
          )}

          {/* Body Description */}
          <p className="text-[14px] text-[#5f6368] leading-[22px] mb-5">
            It looks like this account was used in a way that violated Tiwlo's Terms of Service and acceptable use policies.
          </p>

          {/* Reason Notice Box */}
          {reason && (
            <div className="p-4 rounded-[6px] bg-[#f8f9fa] border border-[#dadce0] text-left mb-6 space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#5f6368] block">
                Notice from Compliance Team
              </span>
              <span className="text-[13px] text-[#202124] leading-relaxed block font-normal">
                {reason}
              </span>
              <span className="text-[11px] text-[#70757a] block pt-1">
                If you believe this was in error, our Security Review Team can examine your account immediately.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="w-full h-10 px-8 bg-[#1a73e8] hover:bg-[#1b66c9] active:bg-[#1756a9] text-white rounded-full text-[14px] font-medium shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
            >
              <span>Try to restore</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="w-full h-10 px-8 text-[#1a73e8] hover:bg-[#f8f9fa] rounded-full text-[14px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>

          {/* Bottom Security Link */}
          <div className="mt-6 pt-5 border-t border-[#dadce0] flex items-center justify-between text-xs text-[#5f6368]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#1a73e8]" />
              <span className="font-medium text-[#202124]">Account Security Team</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="text-[#1a73e8] hover:underline font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>Request Formal Review</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </main>

      {/* ============================================================== */}
      {/* 3. STANDARD ACCOUNT FOOTER (MATCHING SECURITY CHECKUP)         */}
      {/* ============================================================== */}
      <footer className="border-t border-[#dadce0] bg-[#ffffff] py-4 px-4 sm:px-8">
        <div className="max-w-[680px] mx-auto flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#5f6368] gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#5f6368]" />
            <span className="hover:text-[#202124] cursor-pointer">English (United States)</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="https://tiwlo.com" className="hover:text-[#202124] transition-colors">Help</a>
            <a href="https://tiwlo.com" className="hover:text-[#202124] transition-colors">Privacy</a>
            <a href="https://tiwlo.com" className="hover:text-[#202124] transition-colors">Terms</a>
            <span>&copy; 2026 Tiwlo, Inc.</span>
          </div>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* 4. SECURITY REVIEW SPECIALIST APPEAL MODAL                     */}
      {/* ============================================================== */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-[500px] h-[580px] bg-white rounded-[12px] shadow-2xl flex flex-col border border-[#dadce0] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#dadce0] bg-[#f8f9fa] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[#1a73e8]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-[#202124]">Account Security Specialist</h3>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5f6368]">Tiwlo Integrity & Compliance Team</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Scroll Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-[#1a73e8] text-white rounded-br-none'
                        : 'bg-[#f1f3f4] text-[#202124] rounded-bl-none border border-[#e8eaed]'
                    }`}
                  >
                    {msg.text}
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        msg.sender === 'user' ? 'text-blue-100' : 'text-[#70757a]'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {/* Realistic Multi-Stage Review Indicator */}
              {isReviewing && (
                <div className="flex justify-start">
                  <div className="bg-[#f1f3f4] border border-[#e8eaed] rounded-2xl rounded-bl-none px-4 py-3 text-xs flex items-center gap-2.5 text-[#3c4043] animate-pulse">
                    <div className="w-4 h-4 rounded-full border-2 border-[#1a73e8] border-t-transparent animate-spin shrink-0" />
                    <span className="text-[11px] font-medium">{reviewStepText || 'Evaluating case...'}</span>
                  </div>
                </div>
              )}

              {/* If Account Successfully Restored by Specialist */}
              {isRestored && (
                <div className="p-4 rounded-xl bg-[#e6f4ea] border border-[#ceead6] text-center space-y-2 mt-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-xs text-[#137333]">Account Successfully Restored!</h4>
                  <p className="text-[11px] text-[#0d652d]">
                    Your appeal has been approved. A security confirmation has been dispatched to <strong>{email}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiModal(false);
                      onAccountRestored?.(restoredData);
                    }}
                    className="mt-2 py-2 px-5 bg-[#137333] hover:bg-[#0d652d] text-white rounded-full text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                  >
                    <span>Proceed to Security Checkup</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips (If not restored yet) */}
            {!isRestored && messages.length <= 3 && (
              <div className="px-4 py-2 bg-[#f8f9fa] border-t border-[#e8eaed] flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="text-[11px] bg-white border border-[#dadce0] hover:border-blue-400 hover:text-blue-600 text-[#3c4043] px-2.5 py-1 rounded-full transition-all cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-[#dadce0] bg-white">
              {!isRestored ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your explanation or question..."
                    disabled={isReviewing}
                    className="flex-1 text-xs px-3.5 py-2.5 bg-[#f1f3f4] rounded-full border border-transparent focus:border-blue-500 focus:bg-white focus:outline-none transition-all placeholder-[#70757a]"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isReviewing}
                    className="w-9 h-9 rounded-full bg-[#1a73e8] hover:bg-[#1b66c9] disabled:bg-slate-200 text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAiModal(false);
                    onAccountRestored?.(restoredData);
                  }}
                  className="w-full py-2.5 bg-[#1a73e8] hover:bg-[#1b66c9] text-white rounded-full text-xs font-semibold cursor-pointer"
                >
                  Proceed to Security Checkup & Dashboard
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { X, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SocialAuthModal({
  isOpen,
  onClose,
  provider = 'Google', // 'Google' | 'Facebook'
  mode = 'login', // 'signup' | 'login'
  onConfirmAccount
}) {
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isGoogle = provider.toLowerCase() === 'google';

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!customName.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setErrorMsg('');
    onConfirmAccount?.({
      email: customEmail.trim(),
      name: customName.trim(),
      provider
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Icon Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
            {isGoogle ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.41 7.34 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.43l4.03-3.14z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {isGoogle ? 'Continue with Google' : 'Continue with Facebook'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authenticate securely using your {provider} account
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCustomSubmit} className="space-y-3.5 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {provider} Email Address
            </label>
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder={isGoogle ? 'you@gmail.com' : 'you@facebook.com'}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 transition"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
          >
            <span>Continue with {provider}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Security / Privacy disclaimer */}
        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 leading-normal pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
          Tiwlo verifies and protects all authentication sessions.
        </p>
      </div>
    </div>
  );
}

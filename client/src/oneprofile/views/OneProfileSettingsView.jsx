import React, { useState } from 'react';
import { User, Mail, Globe, Lock, Shield, Bell, Check } from 'lucide-react';

export default function OneProfileSettingsView() {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [title, setTitle] = useState('Designer & Developer');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Account Settings</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Configure your personal profile details and security preferences.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5 max-w-2xl">
        {saved && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Professional Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

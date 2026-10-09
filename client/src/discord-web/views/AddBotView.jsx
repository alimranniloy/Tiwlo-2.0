import React, { useState } from 'react';
import { ArrowLeft, Bot, Save, Key, Hash, Info, Check } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function AddBotView({ onBack, onBotCreated }) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [prefix, setPrefix] = useState('!');
  const [status, setStatus] = useState('online');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Bot name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await DiscordAPI.createBot({
        name: name.trim(),
        token: token.trim(),
        clientId: clientId.trim(),
        prefix: prefix.trim() || '!',
        status,
        description: description.trim()
      });
      if (onBotCreated) {
        onBotCreated(res.bot);
      } else {
        onBack();
      }
    } catch (err) {
      setError(err.message || 'Failed to register bot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F172A] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to workspace</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Register New Bot
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Connect your custom Discord bot application to automate channels, roles, and interactions.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Bot Name */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Bot Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Bot className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sentinel, Community Guardian"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">The display name of the bot across your workspace.</p>
        </div>

        {/* Command Prefix & Initial Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Command Prefix
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="!"
                maxLength={5}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Symbol used to trigger commands (e.g. !, /, ?).</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="online">Online (Active)</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Status displayed in your connected servers.</p>
          </div>
        </div>

        {/* Client ID */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Application Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 1098234871239084"
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">Found in Discord Developer Portal &gt; General Information.</p>
        </div>

        {/* Bot Token */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Bot Token (Optional for registration)
          </label>
          <div className="relative">
            <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste bot secret token from Discord portal"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Securely stored and encrypted. Never shared publicly.</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Description & Purpose
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this bot handles (e.g. auto-moderation, support tickets, leveling)..."
            className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Registering...' : 'Register Bot'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

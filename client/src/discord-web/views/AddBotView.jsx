import React, { useState } from 'react';
import { ArrowLeft, Bot, Save, Key, Hash, Info, Check, RotateCw, AlertTriangle } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Bots</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Register new bot</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Register New Bot Daemon
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Configure a Discord bot worker application to handle real-time events, commands, and automations.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-[#FCE8E6] border border-[#F9DEDC] text-[#B3261E] text-[13px] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Modern Google Material 3 Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        {/* Bot Name */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Bot Name <span className="text-[#B3261E]">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sentinel, Community Guardian"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
          <p className="text-[11px] text-[#747775]">The display name of the bot worker daemon.</p>
        </div>

        {/* Client ID */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Discord Application / Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 119283849102938491"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Bot Token */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Bot Token (Encrypted)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bot secret token from Discord Developer Portal"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
          <p className="text-[11px] text-[#747775]">Securely stored in PostgreSQL using AES-256 server-side encryption.</p>
        </div>

        {/* Prefix & Initial Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Command Prefix
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="!"
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            >
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="dnd">Do Not Disturb</option>
              <option value="invisible">Offline / Invisible</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Description & Notes
          </label>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief purpose of this bot..."
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Register Bot</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

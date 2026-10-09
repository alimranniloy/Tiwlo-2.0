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
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Bots</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Register new bot</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Register New Bot Daemon
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Configure a Discord bot worker application to handle real-time events, commands, and automations.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] text-[13px] flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Google Cloud Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        {/* Bot Name */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Bot Name <span className="text-[#C5221F]">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sentinel, Community Guardian"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] focus:outline-none focus:border-[#1A73E8]"
          />
          <p className="text-[11px] text-[#5F6368]">The display name of the bot worker daemon.</p>
        </div>

        {/* Client ID */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Discord Application / Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. 119283849102938491"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Bot Token */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Bot Token (Encrypted)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bot secret token from Discord Developer Portal"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
          <p className="text-[11px] text-[#5F6368]">Securely stored in PostgreSQL using AES-256 server-side encryption.</p>
        </div>

        {/* Prefix & Initial Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Command Prefix
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="!"
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="dnd">Do Not Disturb</option>
              <option value="invisible">Offline / Invisible</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Description & Notes
          </label>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief purpose of this bot..."
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F1F3F4] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
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

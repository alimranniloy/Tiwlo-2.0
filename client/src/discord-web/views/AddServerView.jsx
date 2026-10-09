import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Save, Users, Hash, RotateCw, AlertTriangle } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function AddServerView({ onBack, onServerCreated }) {
  const [name, setName] = useState('');
  const [guildId, setGuildId] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [selectedBotId, setSelectedBotId] = useState('');
  const [availableBots, setAvailableBots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadBots() {
      try {
        const bots = await DiscordAPI.getBots();
        setAvailableBots(bots || []);
        if (bots && bots.length > 0) {
          setSelectedBotId(bots[0].id);
        }
      } catch (e) {
        console.warn('Could not load bots:', e);
      }
    }
    loadBots();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Server name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await DiscordAPI.createServer({
        name: name.trim(),
        guildId: guildId.trim() || null,
        memberCount: parseInt(memberCount || '0', 10) || 0,
        botId: selectedBotId || null
      });
      if (onServerCreated) {
        onServerCreated(res.server);
      } else {
        onBack();
      }
    } catch (err) {
      setError(err.message || 'Failed to connect server.');
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
          <span>Connected Servers</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Connect server</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Connect Discord Server
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Link an active Discord guild instance to assign bot workers, automations, and channel monitoring.
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
        {/* Server Name */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Server Name <span className="text-[#B3261E]">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Design Community Hub, Gaming Lounge"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Guild ID */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Discord Guild / Server ID
          </label>
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="e.g. 109823485719234812"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Member Count */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Estimated Member Count
          </label>
          <input
            type="number"
            min="0"
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            placeholder="e.g. 250"
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Assign Initial Bot */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Assign Primary Bot Daemon
          </label>
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          >
            <option value="">No bot (assign later)</option>
            {availableBots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name} ({bot.prefix || '!'})
              </option>
            ))}
          </select>
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
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Connect Server</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

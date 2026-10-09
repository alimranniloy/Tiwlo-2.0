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
    <div className="max-w-3xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Connected Servers</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Connect server</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Connect Discord Server
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Link an active Discord guild instance to assign bot workers, automations, and channel monitoring.
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
        {/* Server Name */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Server Name <span className="text-[#C5221F]">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Design Community Hub, Gaming Lounge"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Guild ID */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Discord Guild / Server ID
          </label>
          <input
            type="text"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            placeholder="e.g. 109823485719234812"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Member Count */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Estimated Member Count
          </label>
          <input
            type="number"
            min="0"
            value={memberCount}
            onChange={(e) => setMemberCount(e.target.value)}
            placeholder="e.g. 250"
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Assign Initial Bot */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Assign Primary Bot Daemon
          </label>
          <select
            value={selectedBotId}
            onChange={(e) => setSelectedBotId(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
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

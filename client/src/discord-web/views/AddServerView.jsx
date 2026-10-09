import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Save, Users, Hash, Box } from 'lucide-react';
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
          Connect Discord Server
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Link your community server to manage bot permissions, automations, and roles.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Server Name */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Server Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Server className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gaming Lounge, Design Collective"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Discord Guild ID & Member Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Discord Guild / Server ID
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="e.g. 987654321098765432"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Copy ID from Discord by right-clicking your server icon.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Member Count
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Assign Bot */}
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Assign Bot to this Server
          </label>
          <div className="relative">
            <Box className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="">No bot assigned initially</option>
              {availableBots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} ({bot.status})
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {availableBots.length === 0
              ? 'No bots created yet. You can create a bot anytime from My bots.'
              : 'Choose which of your registered bots will actively manage this server.'}
          </p>
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
            <span>{saving ? 'Connecting...' : 'Connect Server'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

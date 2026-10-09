import React, { useState, useEffect } from 'react';
import { ArrowLeft, Box, Save, Trash2, Hash, Key, Activity, Server } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function BotDetailView({ botId, onBack, onBotUpdated, onBotDeleted }) {
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('!');
  const [status, setStatus] = useState('online');
  const [description, setDescription] = useState('');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function fetchBot() {
      setLoading(true);
      try {
        const data = await DiscordAPI.getBotById(botId);
        if (data) {
          setBot(data);
          setName(data.name || '');
          setPrefix(data.prefix || '!');
          setStatus(data.status || 'online');
          setDescription(data.description || '');
          setToken(data.token || '');
          setClientId(data.clientId || '');
        }
      } catch (err) {
        setMsg({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (botId) fetchBot();
  }, [botId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await DiscordAPI.updateBot(botId, {
        name,
        prefix,
        status,
        description,
        token,
        clientId
      });
      setBot(res.bot);
      setMsg({ text: 'Bot updated successfully!', type: 'success' });
      if (onBotUpdated) onBotUpdated(res.bot);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update bot', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete bot "${bot?.name}"?`)) return;
    try {
      await DiscordAPI.deleteBot(botId);
      if (onBotDeleted) onBotDeleted(botId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to delete bot', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        <p>Loading bot details...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-gray-500">Bot not found or was removed.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to bots</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F172A] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to bots</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-gray-200 flex items-center justify-center text-gray-700 shadow-xs">
            <Box className="w-6 h-6 stroke-[1.8]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A]">{bot.name}</h1>
            <p className="text-xs text-gray-400 font-mono">ID: {bot.id}</p>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Bot</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Bot Display Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

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
                maxLength={5}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Status
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
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Bot Token
          </label>
          <div className="relative">
            <Key className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

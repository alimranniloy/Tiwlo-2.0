import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bot, Save, Trash2, Hash, Key, Activity, Server, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function BotDetailView({ botId, onBack, onBotUpdated, onBotDeleted }) {
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setMsg({ text: 'Bot configuration saved successfully!', type: 'success' });
      if (onBotUpdated) onBotUpdated(res.bot);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update bot', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await DiscordAPI.deleteBot(botId);
      if (onBotDeleted) onBotDeleted(botId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to delete bot', type: 'error' });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center max-w-4xl mx-auto shadow-none">
        <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#747775]">Loading bot configuration...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-none">
        <AlertTriangle className="w-10 h-10 text-[#B3261E] mx-auto" />
        <h2 className="text-lg font-medium text-[#1F1F1F]">Bot Not Found</h2>
        <p className="text-[13px] text-[#747775]">This bot may have been deleted or moved.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white text-[13px] font-medium rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Bots</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>My Bots</span>
            <span className="text-[#C4C7C5]">/</span>
            <span className="text-[#444746]">{bot.name}</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#1F1F1F] tracking-tight">{bot.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#C4EED0] text-[#072711]">
              <span className="w-2 h-2 rounded-full bg-[#137333]" />
              {bot.status || 'Online'}
            </span>
          </div>
          <p className="text-xs text-[#747775] font-mono mt-1">ID: {bot.id}</p>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-2xl border text-[13px] flex items-center gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]'
              : 'bg-[#C4EED0]/30 text-[#072711] border-[#C4EED0]'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#B3261E]" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Modern Google Material 3 Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
          Bot Configuration
        </h2>

        {/* Name */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Bot Display Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Client ID */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Application Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Token */}
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Secret Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Prefix & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Command Prefix
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Gateway Status
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
            Description
          </label>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* 3. Delete Bot Card (No popup - inline verification) */}
      <div className="bg-white border border-[#FAD2CF] rounded-2xl p-6 sm:p-7 space-y-4 shadow-none">
        <h2 className="text-[16px] font-medium text-[#B3261E]">
          Decommission Bot Daemon
        </h2>
        <p className="text-[13px] text-[#444746]">
          Decommissioning this bot stops all active webhooks, slash commands, and automations immediately.
        </p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-5 py-2 text-[13px] font-medium text-[#B3261E] bg-white border border-[#B3261E]/40 hover:bg-[#FCE8E6] rounded-full transition-colors cursor-pointer"
          >
            Decommission bot...
          </button>
        ) : (
          <div className="p-5 bg-[#FCE8E6]/50 border border-[#FAD2CF] rounded-2xl space-y-4">
            <p className="text-[13px] text-[#B3261E] font-medium">
              Are you sure you want to decommission "{bot.name}"?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 text-[13px] font-medium text-white bg-[#B3261E] hover:bg-[#8C1D18] rounded-full cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Decommission'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 rounded-full"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

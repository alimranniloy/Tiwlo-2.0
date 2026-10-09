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
      <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#1A73E8] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#5F6368]">Loading bot configuration...</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-lg p-12 text-center max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#C5221F] mx-auto" />
        <h2 className="text-lg font-medium text-[#202124]">Bot Not Found</h2>
        <p className="text-[13px] text-[#5F6368]">This bot may have been deleted or moved.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] hover:bg-[#174EA6] text-white text-[13px] font-medium rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Bots</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>My Bots</span>
            <span className="text-[#BDC1C6]">/</span>
            <span className="text-[#5F6368]">{bot.name}</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#202124] tracking-tight">{bot.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
              {bot.status || 'Online'}
            </span>
          </div>
          <p className="text-xs text-[#5F6368] font-mono mt-1">ID: {bot.id}</p>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-lg border text-[13px] flex items-center gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
              : 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Google Cloud Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        <h2 className="text-[16px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
          Bot Configuration
        </h2>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Bot Display Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Client ID */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Application Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Token */}
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Secret Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Prefix & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Command Prefix
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Gateway Status
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
            Description
          </label>
          <textarea
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#F1F3F4] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs disabled:opacity-50"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* 3. Delete Bot Card (No popup - inline verification) */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-6 space-y-4">
        <h2 className="text-[16px] font-medium text-[#C5221F]">
          Decommission Bot Daemon
        </h2>
        <p className="text-[13px] text-[#5F6368]">
          Decommissioning this bot stops all active webhooks, slash commands, and automations immediately.
        </p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 text-[13px] font-medium text-[#C5221F] bg-white border border-[#FAD2CF] hover:bg-[#FCE8E6] rounded-md transition-colors"
          >
            Decommission bot...
          </button>
        ) : (
          <div className="p-4 bg-[#FCE8E6] border border-[#FAD2CF] rounded-md space-y-3">
            <p className="text-[13px] text-[#C5221F] font-medium">
              Are you sure you want to decommission "{bot.name}"?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#C5221F] hover:bg-[#A51D24] rounded-md shadow-2xs"
              >
                {deleting ? 'Deleting...' : 'Confirm Decommission'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] rounded-md"
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

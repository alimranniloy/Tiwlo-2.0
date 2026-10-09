import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Save, Trash2, Bot, Plus, X, Users, Hash, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function ServerDetailView({ serverId, onBack, onServerUpdated, onServerDeleted }) {
  const [server, setServer] = useState(null);
  const [allBots, setAllBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [guildId, setGuildId] = useState('');
  const [selectedBotToAssign, setSelectedBotToAssign] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [srv, bots] = await Promise.all([
          DiscordAPI.getServerById(serverId),
          DiscordAPI.getBots()
        ]);
        if (srv) {
          setServer(srv);
          setName(srv.name || '');
          setMemberCount(srv.memberCount || 0);
          setGuildId(srv.guildId || '');
        }
        setAllBots(bots || []);
      } catch (err) {
        setMsg({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (serverId) loadData();
  }, [serverId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await DiscordAPI.updateServer(serverId, {
        name,
        memberCount: parseInt(memberCount || '0', 10) || 0,
        guildId
      });
      setServer(res.server);
      setMsg({ text: 'Server configuration updated successfully!', type: 'success' });
      if (onServerUpdated) onServerUpdated(res.server);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update server', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignBot = async () => {
    if (!selectedBotToAssign) return;
    try {
      const res = await DiscordAPI.assignBotToServer(serverId, selectedBotToAssign);
      setServer(res.server);
      setSelectedBotToAssign('');
      setMsg({ text: 'Bot assigned to server!', type: 'success' });
      if (onServerUpdated) onServerUpdated(res.server);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to assign bot', type: 'error' });
    }
  };

  const handleRemoveBot = async (botId) => {
    try {
      const res = await DiscordAPI.removeBotFromServer(serverId, botId);
      setServer(res.server);
      setMsg({ text: 'Bot unassigned from server.', type: 'success' });
      if (onServerUpdated) onServerUpdated(res.server);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to remove bot', type: 'error' });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await DiscordAPI.deleteServer(serverId);
      if (onServerDeleted) onServerDeleted(serverId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to delete server', type: 'error' });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center max-w-4xl mx-auto shadow-none">
        <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#747775]">Loading server details...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-none">
        <AlertTriangle className="w-10 h-10 text-[#B3261E] mx-auto" />
        <h2 className="text-lg font-medium text-[#1F1F1F]">Server Not Found</h2>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white text-[13px] font-medium rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Servers</span>
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
            <span>Connected Servers</span>
            <span className="text-[#C4C7C5]">/</span>
            <span className="text-[#444746]">{server.name}</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#1F1F1F] tracking-tight">{server.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#C4EED0] text-[#072711]">
              <span className="w-2 h-2 rounded-full bg-[#137333]" />
              Connected
            </span>
          </div>
          <p className="text-xs text-[#747775] font-mono mt-1">Guild ID: {server.guildId || 'N/A'}</p>
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

      {/* 2. Server Configuration Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
          Server Details
        </h2>

        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Server Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Discord Guild ID
            </label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-[#1F1F1F]">
              Member Count
            </label>
            <input
              type="number"
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Server</span>
          </button>
        </div>
      </form>

      {/* 3. Assigned Bots Card */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
          Assigned Bot Workers
        </h2>

        {/* List of assigned bots */}
        {(server.bots || []).length > 0 ? (
          <div className="divide-y divide-[#F0F4F9]">
            {server.bots.map((b) => (
              <div key={b.id || b.name} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#C2E7FF] text-[#001D35] flex items-center justify-center font-bold text-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-medium text-[#1F1F1F] text-[13px]">{b.name}</span>
                    <span className="text-[11px] text-[#747775] block">Prefix: {b.prefix || '!'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBot(b.id)}
                  className="text-[12px] font-medium text-[#B3261E] hover:underline cursor-pointer"
                >
                  Unassign
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#747775] py-2">No bots currently assigned to this server.</p>
        )}

        {/* Assign new bot */}
        <div className="pt-4 border-t border-[#F0F4F9] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedBotToAssign}
            onChange={(e) => setSelectedBotToAssign(e.target.value)}
            className="flex-1 bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          >
            <option value="">Select a bot to assign...</option>
            {allBots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.prefix || '!'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssignBot}
            disabled={!selectedBotToAssign}
            className="px-5 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
          >
            Assign Bot
          </button>
        </div>
      </div>

      {/* 4. Disconnect Server Card (No popup) */}
      <div className="bg-white border border-[#FAD2CF] rounded-2xl p-6 sm:p-7 space-y-4 shadow-none">
        <h2 className="text-[16px] font-medium text-[#B3261E]">
          Disconnect Community Server
        </h2>
        <p className="text-[13px] text-[#444746]">
          Disconnecting this guild removes all bot webhooks and role sync configurations.
        </p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-5 py-2 text-[13px] font-medium text-[#B3261E] bg-white border border-[#B3261E]/40 hover:bg-[#FCE8E6] rounded-full transition-colors cursor-pointer"
          >
            Disconnect server...
          </button>
        ) : (
          <div className="p-5 bg-[#FCE8E6]/50 border border-[#FAD2CF] rounded-2xl space-y-4">
            <p className="text-[13px] text-[#B3261E] font-medium">
              Are you sure you want to disconnect "{server.name}"?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 text-[13px] font-medium text-white bg-[#B3261E] hover:bg-[#8C1D18] rounded-full cursor-pointer"
              >
                {deleting ? 'Disconnecting...' : 'Confirm Disconnect'}
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

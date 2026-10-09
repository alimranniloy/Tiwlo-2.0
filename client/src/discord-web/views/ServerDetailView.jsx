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
      <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#1A73E8] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#5F6368]">Loading server details...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-lg p-12 text-center max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#C5221F] mx-auto" />
        <h2 className="text-lg font-medium text-[#202124]">Server Not Found</h2>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] hover:bg-[#174EA6] text-white text-[13px] font-medium rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Servers</span>
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
            <span>Connected Servers</span>
            <span className="text-[#BDC1C6]">/</span>
            <span className="text-[#5F6368]">{server.name}</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#202124] tracking-tight">{server.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
              Connected
            </span>
          </div>
          <p className="text-xs text-[#5F6368] font-mono mt-1">Guild ID: {server.guildId || 'N/A'}</p>
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

      {/* 2. Server Configuration Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        <h2 className="text-[16px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
          Server Details
        </h2>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Server Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Discord Guild ID
            </label>
            <input
              type="text"
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-[#202124]">
              Member Count
            </label>
            <input
              type="number"
              value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#F1F3F4] flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs disabled:opacity-50"
          >
            {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Server</span>
          </button>
        </div>
      </form>

      {/* 3. Assigned Bots Card */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-4">
        <h2 className="text-[16px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
          Assigned Bot Workers
        </h2>

        {/* List of assigned bots */}
        {(server.bots || []).length > 0 ? (
          <div className="divide-y divide-[#F1F3F4]">
            {server.bots.map((b) => (
              <div key={b.id || b.name} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold text-xs border border-[#D2E3FC]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-medium text-[#202124] text-[13px]">{b.name}</span>
                    <span className="text-[11px] text-[#5F6368] block">Prefix: {b.prefix || '!'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBot(b.id)}
                  className="text-[12px] font-medium text-[#C5221F] hover:underline"
                >
                  Unassign
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#5F6368] py-2">No bots currently assigned to this server.</p>
        )}

        {/* Assign new bot */}
        <div className="pt-3 border-t border-[#F1F3F4] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedBotToAssign}
            onChange={(e) => setSelectedBotToAssign(e.target.value)}
            className="flex-1 bg-white border border-[#DADCE0] rounded-md px-3 py-1.5 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
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
            className="px-4 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors disabled:opacity-50"
          >
            Assign Bot
          </button>
        </div>
      </div>

      {/* 4. Disconnect Server Card (No popup) */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-6 space-y-4">
        <h2 className="text-[16px] font-medium text-[#C5221F]">
          Disconnect Community Server
        </h2>
        <p className="text-[13px] text-[#5F6368]">
          Disconnecting this guild removes all bot webhooks and role sync configurations.
        </p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 text-[13px] font-medium text-[#C5221F] bg-white border border-[#FAD2CF] hover:bg-[#FCE8E6] rounded-md transition-colors"
          >
            Disconnect server...
          </button>
        ) : (
          <div className="p-4 bg-[#FCE8E6] border border-[#FAD2CF] rounded-md space-y-3">
            <p className="text-[13px] text-[#C5221F] font-medium">
              Are you sure you want to disconnect "{server.name}"?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#C5221F] hover:bg-[#A51D24] rounded-md shadow-2xs"
              >
                {deleting ? 'Disconnecting...' : 'Confirm Disconnect'}
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

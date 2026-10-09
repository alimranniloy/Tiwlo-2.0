import React, { useState, useEffect } from 'react';
import { ArrowLeft, Server, Save, Trash2, Box, Plus, X, Users, Hash } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function ServerDetailView({ serverId, onBack, onServerUpdated, onServerDeleted }) {
  const [server, setServer] = useState(null);
  const [allBots, setAllBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setMsg({ text: 'Server details updated successfully!', type: 'success' });
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
    if (!window.confirm(`Are you sure you want to disconnect server "${server?.name}"?`)) return;
    try {
      await DiscordAPI.deleteServer(serverId);
      if (onServerDeleted) onServerDeleted(serverId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to delete server', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        <p>Loading server details...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-gray-500">Server not found or was removed.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to servers</span>
        </button>
      </div>
    );
  }

  const assignedBots = server.bots || [];
  const assignedBotIds = assignedBots.map((b) => b.id);
  const unassignedBots = allBots.filter((b) => !assignedBotIds.includes(b.id));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F172A] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to servers</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 font-bold text-lg flex items-center justify-center shrink-0">
            {server.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A]">{server.name}</h1>
            <p className="text-xs text-gray-400 font-mono">ID: {server.id}</p>
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Disconnect Server</span>
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

      {/* Server Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-[#0F172A]">Server Settings</h2>

        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Server Name
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
              Member Count
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
              Discord Guild ID
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Assigned Bots Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0F172A]">Assigned Bots in Server</h2>

        {/* Assigned Bots List */}
        {assignedBots.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {assignedBots.map((b) => (
              <div key={b.id || b.name} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-[#0F172A]">{b.name}</span>
                    <span className="text-xs text-gray-400 block capitalize">{b.status || 'Active'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveBot(b.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Unassign Bot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No bots currently assigned to this server.</p>
        )}

        {/* Assign another bot */}
        {unassignedBots.length > 0 && (
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <select
              value={selectedBotToAssign}
              onChange={(e) => setSelectedBotToAssign(e.target.value)}
              className="flex-1 bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="">Select a bot to assign...</option>
              {unassignedBots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssignBot}
              disabled={!selectedBotToAssign}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Assign</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

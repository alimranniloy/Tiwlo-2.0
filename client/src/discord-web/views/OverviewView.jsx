import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  MoreHorizontal,
  ArrowRight,
  Box,
  Bot,
  Server,
  MessageSquare,
  UserCheck,
  Terminal,
  Clock,
  ExternalLink
} from 'lucide-react';

export default function OverviewView({
  overviewData,
  loading,
  onNavigate
}) {
  const [serverSearch, setServerSearch] = useState('');
  const [serverFilter, setServerFilter] = useState('all');

  const {
    botsOnlineCount = 0,
    connectedServersCount = 0,
    totalMembersCount = 0,
    servers = [],
    bots = [],
    recentActivities = []
  } = overviewData || {};

  // Filter servers by search term
  const filteredServers = servers.filter((server) => {
    if (!serverSearch.trim()) return true;
    return server.name.toLowerCase().includes(serverSearch.toLowerCase().trim());
  });

  // Helper for server avatar color palette
  const getAvatarBg = (name = '') => {
    const charCode = name.charCodeAt(0) || 0;
    const palettes = [
      { bg: 'bg-[#EBF5FF]', text: 'text-[#1D4ED8]' }, // soft blue
      { bg: 'bg-[#F3E8FF]', text: 'text-[#7E22CE]' }, // soft purple
      { bg: 'bg-[#DCFCE7]', text: 'text-[#15803D]' }, // soft green
      { bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]' }, // soft amber
      { bg: 'bg-[#FCE7F3]', text: 'text-[#BE185D]' }, // soft pink
    ];
    return palettes[charCode % palettes.length];
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* 1. Header: Your workspace */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            Your workspace
          </h1>
          <p className="text-gray-500 text-base mt-1">
            A calm place to manage your bots and communities.
          </p>

          {/* Real Metrics Counter Bar */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-4 text-sm font-medium text-[#334155]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" />
              <span>{botsOnlineCount} bots online</span>
            </div>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <div>
              <span>{connectedServersCount} connected servers</span>
            </div>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <div>
              <span>{totalMembersCount.toLocaleString()} members</span>
            </div>
          </div>
        </div>

        {/* Primary CTA: Add Bot */}
        <div>
          <button
            onClick={() => onNavigate('/discord/bots/new')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add bot</span>
          </button>
        </div>
      </div>

      {/* 2. Section: Your servers */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Your servers</h2>
            <p className="text-gray-500 text-sm">
              Choose a server to manage its bots and settings.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 border border-[#E2E8F0] text-sm font-semibold text-[#0F172A] shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>Add server</span>
          </button>
        </div>

        {/* Server Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={serverSearch}
              onChange={(e) => setServerSearch(e.target.value)}
              placeholder="Search servers"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="relative">
            <select
              value={serverFilter}
              onChange={(e) => setServerFilter(e.target.value)}
              className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-4 py-2 pr-9 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All servers</option>
              <option value="active">Active</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Server Cards Grid */}
        {filteredServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {filteredServers.map((server) => {
              const palette = getAvatarBg(server.name);
              const serverBots = server.bots || [];

              return (
                <div
                  key={server.id}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Avatar, Name, Members, Menu */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl ${palette.bg} ${palette.text} font-bold text-base flex items-center justify-center shrink-0`}
                        >
                          {server.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#0F172A] truncate">
                            {server.name}
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            {(Number(server.memberCount) || 0).toLocaleString()} members
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onNavigate(`/discord/servers/${server.id}`)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
                        aria-label="Server options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Middle: Assigned Bots */}
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                        Bots
                      </span>
                      {serverBots.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-3">
                          {serverBots.map((b) => (
                            <div key={b.id || b.name} className="flex items-center gap-1.5 text-sm font-medium text-[#1E293B]">
                              <Box className="w-4 h-4 text-gray-500 stroke-[1.8]" />
                              <span>{b.name}</span>
                              <span
                                className={`w-2 h-2 rounded-full inline-block ${
                                  (b.status || '').toLowerCase() === 'online'
                                    ? 'bg-[#10B981]'
                                    : 'bg-gray-300'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No bots assigned</p>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Open Server Action */}
                  <div className="mt-5 pt-3">
                    <button
                      onClick={() => onNavigate(`/discord/servers/${server.id}`)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
                    >
                      <span>Open server</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Clean Google-inspired Empty State */
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-gray-400 flex items-center justify-center mx-auto mb-4">
              <Server className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">No Discord servers connected yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mt-1 mb-5">
              Connect your Discord community server to manage its bots, welcome messages, auto-roles, and automations.
            </p>
            <button
              onClick={() => onNavigate('/discord/servers/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Connect first server</span>
            </button>
          </div>
        )}
      </section>

      {/* 3. Section: Your bots */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0F172A]">Your bots</h2>
          <button
            onClick={() => onNavigate('/discord/bots')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {bots.length > 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-gray-500 font-medium text-xs bg-[#FAFAFA]">
                    <th className="py-3 px-5 font-medium">Bot</th>
                    <th className="py-3 px-5 font-medium">Status</th>
                    <th className="py-3 px-5 font-medium">Servers</th>
                    <th className="py-3 px-5 font-medium">Commands today</th>
                    <th className="py-3 px-5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bots.map((bot) => (
                    <tr key={bot.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                            <Box className="w-4 h-4 stroke-[1.8]" />
                          </div>
                          <span className="font-semibold text-[#0F172A]">{bot.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full inline-block ${
                              (bot.status || '').toLowerCase() === 'online'
                                ? 'bg-[#10B981]'
                                : 'bg-gray-300'
                            }`}
                          />
                          <span className="font-medium text-[#1E293B] capitalize">
                            {bot.status || 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-gray-600 font-medium">
                        {bot.serversCount || 0}
                      </td>
                      <td className="py-4 px-5 text-gray-600 font-medium">
                        {(bot.commandsToday || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Clean Google-inspired Empty State */
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-gray-400 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">No Discord bots created yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto mt-1 mb-5">
              Register your first bot token, setup command prefixes, and configure automated welcome replies.
            </p>
            <button
              onClick={() => onNavigate('/discord/bots/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create first bot</span>
            </button>
          </div>
        )}
      </section>

      {/* 4. Bottom Grid: Recent activity & Quick setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
        {/* Left Column: Recent activity */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0F172A]">Recent activity</h2>
            <button
              onClick={() => onNavigate('/discord/activity')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs divide-y divide-gray-100">
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div key={act.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-gray-200 flex items-center justify-center text-gray-600 shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">
                      {act.title}
                    </p>
                    {act.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {act.description}
                      </p>
                    )}
                    <span className="text-[11px] text-gray-400 mt-1 inline-block">
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-400">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity recorded yet.</p>
                <p className="text-xs text-gray-400 mt-0.5">Events, bot joins, and command runs will appear here.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Quick setup */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Quick setup</h2>
          </div>

          <div className="space-y-3">
            {/* Welcome messages */}
            <button
              onClick={() => onNavigate('/discord/automations/welcome')}
              className="w-full bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-blue-600 transition-colors">
                    Welcome messages
                  </h4>
                  <p className="text-xs text-gray-500">
                    Greet new members automatically
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Auto roles */}
            <button
              onClick={() => onNavigate('/discord/automations/auto-roles')}
              className="w-full bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] text-[#16A34A] flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-blue-600 transition-colors">
                    Auto roles
                  </h4>
                  <p className="text-xs text-gray-500">
                    Assign roles based on activity
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>

            {/* Custom commands */}
            <button
              onClick={() => onNavigate('/discord/automations/commands')}
              className="w-full bg-white border border-[#E2E8F0] rounded-2xl p-4.5 shadow-xs hover:border-blue-400 hover:shadow-sm transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] text-[#9333EA] flex items-center justify-center shrink-0">
                  <Terminal className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-blue-600 transition-colors">
                    Custom commands
                  </h4>
                  <p className="text-xs text-gray-500">
                    Create custom commands for your bots
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

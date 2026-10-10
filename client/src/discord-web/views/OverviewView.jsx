import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  MoreVertical,
  ArrowRight,
  Bot,
  Server,
  MessageSquare,
  Shield,
  Activity,
  Clock,
  ExternalLink,
  RotateCw,
  CheckCircle2,
  Layers,
  Filter
} from 'lucide-react';

export default function OverviewView({
  overviewData,
  loading,
  onNavigate
}) {
  const [serverSearch, setServerSearch] = useState('');
  const [serverFilter, setServerFilter] = useState('all');

  const {
    botsRegisteredCount = 0,
    connectedServersCount = 0,
    totalMembersCount = 0,
    servers = [],
    bots = [],
    recentActivities = []
  } = overviewData || {};

  // Filter servers
  const filteredServers = servers.filter((server) => {
    if (!serverSearch.trim()) return true;
    return server.name.toLowerCase().includes(serverSearch.toLowerCase().trim());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
              Console Overview
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Centrally manage automated bot daemons, connected servers, and live operational traffic.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('/discord/bots/new')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add bot</span>
          </button>

          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#0B57D0]" />
            <span>Connect server</span>
          </button>
        </div>
      </div>

      {/* 2. Modern Google KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Registered Bots
          </div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5 flex items-center gap-2">
            <span>{botsRegisteredCount}</span>
            <span className="text-xs px-3 py-0.5 rounded-full bg-[#F0F4F9] text-[#444746] font-medium">
              Created in this account
            </span>
          </div>
          <p className="text-[12px] text-[#747775] mt-1">
            Currently marked online
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Connected Environments
          </div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5">
            {connectedServersCount}
          </div>
          <p className="text-[12px] text-[#747775] mt-1">
            Linked Discord guild instances
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Community Reach
          </div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5">
            {totalMembersCount.toLocaleString()}
          </div>
          <p className="text-[12px] text-[#747775] mt-1">
            Total verified server members
          </p>
        </div>
      </div>

      {/* 3. Connected Servers Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-medium text-[#1F1F1F]">
              Connected Discord Servers
            </h2>
            <p className="text-[12px] text-[#747775]">
              Target communities provisioned with Tiwlo automations and bots.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#747775] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                placeholder="Filter servers..."
                className="bg-[#F0F4F9] border border-transparent rounded-full pl-9 pr-4 py-1.5 text-[12px] text-[#1F1F1F] placeholder-[#747775] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
              />
            </div>
            <button
              onClick={() => onNavigate('/discord/servers')}
              className="text-[13px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
            >
              View all servers →
            </button>
          </div>
        </div>

        {/* Server Cards */}
        {filteredServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServers.map((server) => (
              <div
                key={server.id}
                onClick={() => onNavigate(`/discord/servers/${server.id}`)}
                className="bg-white border border-[#E0E2EC] hover:border-[#0B57D0] rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#C2E7FF] text-[#001D35] flex items-center justify-center font-bold text-sm shrink-0">
                        {server.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-medium text-[#1F1F1F] truncate group-hover:text-[#0B57D0] transition-colors">
                          {server.name}
                        </h3>
                        <p className="text-[12px] text-[#747775]">
                          {(Number(server.memberCount) || 0).toLocaleString()} members
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Bots */}
                  <div className="mt-4 pt-3 border-t border-[#F0F4F9]">
                    <div className="text-[11px] font-medium text-[#747775] uppercase tracking-wider mb-2">
                      Active bot daemons
                    </div>
                    {server.bots && server.bots.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {server.bots.map((b) => (
                          <span
                            key={b.id || b.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0F4F9] text-[#1F1F1F]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                            {b.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#747775] italic">No active bots</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 flex items-center justify-between text-[12px] text-[#0B57D0] font-medium">
                  <span>Manage server</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#E0E2EC] rounded-2xl p-10 text-center">
            <Server className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
            <p className="text-[14px] font-medium text-[#1F1F1F]">No servers connected</p>
            <button
              onClick={() => onNavigate('/discord/servers/new')}
              className="mt-3 px-5 py-2 text-[13px] font-medium text-white bg-[#0B57D0] rounded-full hover:bg-[#0842A0] cursor-pointer"
            >
              Connect first server
            </button>
          </div>
        )}
      </div>

      {/* 4. Active Bots Table */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        <div className="px-6 py-4 border-b border-[#E0E2EC] bg-[#FFFFFF] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-[#1F1F1F]">Managed Bot Daemons</h2>
            <p className="text-[11px] text-[#747775]">Active workers registered in your console.</p>
          </div>
          <button
            onClick={() => onNavigate('/discord/bots')}
            className="text-[12px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
          >
            View all bots →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F0F4F9]/60 border-b border-[#E0E2EC] text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Bot Name</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Connected Servers</th>
                <th className="py-3 px-6">Latency</th>
                <th className="py-3 px-6 text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {bots.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[#747775]">
                    No bots provisioned. Click "Add bot" above to deploy one.
                  </td>
                </tr>
              ) : (
                bots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#F0F4F9]/40 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#C2E7FF] text-[#001D35] flex items-center justify-center font-bold text-xs">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <button
                            onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                            className="font-medium text-[#0B57D0] hover:underline cursor-pointer"
                          >
                            {bot.name}
                          </button>
                          <div className="text-[11px] text-[#747775]">v{bot.version || '1.0'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium ${bot.status === 'online' ? 'bg-[#C4EED0] text-[#072711]' : 'bg-[#F0F4F9] text-[#444746]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'online' ? 'bg-[#137333]' : 'bg-[#747775]'}`} />
                        <span>{bot.status || 'Status unavailable'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-[#444746]">
                      {bot.serversCount ?? (bot.servers || []).length} servers
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[12px] text-[#747775]">
                      {bot.latency || '—'}
                    </td>
                    <td className="py-3.5 px-6 text-right pr-6">
                      <button
                        onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                        className="text-[12px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Live Operations Audit Stream */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 shadow-none">
        <div className="flex items-center justify-between border-b border-[#F0F4F9] pb-3 mb-4">
          <h2 className="text-[15px] font-medium text-[#1F1F1F]">
            Recent Console Events
          </h2>
          <button
            onClick={() => onNavigate('/discord/activity')}
            className="text-[12px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
          >
            Full activity log →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#E0E2EC] text-[#747775] uppercase text-[11px] font-medium bg-[#F0F4F9]/60">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Activity</th>
                <th className="py-2.5 px-4">Server / Scope</th>
                <th className="py-2.5 px-4 text-right pr-4">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {recentActivities.slice(0, 5).map((act, i) => (
                <tr key={i} className="hover:bg-[#F0F4F9]/40">
                  <td className="py-3 px-4 text-[#747775] font-mono">{act.createdAt ? new Date(act.createdAt).toLocaleString() : '—'}</td>
                  <td className="py-3 px-4 font-medium text-[#1F1F1F]">{act.action}</td>
                  <td className="py-3 px-4 text-[#444746]">{act.serverName || '—'}</td>
                  <td className="py-3 px-4 text-right pr-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium bg-[#C4EED0] text-[#072711]">
                      Success
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

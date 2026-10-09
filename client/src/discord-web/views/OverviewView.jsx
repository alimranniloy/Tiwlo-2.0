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
    botsOnlineCount = 0,
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
              Console Overview
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8] font-medium border border-[#D2E3FC]">
              Cluster Healthy
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Centrally manage automated bot daemons, connected servers, and live operational traffic.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('/discord/bots/new')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add bot</span>
          </button>

          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#5F6368]" />
            <span>Connect server</span>
          </button>
        </div>
      </div>

      {/* 2. Google Cloud KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Bots Active
          </div>
          <div className="text-2xl font-normal text-[#202124] mt-1.5 flex items-center gap-2">
            <span>{botsOnlineCount}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] font-medium border border-[#CEEAD6]">
              Operational
            </span>
          </div>
          <p className="text-[12px] text-[#5F6368] mt-1">
            Running with active heartbeat websocket
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Connected Environments
          </div>
          <div className="text-2xl font-normal text-[#202124] mt-1.5">
            {connectedServersCount}
          </div>
          <p className="text-[12px] text-[#5F6368] mt-1">
            Linked Discord guild instances
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Community Reach
          </div>
          <div className="text-2xl font-normal text-[#202124] mt-1.5">
            {totalMembersCount.toLocaleString()}
          </div>
          <p className="text-[12px] text-[#5F6368] mt-1">
            Total verified server members
          </p>
        </div>
      </div>

      {/* 3. Connected Servers Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-medium text-[#202124]">
              Connected Discord Servers
            </h2>
            <p className="text-[12px] text-[#5F6368]">
              Target communities provisioned with Tiwlo automations and bots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5F6368] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                placeholder="Filter servers..."
                className="bg-white border border-[#DADCE0] rounded-md pl-8 pr-3 py-1 text-[12px] text-[#202124] placeholder-[#5F6368] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
            <button
              onClick={() => onNavigate('/discord/servers')}
              className="text-[13px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
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
                className="bg-white border border-[#DADCE0] hover:border-[#1A73E8] rounded-lg p-5 flex flex-col justify-between transition-all hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3)] cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-md bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center font-bold text-sm shrink-0">
                        {server.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[14px] font-medium text-[#202124] truncate">
                          {server.name}
                        </h3>
                        <p className="text-[12px] text-[#5F6368]">
                          {(Number(server.memberCount) || 0).toLocaleString()} members
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Bots */}
                  <div className="mt-4 pt-3 border-t border-[#F1F3F4]">
                    <div className="text-[11px] font-medium text-[#5F6368] uppercase tracking-wider mb-2">
                      Active bot daemons
                    </div>
                    {server.bots && server.bots.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {server.bots.map((b) => (
                          <span
                            key={b.id || b.name}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F3F4] text-[#3C4043] border border-[#DADCE0]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                            {b.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#5F6368] italic">No active bots</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 flex items-center justify-between text-[12px] text-[#1A73E8] font-medium">
                  <span>Manage server</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-[#DADCE0] rounded-lg p-10 text-center">
            <Server className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
            <p className="text-[14px] font-medium text-[#202124]">No servers connected</p>
            <button
              onClick={() => onNavigate('/discord/servers/new')}
              className="mt-3 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] rounded-md hover:bg-[#174EA6]"
            >
              Connect first server
            </button>
          </div>
        )}
      </div>

      {/* 4. Active Bots Table */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-[#202124]">Managed Bot Daemons</h2>
            <p className="text-[11px] text-[#5F6368]">Active workers registered in your console.</p>
          </div>
          <button
            onClick={() => onNavigate('/discord/bots')}
            className="text-[12px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
          >
            View all bots →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-5">Bot Name</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Connected Servers</th>
                <th className="py-3 px-5">Latency</th>
                <th className="py-3 px-5 text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {bots.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[#5F6368]">
                    No bots provisioned. Click "Add bot" above to deploy one.
                  </td>
                </tr>
              ) : (
                bots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold text-xs border border-[#D2E3FC]">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <button
                            onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                            className="font-medium text-[#1A73E8] hover:underline"
                          >
                            {bot.name}
                          </button>
                          <div className="text-[11px] text-[#5F6368]">v{bot.version || '1.0'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                        <span>Online</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#3C4043]">
                      {(bot.servers || []).length || 1} servers
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[12px] text-[#5F6368]">
                      {bot.latency || '28ms'}
                    </td>
                    <td className="py-3.5 px-5 text-right pr-6">
                      <button
                        onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                        className="text-[12px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
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
      <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
        <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-3 mb-3">
          <h2 className="text-[14px] font-medium text-[#202124]">
            Recent Console Events
          </h2>
          <button
            onClick={() => onNavigate('/discord/activity')}
            className="text-[12px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
          >
            Full activity log →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#DADCE0] text-[#5F6368] uppercase text-[11px] font-medium">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Activity</th>
                <th className="py-2 px-3">Server / Scope</th>
                <th className="py-2 px-3 text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F4]">
              {recentActivities.slice(0, 5).map((act, i) => (
                <tr key={i} className="hover:bg-[#F8F9FA]">
                  <td className="py-2.5 px-3 text-[#5F6368] font-mono">{act.timeAgo || 'Just now'}</td>
                  <td className="py-2.5 px-3 font-medium text-[#202124]">{act.action}</td>
                  <td className="py-2.5 px-3 text-[#3C4043]">{act.serverName || 'System'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333]">
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

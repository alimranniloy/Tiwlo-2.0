import React, { useState } from 'react';
import {
  Plus,
  Search,
  Bot,
  ArrowLeft
} from 'lucide-react';

export default function BotsView({ bots = [], onNavigate }) {
  const [search, setSearch] = useState('');

  const filteredBots = bots.filter((b) => {
    if (!search.trim()) return true;
    return b.name.toLowerCase().includes(search.toLowerCase().trim());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <button
            onClick={() => onNavigate('/discord')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Console Overview</span>
            <span className="text-[#C4C7C5]">/</span>
            <span className="text-[#444746]">Bots</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
            My Bots
          </h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Registered worker daemons, gateway latencies, command prefixes, and server assignments.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/bots/new')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add bot</span>
        </button>
      </div>

      {/* 2. Modern Google Material 3 Table Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        {/* Table Filter Toolbar */}
        <div className="flex items-center justify-between border-b border-[#E0E2EC] px-5 py-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-2.5 flex-1 max-w-md bg-[#F0F4F9] rounded-full px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-[#0B57D0] transition-all">
            <Search className="w-4 h-4 text-[#747775] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter bots by name or ID..."
              className="w-full text-[13px] text-[#1F1F1F] placeholder-[#747775] bg-transparent focus:outline-none"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[12px] text-[#0B57D0] hover:underline cursor-pointer ml-3 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F0F4F9]/60 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Bot Resource</th>
                <th className="py-3 px-6">Prefix</th>
                <th className="py-3 px-6">Gateway Status</th>
                <th className="py-3 px-6">Connected Servers</th>
                <th className="py-3 px-6">Throughput Today</th>
                <th className="py-3 px-6 text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {filteredBots.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#747775]">
                    <Bot className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
                    <p className="font-medium text-[#1F1F1F]">No bots match your filter</p>
                    <button
                      onClick={() => onNavigate('/discord/bots/new')}
                      className="mt-2 text-[#0B57D0] hover:underline font-medium cursor-pointer"
                    >
                      Provision a new bot
                    </button>
                  </td>
                </tr>
              ) : (
                filteredBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#F0F4F9]/40 transition-colors">
                    {/* Bot Name */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#C2E7FF] text-[#001D35] flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div>
                          <button
                            onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                            className="font-medium text-[#0B57D0] hover:underline text-left leading-tight cursor-pointer"
                          >
                            {bot.name}
                          </button>
                          <div className="text-[11px] text-[#747775] mt-0.5 max-w-xs truncate">
                            {bot.description || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Prefix */}
                    <td className="py-3.5 px-6 font-mono font-bold text-[#1F1F1F]">
                      {bot.prefix || '!'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium ${bot.status === 'online' ? 'bg-[#C4EED0] text-[#072711]' : 'bg-[#F0F4F9] text-[#444746]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'online' ? 'bg-[#137333]' : 'bg-[#747775]'}`} />
                        <span>{bot.status || 'Status unavailable'}</span>
                      </span>
                    </td>

                    {/* Servers */}
                    <td className="py-3.5 px-6 text-[#444746]">
                      {bot.serversCount ?? (bot.servers || []).length} servers
                    </td>

                    {/* Throughput */}
                    <td className="py-3.5 px-6 text-[#747775] text-[12px]">
                      {(bot.commandsToday ?? 0).toLocaleString()} commands today
                    </td>

                    {/* Action */}
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
    </div>
  );
}

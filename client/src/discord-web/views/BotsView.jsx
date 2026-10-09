import React, { useState } from 'react';
import {
  Plus,
  Search,
  Bot,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Filter,
  CheckCircle2
} from 'lucide-react';

export default function BotsView({ bots = [], onNavigate, onReload }) {
  const [search, setSearch] = useState('');

  const filteredBots = bots.filter((b) => {
    if (!search.trim()) return true;
    return b.name.toLowerCase().includes(search.toLowerCase().trim());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        <div>
          <button
            onClick={() => onNavigate('/discord')}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Console Overview</span>
            <span className="text-[#BDC1C6]">/</span>
            <span className="text-[#5F6368]">Bots</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
            My Bots
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Registered worker daemons, gateway latencies, command prefixes, and server assignments.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/bots/new')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add bot</span>
        </button>
      </div>

      {/* 2. Google Cloud Table Container */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden shadow-2xs">
        {/* Table Filter Toolbar */}
        <div className="flex items-center justify-between border-b border-[#DADCE0] px-4 py-2.5 bg-[#FFFFFF]">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter bots by name or ID..."
              className="w-full text-[13px] text-[#202124] placeholder-[#5F6368] bg-transparent focus:outline-none"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[12px] text-[#1A73E8] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[750px]">
            <thead>
              <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-4">Bot Resource</th>
                <th className="py-3 px-4">Prefix</th>
                <th className="py-3 px-4">Gateway Status</th>
                <th className="py-3 px-4">Connected Servers</th>
                <th className="py-3 px-4">Throughput Today</th>
                <th className="py-3 px-4 text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {filteredBots.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#5F6368]">
                    <Bot className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
                    <p className="font-medium text-[#202124]">No bots match your filter</p>
                    <button
                      onClick={() => onNavigate('/discord/bots/new')}
                      className="mt-2 text-[#1A73E8] hover:underline font-medium cursor-pointer"
                    >
                      Provision a new bot
                    </button>
                  </td>
                </tr>
              ) : (
                filteredBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-[#F8F9FA] transition-colors">
                    {/* Bot Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div>
                          <button
                            onClick={() => onNavigate(`/discord/bots/${bot.id}`)}
                            className="font-medium text-[#1A73E8] hover:underline text-left leading-tight cursor-pointer"
                          >
                            {bot.name}
                          </button>
                          <div className="text-[11px] text-[#5F6368] mt-0.5 max-w-xs truncate">
                            {bot.description || 'Configured via Tiwlo Cloud'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Prefix */}
                    <td className="py-3.5 px-4 font-mono font-bold text-[#3C4043]">
                      {bot.prefix || '!'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                        <span>{bot.status || 'Online'}</span>
                      </span>
                    </td>

                    {/* Servers */}
                    <td className="py-3.5 px-4 text-[#3C4043]">
                      {(bot.servers || []).length || 1} servers
                    </td>

                    {/* Throughput */}
                    <td className="py-3.5 px-4 text-[#5F6368] text-[12px]">
                      {(bot.commandsRun || 142).toLocaleString()} commands
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right pr-6">
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
    </div>
  );
}

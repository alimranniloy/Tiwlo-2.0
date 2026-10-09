import React, { useState } from 'react';
import { Plus, Search, Box, ArrowRight, ArrowLeft } from 'lucide-react';

export default function BotsView({ bots = [], onNavigate, onReload }) {
  const [search, setSearch] = useState('');

  const filteredBots = bots.filter((b) => {
    if (!search.trim()) return true;
    return b.name.toLowerCase().includes(search.toLowerCase().trim());
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate('/discord')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#0F172A] transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace Overview</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            My Bots
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your registered bots, status, command prefixes, and server assignments.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/bots/new')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add bot</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bots by name..."
          className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      {/* Bots Table / Card List */}
      {filteredBots.length > 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-gray-500 font-medium text-xs bg-[#FAFAFA]">
                  <th className="py-3 px-5">Bot</th>
                  <th className="py-3 px-5">Prefix</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Servers</th>
                  <th className="py-3 px-5">Commands Today</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                          <Box className="w-4 h-4 stroke-[1.8]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F172A]">{bot.name}</p>
                          {bot.description && (
                            <p className="text-xs text-gray-400 truncate max-w-xs">{bot.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-mono text-gray-700 font-bold">
                      {bot.prefix || '!'}
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
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center shadow-xs">
          <p className="text-gray-500 text-sm mb-4">No bots found matching your search.</p>
          <button
            onClick={() => onNavigate('/discord/bots/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add new bot</span>
          </button>
        </div>
      )}
    </div>
  );
}

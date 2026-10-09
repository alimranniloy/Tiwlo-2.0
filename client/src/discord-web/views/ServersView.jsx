import React, { useState } from 'react';
import { Plus, Search, Server, ArrowRight, ArrowLeft, Box } from 'lucide-react';

export default function ServersView({ servers = [], onNavigate, onReload }) {
  const [search, setSearch] = useState('');

  const filteredServers = servers.filter((s) => {
    if (!search.trim()) return true;
    return s.name.toLowerCase().includes(search.toLowerCase().trim());
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
            Connected Servers
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage linked Discord servers, bot assignments, and community automations.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/servers/new')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Connect server</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers..."
          className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      {/* Servers Grid */}
      {filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 font-bold text-base flex items-center justify-center shrink-0">
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

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Assigned Bots
                  </span>
                  {(server.bots || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {server.bots.map((b) => (
                        <div key={b.id || b.name} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg">
                          <Box className="w-3.5 h-3.5 text-gray-500" />
                          <span>{b.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No bots assigned yet</p>
                  )}
                </div>
              </div>

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
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center shadow-xs">
          <p className="text-gray-500 text-sm mb-4">No servers found matching your search.</p>
          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Connect a server</span>
          </button>
        </div>
      )}
    </div>
  );
}

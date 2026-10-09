import React, { useState } from 'react';
import { Plus, Search, Server, ArrowRight, ArrowLeft, Bot, Filter } from 'lucide-react';

export default function ServersView({ servers = [], onNavigate, onReload }) {
  const [search, setSearch] = useState('');

  const filteredServers = servers.filter((s) => {
    if (!search.trim()) return true;
    return s.name.toLowerCase().includes(search.toLowerCase().trim());
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
            <span className="text-[#444746]">Servers</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
            Connected Servers
          </h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Linked Discord guild environments, assigned bot workers, and server-specific configurations.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/servers/new')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Connect server</span>
        </button>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-4 flex items-center justify-between shadow-none">
        <div className="flex items-center gap-2.5 flex-1 max-w-md bg-[#F0F4F9] rounded-full px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-[#0B57D0] transition-all">
          <Search className="w-4 h-4 text-[#747775] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter connected servers..."
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

      {/* 3. Servers Grid (Google Material 3 Card Style) */}
      {filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              onClick={() => onNavigate(`/discord/servers/${server.id}`)}
              className="bg-white border border-[#E0E2EC] hover:border-[#0B57D0] rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer group"
            >
              <div>
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#C2E7FF] text-[#001D35] font-semibold text-base flex items-center justify-center shrink-0">
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium text-[#1F1F1F] truncate group-hover:text-[#0B57D0] transition-colors">
                      {server.name}
                    </h3>
                    <p className="text-[12px] text-[#747775]">
                      {(Number(server.memberCount) || 0).toLocaleString()} members • {server.region || 'Global'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[#F0F4F9]">
                  <div className="text-[11px] font-medium text-[#747775] uppercase tracking-wider mb-2.5">
                    Active bots
                  </div>
                  {(server.bots || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {server.bots.map((b) => (
                        <span
                          key={b.id || b.name}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#F0F4F9] text-[#1F1F1F]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                          {b.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#747775] italic">No bot assigned</p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#F0F4F9] flex items-center justify-between text-[12px] font-medium text-[#0B57D0]">
                <span>Server settings & automations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center shadow-none">
          <Server className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
          <h3 className="text-base font-medium text-[#1F1F1F]">No servers match your search</h3>
          <p className="text-[13px] text-[#747775] mt-1">Connect your Discord community server to begin automation.</p>
          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="mt-4 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
          >
            Connect server
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Plus, Search, Server, ArrowRight, ArrowLeft, Bot, Filter } from 'lucide-react';

export default function ServersView({ servers = [], onNavigate, onReload }) {
  const [search, setSearch] = useState('');

  const filteredServers = servers.filter((s) => {
    if (!search.trim()) return true;
    return s.name.toLowerCase().includes(search.toLowerCase().trim());
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
            <span className="text-[#5F6368]">Servers</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
            Connected Servers
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Linked Discord guild environments, assigned bot workers, and server-specific configurations.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/discord/servers/new')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Connect server</span>
        </button>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter connected servers..."
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

      {/* 3. Servers Grid (Google Cloud Card Style) */}
      {filteredServers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServers.map((server) => (
            <div
              key={server.id}
              onClick={() => onNavigate(`/discord/servers/${server.id}`)}
              className="bg-white border border-[#DADCE0] hover:border-[#1A73E8] rounded-lg p-5 flex flex-col justify-between transition-all hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3)] cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] font-medium text-base flex items-center justify-center shrink-0">
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium text-[#202124] truncate">
                      {server.name}
                    </h3>
                    <p className="text-[12px] text-[#5F6368]">
                      {(Number(server.memberCount) || 0).toLocaleString()} members • {server.region || 'Global'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F3F4]">
                  <div className="text-[11px] font-medium text-[#5F6368] uppercase tracking-wider mb-2">
                    Active bots
                  </div>
                  {(server.bots || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
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
                    <p className="text-[12px] text-[#5F6368] italic">No bot assigned</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F1F3F4] flex items-center justify-between text-[12px] font-medium text-[#1A73E8]">
                <span>Server settings & automations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center">
          <Server className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
          <h3 className="text-base font-medium text-[#202124]">No servers match your search</h3>
          <p className="text-[13px] text-[#5F6368] mt-1">Connect your Discord community server to begin automation.</p>
          <button
            onClick={() => onNavigate('/discord/servers/new')}
            className="mt-4 px-4 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors"
          >
            Connect server
          </button>
        </div>
      )}
    </div>
  );
}

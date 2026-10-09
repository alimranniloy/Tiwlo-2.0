import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MessageSquare, BarChart2, RotateCw, Filter, CheckCircle2 } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function ActivityView({ onNavigate }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await DiscordAPI.getActivities(50);
      setActivities(data || []);
    } catch (e) {
      console.warn('Could not load activities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const filtered = activities.filter((act) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (act.title || act.action || '').toLowerCase().includes(q) ||
      (act.description || act.serverName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
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
            <span className="text-[#5F6368]">Activity logs</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
            Activity & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Historical audit stream of bot daemon actions, server links, and command triggers.
          </p>
        </div>

        <button
          onClick={loadActivities}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Google Cloud Log Container */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#DADCE0] px-4 py-2.5 bg-[#FFFFFF]">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter audit logs by keyword or action..."
              className="w-full text-[13px] text-[#202124] placeholder-[#5F6368] bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5">Activity Event</th>
                <th className="py-3 px-5">Context / Details</th>
                <th className="py-3 px-5 text-right pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#5F6368]">
                    <RotateCw className="w-5 h-5 text-[#1A73E8] animate-spin mx-auto mb-2" />
                    <span>Loading activity log entries...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#5F6368]">
                    No activity records found.
                  </td>
                </tr>
              ) : (
                filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[12px] text-[#5F6368] whitespace-nowrap">
                      {act.createdAt ? new Date(act.createdAt).toLocaleString() : 'Just now'}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#202124]">
                      {act.title || act.action}
                    </td>
                    <td className="py-3.5 px-5 text-[#3C4043] text-[12px]">
                      {act.description || act.serverName || 'System event'}
                    </td>
                    <td className="py-3.5 px-5 text-right pr-6">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 fill-[#137333] text-white" />
                        <span>Completed</span>
                      </span>
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

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MessageSquare, BarChart2, RotateCw, Filter, CheckCircle2, Search } from 'lucide-react';
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
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans bg-white">
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
            <span className="text-[#444746]">Activity logs</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
            Activity & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Historical audit stream of bot daemon actions, server links, and command triggers.
          </p>
        </div>

        <button
          onClick={loadActivities}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Modern Google Material 3 Log Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b border-[#E0E2EC] px-5 py-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-2.5 flex-1 max-w-md bg-[#F0F4F9] rounded-full px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-[#0B57D0] transition-all">
            <Search className="w-4 h-4 text-[#747775] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter audit logs by keyword or action..."
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F0F4F9]/60 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Activity Event</th>
                <th className="py-3 px-6">Context / Details</th>
                <th className="py-3 px-6 text-right pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#747775]">
                    <RotateCw className="w-5 h-5 text-[#0B57D0] animate-spin mx-auto mb-2" />
                    <span>Loading activity log entries...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#747775]">
                    No activity records found.
                  </td>
                </tr>
              ) : (
                filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-[#F0F4F9]/40 transition-colors">
                    <td className="py-3.5 px-6 font-mono text-[12px] text-[#747775] whitespace-nowrap">
                      {act.createdAt ? new Date(act.createdAt).toLocaleString() : 'Just now'}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-[#1F1F1F]">
                      {act.title || act.action}
                    </td>
                    <td className="py-3.5 px-6 text-[#444746] text-[12px]">
                      {act.description || act.serverName || 'System event'}
                    </td>
                    <td className="py-3.5 px-6 text-right pr-6">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#C4EED0] text-[#072711]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
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

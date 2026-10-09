import React, { useState, useEffect } from 'react';
import { ArrowLeft, Ticket, CheckCircle2, RotateCw, Filter, Search } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function TicketsView({ onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    async function loadTickets() {
      setLoading(true);
      try {
        const data = await DiscordAPI.getTickets();
        setTickets(data || []);
      } catch (e) {
        console.warn('Could not load tickets:', e);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  const filtered = tickets.filter((t) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      (t.subject || '').toLowerCase().includes(q) ||
      (t.channelName || '').toLowerCase().includes(q) ||
      (t.authorName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Tickets</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Support Tickets & Inquiries
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Review community member help requests, private escalation threads, and automated ticket resolutions.
        </p>
      </div>

      {/* 2. Modern Google Material 3 Table Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[#E0E2EC] px-5 py-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-2.5 flex-1 max-w-md bg-[#F0F4F9] rounded-full px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-[#0B57D0] transition-all">
            <Search className="w-4 h-4 text-[#747775] shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter tickets by subject, author or channel..."
              className="w-full text-[13px] text-[#1F1F1F] placeholder-[#747775] bg-transparent focus:outline-none"
            />
          </div>
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="text-[12px] text-[#0B57D0] hover:underline cursor-pointer ml-3 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tickets List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F0F4F9]/60 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Subject</th>
                <th className="py-3 px-6">Channel</th>
                <th className="py-3 px-6">Author</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right pr-6">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#747775]">
                    <RotateCw className="w-5 h-5 text-[#0B57D0] animate-spin mx-auto mb-2" />
                    <span>Loading tickets...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#747775]">
                    <Ticket className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
                    <p className="font-medium text-[#1F1F1F]">No open support tickets</p>
                    <p className="text-[12px] text-[#747775] mt-0.5">Tickets created by members in Discord will appear here in real-time.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F0F4F9]/40 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-[#1F1F1F]">
                      {t.subject}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[12px] text-[#444746]">
                      {t.channelName}
                    </td>
                    <td className="py-3.5 px-6 text-[#747775]">
                      {t.authorName}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#072711] bg-[#C4EED0] px-3 py-1 rounded-full capitalize">
                        {t.status || 'Open'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-[#747775] text-[12px] text-right pr-6">
                      {t.createdAt || 'Recent'}
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

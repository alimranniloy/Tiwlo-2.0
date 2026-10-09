import React, { useState, useEffect } from 'react';
import { ArrowLeft, Ticket, CheckCircle2, RotateCw, Filter } from 'lucide-react';
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
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Tickets</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Support Tickets & Inquiries
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Review community member help requests, private escalation threads, and automated ticket resolutions.
        </p>
      </div>

      {/* 2. Google Cloud Table Container */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden shadow-2xs">
        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[#DADCE0] px-4 py-2.5 bg-[#FFFFFF]">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter tickets by subject, author or channel..."
              className="w-full text-[13px] text-[#202124] placeholder-[#5F6368] bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Tickets List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-5">Subject</th>
                <th className="py-3 px-5">Channel</th>
                <th className="py-3 px-5">Author</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right pr-6">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#5F6368]">
                    <RotateCw className="w-5 h-5 text-[#1A73E8] animate-spin mx-auto mb-2" />
                    <span>Loading tickets...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-[#5F6368]">
                    <Ticket className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
                    <p className="font-medium text-[#202124]">No open support tickets</p>
                    <p className="text-[12px] text-[#5F6368] mt-0.5">Tickets created by members in Discord will appear here in real-time.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-[#202124]">
                      {t.subject}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[12px] text-[#3C4043]">
                      {t.channelName}
                    </td>
                    <td className="py-3.5 px-5 text-[#5F6368]">
                      {t.authorName}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-2 py-0.5 rounded-full capitalize">
                        {t.status || 'Open'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#5F6368] text-[12px] text-right pr-6">
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

import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Package,
  Clock,
  RotateCw,
  CheckCircle2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

export default function TicketsView({
  onBack,
  onCreateTicket,
  onSelectTicket
}) {
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'Open' | 'In Progress' | 'Resolved'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real tickets from the backend database
  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/support/tickets');
      if (res.ok) {
        const data = await res.json();
        if (data?.tickets) {
          setTickets(data.tickets);
        }
      }
    } catch (err) {
      console.warn('Failed to load tickets from server, using cached data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'Open').length;
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Open':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            Open
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            In Progress
          </span>
        );
      case 'Resolved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Navigation Bar (Full Width) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200/80 dark:border-gray-700 shadow-2xs cursor-pointer group"
            title="Back to Help & Support"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Tickets
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              View and manage your support tickets
            </p>
          </div>
        </div>

        <button
          onClick={onCreateTicket}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs hover:shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* 4 Stat Summary Pill Cards matching screenshot View 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'ALL'
              ? 'bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-600 shadow-xs'
              : 'bg-white dark:bg-gray-800/60 border-slate-200/70 dark:border-gray-700/70 hover:bg-slate-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Tickets</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalCount}
          </p>
        </div>

        {/* Open */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'Open' ? 'ALL' : 'Open')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'Open'
              ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 shadow-xs'
              : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 hover:bg-amber-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Open</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-800 dark:text-amber-200">
            {openCount}
          </p>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'In Progress' ? 'ALL' : 'In Progress')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'In Progress'
              ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-xs'
              : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 hover:bg-blue-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">In Progress</span>
            <RotateCw className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-800 dark:text-blue-200">
            {inProgressCount}
          </p>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'Resolved' ? 'ALL' : 'Resolved')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === 'Resolved'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 shadow-xs'
              : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-200">
            {resolvedCount}
          </p>
        </div>
      </div>

      {/* Tickets List Table matching screenshot View 2 (Full Width) */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700/60 bg-slate-50/60 dark:bg-gray-800 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-6 font-semibold w-32">#</th>
                <th className="py-3 px-6 font-semibold">Subject</th>
                <th className="py-3 px-6 font-semibold w-36">Status</th>
                <th className="py-3 px-6 font-semibold text-right w-44">
                  <span className="inline-flex items-center gap-1">
                    Last Updated <ChevronDown className="w-3 h-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/60 text-xs">
              {filteredTickets.map((ticket) => {
                const serial = ticket.serialNumber || (ticket.id?.startsWith('#') ? ticket.id : `#${ticket.id}`);
                return (
                  <tr
                    key={ticket.id || ticket.ticketId}
                    onClick={() => onSelectTicket ? onSelectTicket(ticket) : null}
                    className="hover:bg-slate-50/80 dark:hover:bg-gray-700/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-4.5 px-6 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {serial}
                    </td>
                    <td className="py-4.5 px-6 min-w-[280px]">
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {ticket.subject}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-lg mt-0.5">
                        {ticket.snippet || ticket.description}
                      </div>
                    </td>
                    <td className="py-4.5 px-6 whitespace-nowrap">
                      {getStatusBadge(ticket.status)}
                    </td>
                    <td className="py-4.5 px-6 text-right whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span>{ticket.lastUpdated}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-blue-500 transition" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="text-center py-12 text-slate-400 text-xs">
              Loading real tickets from database...
            </div>
          )}

          {!loading && filteredTickets.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              No tickets found. Click "+ Create Ticket" to submit your first ticket.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

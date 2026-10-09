import React, { useState, useEffect } from 'react';
import { ArrowLeft, Ticket, Plus, CheckCircle2, Clock } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function TicketsView({ onNavigate }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#0F172A] transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Workspace Overview</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Support Tickets
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Community member inquiries, channel support threads, and escalation tickets.
        </p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs">
        {tickets.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {tickets.map((t) => (
              <div key={t.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0F172A]">{t.subject}</h4>
                    <p className="text-xs text-gray-500">
                      Channel: <span className="font-mono text-gray-700">{t.channelName}</span> • By {t.authorName}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 capitalize">
                  {t.status || 'Open'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-gray-400">
            <Ticket className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <h3 className="text-base font-bold text-gray-700">No active tickets</h3>
            <p className="text-xs text-gray-400 mt-1">When members use the `/ticket` command in Discord, threads appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

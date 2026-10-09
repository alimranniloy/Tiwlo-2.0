import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, MessageSquare, BarChart2 } from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function ActivityView({ onNavigate }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      setLoading(true);
      try {
        const data = await DiscordAPI.getActivities(50);
        setActivities(data || []);
      } catch (e) {
        console.warn('Could not load activities:', e);
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
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
          Activity Audit Log
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Historical log of bot actions, server connections, command invocations, and configurations.
        </p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs divide-y divide-gray-100">
        {activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F172A]">{act.title}</p>
                {act.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>
                )}
                <span className="text-[11px] text-gray-400 mt-1.5 block">
                  {new Date(act.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <h3 className="text-base font-bold text-gray-700">No activity logged yet</h3>
            <p className="text-xs text-gray-400 mt-1">Audit events will be logged as bots execute actions in your community.</p>
          </div>
        )}
      </div>
    </div>
  );
}

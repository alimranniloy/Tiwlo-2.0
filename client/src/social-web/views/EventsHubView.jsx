import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Check, Plus, ExternalLink, ArrowLeft } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function EventsHubView() {
  const { navigateTo, showToast } = useSocial();
  const [events, setEvents] = useState([]);
  const [rsvpMap, setRsvpMap] = useState({});

  useEffect(() => {
    TiwiSocialAPI.getEvents().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setEvents(data);
      } else {
        setEvents([
          {
            id: 'ev_1',
            title: 'Tiwi Global Developer Summit 2026',
            date: 'Tomorrow, 6:00 PM UTC',
            location: 'Virtual Live Stream & Audio Space',
            attendeesCount: 342,
            coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=500&h=250&fit=crop'
          },
          {
            id: 'ev_2',
            title: 'Design Systems & Modern Typography Meetup',
            date: 'Friday, 8:00 PM UTC',
            location: 'Live Audio Stage #2',
            attendeesCount: 188,
            coverImage: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=500&h=250&fit=crop'
          }
        ]);
      }
    });
  }, []);

  const handleToggleRsvp = (id) => {
    const next = !rsvpMap[id];
    setRsvpMap((prev) => ({ ...prev, [id]: next }));
    showToast(next ? 'RSVP confirmed! Added to your schedule.' : 'RSVP cancelled', 'info');
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full pb-20">
      {/* 1. Header */}
      <div className="bg-white dark:bg-[#16161f] p-4 sm:p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-2 tracking-tight">
              <Calendar className="w-5 h-5 text-violet-500" />
              <span>Events Hub</span>
            </h1>
            <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              Discover virtual conferences, live workshops, and community stages
            </p>
          </div>
        </div>
      </div>

      {/* 2. Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev) => {
          const isAttending = rsvpMap[ev.id];
          return (
            <div
              key={ev.id}
              className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md dark:hover:shadow-black/30 transition-all duration-200 group"
            >
              <div className="h-40 w-full relative overflow-hidden bg-violet-500/10">
                <img
                  src={ev.coverImage}
                  alt={ev.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 block mb-1">
                    {ev.date}
                  </span>
                  <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {ev.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#65676b] dark:text-[#8a8d91] mt-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{ev.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-black/[0.04] dark:border-white/[0.05]">
                  <span className="text-xs font-medium text-[#65676b] dark:text-[#8a8d91]">
                    {ev.attendeesCount + (isAttending ? 1 : 0)} attending
                  </span>
                  <button
                    onClick={() => handleToggleRsvp(ev.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                      isAttending
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/20'
                    }`}
                  >
                    {isAttending ? '✓ Attending' : 'RSVP Now'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Check, Plus, ExternalLink } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function EventsHubView() {
  const { showToast } = useSocial();
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
    showToast(next ? 'RSVP confirmed! Added to your calendar.' : 'RSVP cancelled', 'info');
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#0B57D0]" />
            Events Hub
          </h2>
          <p className="text-xs text-gray-500">Discover virtual conferences, live workshops, and community stages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev) => {
          const isAttending = rsvpMap[ev.id];
          return (
            <div key={ev.id} className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-sm transition-all">
              <div className="h-36 w-full relative overflow-hidden bg-gray-100">
                <img src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-[#0B57D0] block mb-1">{ev.date}</span>
                  <h3 className="font-bold text-sm sm:text-base text-[#1F1F1F] dark:text-white leading-snug">{ev.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{ev.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-400">
                    {ev.attendeesCount + (isAttending ? 1 : 0)} attending
                  </span>
                  <button
                    onClick={() => handleToggleRsvp(ev.id)}
                    className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                      isAttending
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-[#0B57D0] text-white hover:bg-[#0842A0]'
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

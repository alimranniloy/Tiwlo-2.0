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
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#202124] p-5 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1a73e8]" />
            Events Hub
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">Discover virtual conferences, live workshops, and community stages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {events.map((ev) => {
          const isAttending = rsvpMap[ev.id];
          return (
            <div key={ev.id} className="bg-white dark:bg-[#202124] rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-sm transition-all">
              <div className="h-36 w-full relative overflow-hidden bg-gray-100">
                <img src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-[#1a73e8] block mb-1">{ev.date}</span>
                  <h3 className="font-bold text-sm sm:text-base text-[#202124] dark:text-[#e8eaed] leading-snug">{ev.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2">
                    <MapPin className="w-3.5 h-3.5 text-[#5f6368] dark:text-[#9aa0a6]" />
                    <span>{ev.location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#dadce0]/60 dark:border-[#3c4043]">
                  <span className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
                    {ev.attendeesCount + (isAttending ? 1 : 0)} attending
                  </span>
                  <button
                    onClick={() => handleToggleRsvp(ev.id)}
                    className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isAttending
                        ? 'bg-[#e6f4ea] text-[#137333] dark:bg-[#137333]/30 dark:text-[#81c995]'
                        : 'bg-[#1a73e8] text-white hover:bg-[#1557b0]'
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

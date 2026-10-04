import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Check,
  Plus,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Gift,
  Clock,
  Share2
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function EventsHubView() {
  const { navigateTo, showToast } = useSocial();
  const [events, setEvents] = useState([
    {
      id: 'ev_prada',
      title: "Prada's Invitation Birthday",
      category: 'Celebration',
      date: 'This Saturday, 7:00 PM',
      location: 'The Grand Lounge & Rooftop Garden',
      attendeesCount: 48,
      coverImage: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&h=300&fit=crop',
      isInvite: true
    },
    {
      id: 'ev_1',
      title: 'Tiwi Global Developer Summit 2026',
      category: 'Tech & Keynote',
      date: 'Tomorrow, 6:00 PM UTC',
      location: 'Virtual Live Stream & Audio Space',
      attendeesCount: 342,
      coverImage: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=300&fit=crop',
      isInvite: false
    },
    {
      id: 'ev_2',
      title: 'Design Systems & Modern Typography Meetup',
      category: 'Design Workshop',
      date: 'Friday, 8:00 PM UTC',
      location: 'Live Audio Stage #2',
      attendeesCount: 188,
      coverImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&h=300&fit=crop',
      isInvite: false
    },
    {
      id: 'ev_3',
      title: 'PostgreSQL High-Concurrency Scaling Webinar',
      category: 'Architecture',
      date: 'Next Tuesday, 5:00 PM UTC',
      location: 'Tiwi Developer Stage',
      attendeesCount: 520,
      coverImage: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&h=300&fit=crop',
      isInvite: false
    }
  ]);
  const [rsvpMap, setRsvpMap] = useState({});

  const handleToggleRsvp = (id, title) => {
    const next = !rsvpMap[id];
    setRsvpMap((prev) => ({ ...prev, [id]: next }));
    showToast(next ? `RSVP confirmed for "${title}"!` : `RSVP cancelled`, 'info');
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Events Hub
              <span className="text-[12px] font-semibold bg-[#1E75FF]/10 text-[#1E75FF] px-2.5 py-0.5 rounded-full">
                10 Events Invites
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
              Discover meetups, private invitations, live keynotes, and community celebrations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => showToast('Create Event dialog opened', 'info')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12.5px] font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* 2. Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {events.map((ev) => {
          const isAttending = rsvpMap[ev.id];
          return (
            <div
              key={ev.id}
              className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:shadow-md transition group"
            >
              <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <img
                  src={ev.coverImage}
                  alt={ev.title}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {ev.category}
                </span>
                {ev.isInvite && (
                  <span className="absolute top-3 right-3 bg-[#1E75FF] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Gift className="w-3 h-3" />
                    <span>Personal Invite</span>
                  </span>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1E75FF] mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{ev.date}</span>
                  </div>

                  <h3 className="font-bold text-[16px] text-[#111827] dark:text-white leading-snug group-hover:text-[#1E75FF] transition-colors">
                    {ev.title}
                  </h3>

                  <p className="text-[12.5px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{ev.location}</span>
                  </p>
                </div>

                <div className="pt-4 border-t border-[#F2F4F7] dark:border-[#1E232F] flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                    {ev.attendeesCount} people going
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleRsvp(ev.id, ev.title)}
                    className={`px-4 py-1.5 rounded-xl text-[12.5px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isAttending
                        ? 'bg-[#10B981] text-white'
                        : 'bg-[#1E75FF] hover:bg-[#1A66E5] text-white'
                    }`}
                  >
                    {isAttending ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Going</span>
                      </>
                    ) : (
                      <span>Join / RSVP</span>
                    )}
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

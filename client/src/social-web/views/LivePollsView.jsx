import React, { useState, useEffect } from 'react';
import { Vote, Plus, CheckCircle2, ArrowLeft, BarChart2 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function LivePollsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [polls, setPolls] = useState([]);
  const [votedMap, setVotedMap] = useState({});

  useEffect(() => {
    TiwiSocialAPI.getPolls().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setPolls(data);
      } else {
        setPolls([
          {
            id: 'poll_1',
            question: 'Which design aesthetic feels most premium for productivity and social platforms?',
            options: [
              { text: 'Ultra-Modern Minimalist with Violet/Fuchsia Accents', votes: 142 },
              { text: 'Glassmorphism & Depth Elevation', votes: 68 },
              { text: 'High Contrast Dark Slate Monolith', votes: 34 },
            ],
            totalVotes: 244
          },
          {
            id: 'poll_2',
            question: 'What is your preferred database strategy for real-time web applications?',
            options: [
              { text: 'PostgreSQL with relational schemas & migrations', votes: 120 },
              { text: 'Supabase / Firebase managed real-time', votes: 56 },
              { text: 'Self-hosted SQLite / LibSQL', votes: 20 },
            ],
            totalVotes: 196
          }
        ]);
      }
    });
  }, []);

  const handleVote = async (pollId, optIdx) => {
    if (votedMap[pollId] !== undefined) return;
    setVotedMap((prev) => ({ ...prev, [pollId]: optIdx }));
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        const newOpts = [...p.options];
        newOpts[optIdx].votes += 1;
        return { ...p, options: newOpts, totalVotes: (p.totalVotes || 0) + 1 };
      })
    );
    try {
      await TiwiSocialAPI.votePoll(pollId, optIdx, currentUser?.id);
      showToast('Vote recorded!', 'info');
    } catch (e) {}
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full pb-20">
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
              <Vote className="w-5 h-5 text-violet-500" />
              <span>Live Community Polls</span>
            </h1>
            <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              Vote and see live real-time opinions from the network
            </p>
          </div>
        </div>
      </div>

      {/* 2. Polls List */}
      <div className="flex flex-col gap-3">
        {polls.map((p) => {
          const hasVoted = votedMap[p.id] !== undefined;
          return (
            <div
              key={p.id}
              className="bg-white dark:bg-[#16161f] p-5 sm:p-6 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex flex-col gap-4"
            >
              <h3 className="font-bold text-[15px] sm:text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] leading-snug">
                {p.question}
              </h3>

              <div className="flex flex-col gap-2.5">
                {p.options.map((opt, i) => {
                  const pct = p.totalVotes > 0 ? Math.round((opt.votes / p.totalVotes) * 100) : 0;
                  const isSelected = votedMap[p.id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleVote(p.id, i)}
                      disabled={hasVoted}
                      className={`relative w-full p-3.5 rounded-xl text-left border transition-all overflow-hidden cursor-pointer ${
                        isSelected
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      {hasVoted && (
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-violet-500/15 dark:bg-violet-500/20 transition-all duration-500 rounded-l-xl"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between z-10 text-[13px]">
                        <span className="font-semibold text-[#1c1e21] dark:text-[#e4e6eb] flex items-center gap-1.5">
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-violet-600 inline" />}
                          {opt.text}
                        </span>
                        {hasVoted && <span className="font-bold text-violet-600 dark:text-violet-400">{pct}%</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-[12px] text-[#65676b] dark:text-[#8a8d91] flex items-center justify-between pt-1">
                <span>{p.totalVotes || 0} total votes</span>
                {hasVoted && <span className="text-violet-600 dark:text-violet-400 font-semibold">Your vote is counted</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

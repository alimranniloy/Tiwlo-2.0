import React, { useState, useEffect } from 'react';
import { Vote, Plus, CheckCircle2 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function LivePollsView() {
  const { currentUser, showToast } = useSocial();
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
            question: 'Which design aesthetic feels most premium for productivity apps?',
            options: [
              { text: 'Google Material 3 / Clean Minimalist', votes: 142 },
              { text: 'Apple macOS Glassmorphism', votes: 68 },
              { text: 'High Contrast Dark Slate', votes: 34 },
            ],
            totalVotes: 244
          },
          {
            id: 'poll_2',
            question: 'What is your preferred state management in React 19?',
            options: [
              { text: 'React Context + Native Hooks', votes: 98 },
              { text: 'Zustand / Jotai', votes: 76 },
              { text: 'Redux Toolkit', votes: 22 },
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
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Vote className="w-5 h-5 text-[#0B57D0]" />
            Live Community Polls
          </h2>
          <p className="text-xs text-gray-500">Vote and see real-time community opinions</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {polls.map((p) => {
          const hasVoted = votedMap[p.id] !== undefined;
          return (
            <div key={p.id} className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-4">
              <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white leading-snug">{p.question}</h3>

              <div className="flex flex-col gap-2.5">
                {p.options.map((opt, i) => {
                  const pct = p.totalVotes > 0 ? Math.round((opt.votes / p.totalVotes) * 100) : 0;
                  const isSelected = votedMap[p.id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleVote(p.id, i)}
                      disabled={hasVoted}
                      className={`relative w-full p-3 rounded-2xl text-left border transition-all overflow-hidden ${
                        isSelected
                          ? 'border-[#0B57D0] bg-[#E8F0FE]/40 dark:bg-blue-950/30'
                          : 'border-gray-200/70 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#111827]'
                      }`}
                    >
                      {hasVoted && (
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-[#0B57D0]/10 dark:bg-[#0B57D0]/20 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between z-10 text-xs">
                        <span className="font-semibold text-[#1F1F1F] dark:text-gray-200">{opt.text}</span>
                        {hasVoted && <span className="font-bold text-[#0B57D0]">{pct}%</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-gray-400">
                {p.totalVotes || 0} total votes {hasVoted && '• Your vote has been counted'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, RotateCcw, ArrowLeft, Sparkles } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function LiveTriviaView() {
  const { navigateTo, showToast } = useSocial();
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    TiwiSocialAPI.getTriviaQuestions().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setQuestions(data);
      } else {
        setQuestions([
          {
            question: 'What is the primary architectural principle of modern clean UI design?',
            options: ['Heavy 3D shadows and cluttered layouts', 'Generous whitespace, clear hierarchy & restrained surfaces', 'Aggressive popups and floating overlays'],
            correct: 1
          },
          {
            question: 'Which PostgreSQL capability ensures reliable, atomic state operations?',
            options: ['ACID compliance with write-ahead logs (WAL)', 'Unstructured in-memory JSON mock persistence', 'Client-side ephemeral storage'],
            correct: 0
          },
          {
            question: 'What does WebRTC fundamentally enable on the modern web?',
            options: ['Static image sprite rendering', 'Direct peer-to-peer real-time audio and video streaming', 'Server-side Cron scheduling'],
            correct: 1
          }
        ]);
      }
    });
  }, []);

  const handleSelect = (idx) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    const q = questions[currentIdx];
    if (idx === q.correct) {
      setScore((prev) => prev + 10);
      showToast('+10 Points! Correct answer.', 'info');
    } else {
      showToast('Incorrect answer', 'error');
    }

    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
        setSelectedAnswer(null);
      } else {
        setQuizFinished(true);
      }
    }, 1200);
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setScore(0);
    setQuizFinished(false);
  };

  const q = questions[currentIdx];

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full pb-20">
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
              <Award className="w-5 h-5 text-violet-500" />
              <span>Live Community Trivia</span>
            </h1>
            <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">Test your tech knowledge and earn Tiwi badges</p>
          </div>
        </div>
        <div className="bg-violet-500/10 text-violet-600 dark:text-violet-400 px-3.5 py-1.5 rounded-full text-xs font-bold">
          Score: {score}
        </div>
      </div>

      {/* 2. Trivia Card */}
      <div className="bg-white dark:bg-[#16161f] p-6 sm:p-8 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm flex flex-col gap-5">
        {!quizFinished && q ? (
          <>
            <div className="flex items-center justify-between text-xs text-[#65676b] dark:text-[#8a8d91]">
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <span className="font-semibold text-violet-600 dark:text-violet-400">10 Points</span>
            </div>

            <h3 className="text-base sm:text-[17px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-relaxed">
              {q.question}
            </h3>

            <div className="flex flex-col gap-2.5">
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = i === q.correct;
                let btnStyle = 'border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] text-[#1c1e21] dark:text-[#e4e6eb]';
                if (selectedAnswer !== null) {
                  if (isCorrect) btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold';
                  else if (isSelected) btnStyle = 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 rounded-xl text-left border text-xs sm:text-[13.5px] font-medium transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-500" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-8 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#1c1e21] dark:text-[#e4e6eb]">Trivia Challenge Completed!</h3>
            <p className="text-xs text-[#65676b] dark:text-[#8a8d91]">
              You scored <b className="text-violet-600 dark:text-violet-400 font-bold">{score} points</b> across all rounds.
            </p>
            <button
              onClick={handleRestart}
              className="mt-3 flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

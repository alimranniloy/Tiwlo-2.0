import React, { useState, useEffect } from 'react';
import { Award, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function LiveTriviaView() {
  const { showToast } = useSocial();
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
            question: 'What is the primary architectural principle of Google UI design?',
            options: ['Heavy gradients and 3D shadows', 'Clean whitespace, typography hierarchy & minimal elevation', 'Neon color palettes and dark glassmorphism'],
            correct: 1
          },
          {
            question: 'Which PostgreSQL feature ensures atomic transactions and reliability?',
            options: ['ACID compliance with write-ahead logs (WAL)', 'NoSQL schema flexibility', 'Client-side local cache'],
            correct: 0
          },
          {
            question: 'What does WebRTC primarily enable on the web?',
            options: ['Static image compression', 'Peer-to-peer real-time audio and video communications', 'Database query caching'],
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
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#0B57D0]" />
            Live Community Trivia
          </h2>
          <p className="text-xs text-gray-500">Test your tech knowledge and earn Tiwi badges</p>
        </div>
        <div className="bg-[#E8F0FE] text-[#0B57D0] px-3.5 py-1.5 rounded-full text-xs font-bold">
          Score: {score}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] p-6 sm:p-8 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-6">
        {!quizFinished && q ? (
          <>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <span>10 Points</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F] dark:text-white leading-relaxed">
              {q.question}
            </h3>

            <div className="flex flex-col gap-3">
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = i === q.correct;
                let btnStyle = 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#111827]';
                if (selectedAnswer !== null) {
                  if (isCorrect) btnStyle = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold';
                  else if (isSelected) btnStyle = 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-700 dark:text-red-300';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 rounded-2xl text-left border text-xs sm:text-sm font-medium transition-all flex items-center justify-between ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-6 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#1F1F1F] dark:text-white">Trivia Challenge Completed!</h3>
            <p className="text-xs text-gray-500">
              You scored <b className="text-[#0B57D0]">{score} points</b> across all rounds.
            </p>
            <button
              onClick={handleRestart}
              className="mt-4 flex items-center gap-2 bg-[#0B57D0] text-white px-6 py-2.5 rounded-full text-xs font-bold hover:bg-[#0842A0] transition-colors"
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

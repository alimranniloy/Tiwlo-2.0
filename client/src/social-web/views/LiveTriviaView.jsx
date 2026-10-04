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
    <div className="flex flex-col gap-4 max-w-xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#202124] p-5 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#1a73e8]" />
            Live Community Trivia
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">Test your tech knowledge and earn Tiwi badges</p>
        </div>
        <div className="bg-[#e8f0fe] dark:bg-[#174ea6] text-[#1a73e8] dark:text-[#8ab4f8] px-3.5 py-1.5 rounded-full text-xs font-bold">
          Score: {score}
        </div>
      </div>

      <div className="bg-white dark:bg-[#202124] p-6 sm:p-8 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex flex-col gap-5">
        {!quizFinished && q ? (
          <>
            <div className="flex items-center justify-between text-xs text-[#5f6368] dark:text-[#9aa0a6]">
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <span>10 Points</span>
            </div>

            <h3 className="text-base sm:text-[17px] font-bold text-[#202124] dark:text-[#e8eaed] leading-relaxed">
              {q.question}
            </h3>

            <div className="flex flex-col gap-2.5">
              {q.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = i === q.correct;
                let btnStyle = 'border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f8f9fa] dark:hover:bg-[#303134] text-[#202124] dark:text-[#e8eaed]';
                if (selectedAnswer !== null) {
                  if (isCorrect) btnStyle = 'border-[#188038] bg-[#e6f4ea] dark:bg-[#137333]/30 text-[#137333] dark:text-[#81c995] font-bold';
                  else if (isSelected) btnStyle = 'border-[#d93025] bg-[#fce8e6] dark:bg-[#c5221f]/30 text-[#c5221f] dark:text-[#f28b82]';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-3.5 rounded-md text-left border text-xs sm:text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-[#188038]" />}
                    {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-[#d93025]" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#e6f4ea] dark:bg-[#137333]/30 text-[#188038] flex items-center justify-center">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-[#202124] dark:text-[#e8eaed]">Trivia Challenge Completed!</h3>
            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">
              You scored <b className="text-[#1a73e8]">{score} points</b> across all rounds.
            </p>
            <button
              onClick={handleRestart}
              className="mt-3 flex items-center gap-2 bg-[#1a73e8] text-white px-5 py-2.5 rounded-md text-xs font-bold hover:bg-[#1557b0] transition-colors cursor-pointer"
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

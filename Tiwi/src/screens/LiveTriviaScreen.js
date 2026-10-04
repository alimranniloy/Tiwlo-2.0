import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function LiveTriviaScreen({ navigation, onNavigate, user, isDark }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState('lobby'); // 'lobby' | 'playing' | 'completed'
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [triviaStats, setTriviaStats] = useState({ totalGames: 0, bestStreak: 0, totalScore: 0 });

  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerInterval = useRef(null);

  useEffect(() => {
    fetchTriviaData();
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  const fetchTriviaData = async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/social/trivia/active`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
        fetch(`${API_BASE_URL}/api/social/trivia/stats?userId=${user?.id || ''}`, { headers: { 'Accept': 'application/json' } }).catch(() => null),
      ]);

      if (qRes && qRes.ok) {
        const data = await qRes.json();
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      }

      if (sRes && sRes.ok) {
        const sData = await sRes.json();
        if (sData.stats) setTriviaStats(sData.stats);
      }
    } catch {
      // Handled cleanly
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    if (questions.length === 0) return;
    setGameState('playing');
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    startTimer();
  };

  const startTimer = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setTimeLeft(15);
    timerAnim.setValue(1);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: 15000,
      useNativeDriver: false,
    }).start();

    timerInterval.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current);
          handleTimeExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeExpire = () => {
    setIsAnswerRevealed(true);
    setStreak(0);
  };

  const handleSelectOption = (idx) => {
    if (isAnswerRevealed || selectedOption !== null) return;
    if (timerInterval.current) clearInterval(timerInterval.current);

    setSelectedOption(idx);
    setIsAnswerRevealed(true);

    const currentQ = questions[currentIdx];
    const isCorrect = idx === currentQ?.correctIndex;

    if (isCorrect) {
      const earned = 100 + timeLeft * 10;
      setScore((prev) => prev + earned);
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      startTimer();
    } else {
      setGameState('completed');
      if (timerInterval.current) clearInterval(timerInterval.current);
      // Record completed score to API
      if (user?.id) {
        fetch(`${API_BASE_URL}/api/social/trivia/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, score, streak }),
        }).catch(() => {});
      }
    }
  };

  const handleBack = () => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (onNavigate) {
      onNavigate('feed');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const bg = isDark ? COLORS.hex_0B0F19 : COLORS.white;
  const surface = isDark ? COLORS.hex_161D2C : COLORS.white;
  const text = isDark ? COLORS.hex_F1F5F9 : COLORS.hex_1E293B;
  const textMuted = isDark ? COLORS.hex_94A3B8 : COLORS.hex_64748B;
  const border = isDark ? COLORS.hex_2D3748 : COLORS.hex_E2E8F0;
  const primary = COLORS.hex_2563EB;

  const currentQ = questions[currentIdx];

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: text }]}>Live Community Trivia</Text>
          <Text style={[styles.headerSub, { color: textMuted }]}>Compete in verified timed knowledge quizzes</Text>
        </View>
        {gameState === 'playing' ? (
          <View style={[styles.scorePill, { backgroundColor: primary }]}>
            <MaterialCommunityIcons name="star" size={14} color={COLORS.hex_FBBF24} />
            <Text style={styles.scorePillText}>{score} pts</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={[styles.loaderText, { color: textMuted }]}>Connecting to trivia server...</Text>
        </View>
      ) : gameState === 'lobby' ? (
        /* Lobby View */
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.lobbyContent, { paddingBottom: insets.bottom + 40 }]}>
          <View style={[styles.heroCard, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.iconRing, { backgroundColor: isDark ? COLORS.rgba_37_99_235_0p2 : COLORS.hex_EFF6FF }]}>
              <MaterialCommunityIcons name="trophy-award" size={44} color={primary} />
            </View>
            <Text style={[styles.heroTitle, { color: text }]}>Community Daily Challenge</Text>
            <Text style={[styles.heroSub, { color: textMuted }]}>
              Answer fast to score higher multipliers. Compete with creators and friends across the network.
            </Text>

            {questions.length > 0 ? (
              <TouchableOpacity style={[styles.startBtn, { backgroundColor: primary }]} onPress={startQuiz}>
                <MaterialCommunityIcons name="play" size={20} color={COLORS.white} />
                <Text style={styles.startBtnText}>Start Live Quiz ({questions.length} Questions)</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.emptyNotice, { backgroundColor: isDark ? COLORS.hex_1F293D : COLORS.hex_F1F5F9 }]}>
                <MaterialCommunityIcons name="timer-sand-complete" size={20} color={textMuted} />
                <Text style={[styles.emptyNoticeText, { color: textMuted }]}>
                  Next daily live quiz session is currently being scheduled by the community host. Check back soon!
                </Text>
              </View>
            )}
          </View>

          {/* Player Stats */}
          <Text style={[styles.sectionTitle, { color: text }]}>Your Trivia History</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.statValue, { color: primary }]}>{triviaStats.totalScore}</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Total Points</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.statValue, { color: COLORS.hex_10B981 }]}>{triviaStats.bestStreak}</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Best Streak</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.statValue, { color: COLORS.hex_F59E0B }]}>{triviaStats.totalGames}</Text>
              <Text style={[styles.statLabel, { color: textMuted }]}>Games Played</Text>
            </View>
          </View>
        </ScrollView>
      ) : gameState === 'playing' ? (
        /* Active Game View */
        <View style={[styles.quizContainer, { paddingBottom: insets.bottom + 20 }]}>
          {/* Progress & Timer */}
          <View style={styles.quizHeader}>
            <Text style={[styles.questionCounter, { color: textMuted }]}>
              Question {currentIdx + 1} of {questions.length}
            </Text>
            <View style={styles.streakBadge}>
              <MaterialCommunityIcons name="fire" size={16} color={COLORS.hex_EF4444} />
              <Text style={styles.streakText}>{streak} Streak</Text>
            </View>
          </View>

          {/* Animated Countdown Bar */}
          <View style={[styles.timerTrack, { backgroundColor: border }]}>
            <Animated.View
              style={[
                styles.timerFill,
                {
                  backgroundColor: timeLeft <= 5 ? COLORS.hex_EF4444 : primary,
                  width: timerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Question Card */}
          <View style={[styles.questionCard, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[styles.questionText, { color: text }]}>{currentQ?.question}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsWrap}>
            {currentQ?.options?.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;
              let optBg = surface;
              let optBorder = border;
              let optText = text;

              if (isAnswerRevealed) {
                if (isCorrect) {
                  optBg = isDark ? COLORS.rgba_16_185_129_0p2 : COLORS.hex_DCFCE7;
                  optBorder = COLORS.hex_10B981;
                  optText = COLORS.hex_10B981;
                } else if (isSelected && !isCorrect) {
                  optBg = isDark ? COLORS.rgba_239_68_68_0p2 : COLORS.hex_FEE2E2;
                  optBorder = COLORS.hex_EF4444;
                  optText = COLORS.hex_EF4444;
                }
              } else if (isSelected) {
                optBg = isDark ? COLORS.rgba_37_99_235_0p2 : COLORS.hex_EFF6FF;
                optBorder = primary;
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionBtn, { backgroundColor: optBg, borderColor: optBorder }]}
                  onPress={() => handleSelectOption(idx)}
                  disabled={isAnswerRevealed}
                >
                  <Text style={[styles.optionLetter, { color: optText }]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                  <Text style={[styles.optionText, { color: optText }]}>{opt}</Text>
                  {isAnswerRevealed && isCorrect ? (
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.hex_10B981} />
                  ) : isAnswerRevealed && isSelected && !isCorrect ? (
                    <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.hex_EF4444} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Row */}
          {isAnswerRevealed ? (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: primary }]} onPress={handleNext}>
              <Text style={styles.nextBtnText}>
                {currentIdx + 1 < questions.length ? 'Next Question' : 'View Results'}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        /* Completed Screen */
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.lobbyContent, { paddingBottom: insets.bottom + 40 }]}>
          <View style={[styles.heroCard, { backgroundColor: surface, borderColor: border }]}>
            <MaterialCommunityIcons name="crown" size={54} color={COLORS.hex_FBBF24} />
            <Text style={[styles.heroTitle, { color: text }]}>Quiz Completed!</Text>
            <Text style={[styles.resultScoreText, { color: primary }]}>{score} Points</Text>
            <Text style={[styles.heroSub, { color: textMuted }]}>
              Great job! Your score has been added to your community profile.
            </Text>

            <TouchableOpacity style={[styles.startBtn, { backgroundColor: primary }]} onPress={() => setGameState('lobby')}>
              <MaterialCommunityIcons name="keyboard-return" size={18} color={COLORS.white} />
              <Text style={styles.startBtnText}>Return to Trivia Lobby</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  scorePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, gap: 4 },
  scorePillText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 12, fontSize: 14 },
  scroll: { flex: 1 },
  lobbyContent: { padding: 16 },
  heroCard: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginBottom: 24 },
  iconRing: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  heroSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  startBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, gap: 8 },
  startBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  emptyNotice: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 8, gap: 10, width: '100%' },
  emptyNoticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12 },
  quizContainer: { flex: 1, padding: 16 },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  questionCounter: { fontSize: 13, fontWeight: '600' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontWeight: '700', color: COLORS.hex_EF4444 },
  timerTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 18 },
  timerFill: { height: '100%' },
  questionCard: { padding: 20, borderRadius: 14, borderWidth: 1, marginBottom: 20, minHeight: 100, justifyContent: 'center' },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 24, textAlign: 'center' },
  optionsWrap: { gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, gap: 12 },
  optionLetter: { fontSize: 15, fontWeight: '700', width: 24 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '500' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 20, gap: 8 },
  nextBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  resultScoreText: { fontSize: 32, fontWeight: '900', marginVertical: 8 },
});

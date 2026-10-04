import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function LivePollsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'create'
  const [userVotes, setUserVotes] = useState({});
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  // Creation State
  const [pollQuestion, setPollQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState('24 Hours');

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/polls`);
      if (res.ok) {
        const data = await res.json();
        setPolls(Array.isArray(data.polls) ? data.polls : []);
      } else {
        setPolls([]);
      }
    } catch {
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleVote = (pollId, optionIndex) => {
    if (userVotes[pollId] !== undefined) {
      Alert.alert('Already Voted', 'You have already submitted your vote on this community poll.');
      return;
    }

    setPolls(
      polls.map((p) => {
        if (p.id === pollId) {
          const updatedOptions = p.options.map((opt, idx) =>
            idx === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt
          );
          return {
            ...p,
            options: updatedOptions,
            totalVotes: p.totalVotes + 1,
          };
        }
        return p;
      })
    );

    setUserVotes({ ...userVotes, [pollId]: optionIndex });
  };

  const handleAddOption = () => {
    if (options.length >= 4) {
      Alert.alert('Limit Reached', 'Polls can have a maximum of 4 options.');
      return;
    }
    setOptions([...options, '']);
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert('Question Required', 'Please enter a poll question.');
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      Alert.alert('Insufficient Options', 'Please provide at least 2 options.');
      return;
    }

    const newPoll = {
      id: `poll-${Date.now()}`,
      author: {
        name: currentUser?.name || 'You',
        handle: currentUser?.handle || '@me',
        verified: !!currentUser?.verified,
      },
      question: pollQuestion.trim(),
      options: validOptions.map((text, idx) => ({ id: idx, text, votes: 0 })),
      totalVotes: 0,
      timeLeft: pollDuration,
      createdAt: 'Just now',
    };

    try {
      await fetch(`${API_BASE_URL}/api/social/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollQuestion.trim(),
          options: validOptions,
          authorId: currentUser?.id,
          authorName: currentUser?.name,
          authorHandle: currentUser?.handle,
          duration: pollDuration,
        }),
      });
    } catch {
      // Offline fallback
    }

    setPolls([newPoll, ...polls]);
    setPollQuestion('');
    setOptions(['', '']);
    setActiveTab('active');
    Alert.alert('Poll Published', 'Your community poll is now live in the hub.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Live Community Polls</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'create' ? 'active' : 'create')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'create' ? 'close' : 'add'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.activeTabBtn]}
          onPress={() => setActiveTab('active')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'active' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'active' && { fontWeight: '700' },
            ]}
          >
            Trending Polls
          </Text>
          {activeTab === 'active' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'create' && styles.activeTabBtn]}
          onPress={() => setActiveTab('create')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'create' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'create' && { fontWeight: '700' },
            ]}
          >
            Create Poll
          </Text>
          {activeTab === 'create' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'create' ? (
          /* CREATE POLL FORM */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <View style={styles.createTitleRow}>
              <Ionicons name="stats-chart" size={24} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.createTitle, { color: theme.text }]}>Ask the Community</Text>
                <Text style={[styles.createSub, { color: theme.textSecondary }]}>
                  Gather instant feedback from thousands of Tiwi members
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Poll Question</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Which design style do you prefer?"
              placeholderTextColor={theme.textSecondary}
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Poll Choices</Text>
            {options.map((opt, idx) => (
              <TextInput
                key={`opt-${idx}`}
                style={[
                  styles.optionInput,
                  { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
                ]}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={theme.textSecondary}
                value={opt}
                onChangeText={(val) => {
                  const updated = [...options];
                  updated[idx] = val;
                  setOptions(updated);
                }}
              />
            ))}

            {options.length < 4 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddOption}>
                <Ionicons name="add-circle-outline" size={17} color={theme.primary || COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.addOptionText, { color: theme.primary || COLORS.primary }]}>Add Another Option</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Poll Duration</Text>
            <View style={styles.durationRow}>
              {['24 Hours', '3 Days', '7 Days'].map((d) => {
                const isSelected = pollDuration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationPill,
                      {
                        backgroundColor: isSelected
                          ? (theme.primary || COLORS.primary)
                          : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                      },
                    ]}
                    onPress={() => setPollDuration(d)}
                  >
                    <Text style={[styles.durationText, { color: isSelected ? COLORS.white : theme.text }]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.publishBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleCreatePoll}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.publishBtnText}>Launch Live Poll</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Loading community polls...</Text>
          </View>
        ) : polls.length === 0 ? (
          <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 14 }}>
            <Ionicons name="bar-chart-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>No Active Polls</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>
              There are no community polls active at the moment. Create your first poll to gather insights from your audience!
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: theme.primary || COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
              onPress={() => setActiveTab('create')}
            >
              <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Create a Poll</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* POLLS FEED */
          polls.map((poll) => {
            const hasVoted = userVotes[poll.id] !== undefined;
            const votedIndex = userVotes[poll.id];

            return (
              <View
                key={poll.id}
                style={[styles.pollCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              >
                {/* Author Info */}
                <View style={styles.authorRow}>
                  <View style={styles.nameBlock}>
                    <View style={styles.nameVerifiedRow}>
                      <Text style={[styles.authorName, { color: theme.text }]}>{poll.author.name}</Text>
                      {poll.author.verified && (
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginLeft: 4 }} />
                      )}
                    </View>
                    <Text style={[styles.authorHandle, { color: theme.textSecondary }]}>
                      {poll.author.handle} • {poll.createdAt}
                    </Text>
                  </View>
                  <View style={[styles.liveBadge, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                    <Ionicons name="pulse" size={12} color={COLORS.primary} style={{ marginRight: 3 }} />
                    <Text style={[styles.liveBadgeText, { color: COLORS.primary }]}>{poll.timeLeft}</Text>
                  </View>
                </View>

                {/* Question */}
                <Text style={[styles.questionText, { color: theme.text }]}>{poll.question}</Text>

                {/* Options List with Dynamic Vote Percentage */}
                <View style={styles.optionsList}>
                  {poll.options.map((option, oIdx) => {
                    const percentage = poll.totalVotes > 0
                      ? Math.round((option.votes / poll.totalVotes) * 100)
                      : 0;
                    const isSelectedByMe = hasVoted && votedIndex === oIdx;

                    return (
                      <TouchableOpacity
                        key={`poll-opt-${oIdx}`}
                        style={[
                          styles.optionBarContainer,
                          {
                            borderColor: isSelectedByMe ? (theme.primary || COLORS.primary) : theme.borderLight,
                            backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F9FAFB,
                          },
                        ]}
                        onPress={() => handleVote(poll.id, oIdx)}
                        disabled={hasVoted}
                        activeOpacity={0.7}
                      >
                        {/* Progress bar background fill */}
                        {hasVoted && (
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${percentage}%`,
                                backgroundColor: isSelectedByMe
                                  ? (isDarkMode ? COLORS.rgba_11_87_208_0p35 : COLORS.rgba_211_227_253_0p8)
                                  : (isDarkMode ? COLORS.rgba_255_255_255_0p08 : COLORS.rgba_0_0_0_0p05),
                              },
                            ]}
                          />
                        )}

                        <View style={styles.optionContentRow}>
                          <View style={styles.optionLeftRow}>
                            {isSelectedByMe && (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={theme.primary || COLORS.primary}
                                style={{ marginRight: 6 }}
                              />
                            )}
                            <Text style={[styles.optionLabel, { color: theme.text }, isSelectedByMe && { fontWeight: '700' }]}>
                              {option.text}
                            </Text>
                          </View>
                          {hasVoted && (
                            <Text style={[styles.percentLabel, { color: theme.text }]}>
                              {percentage}%
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Footer */}
                <View style={styles.pollFooterRow}>
                  <Text style={[styles.totalVotesText, { color: theme.textSecondary }]}>
                    {poll.totalVotes} total votes • {hasVoted ? 'You voted' : 'Tap an option to vote'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 13,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 3,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pollCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameBlock: {
    flex: 1,
  },
  nameVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorHandle: {
    fontSize: 11,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 14,
  },
  optionsList: {
    marginBottom: 12,
  },
  optionBarContainer: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  optionContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 1,
  },
  optionLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  optionLabel: {
    fontSize: 13,
  },
  percentLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  pollFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalVotesText: {
    fontSize: 11,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  createSub: {
    fontSize: 12,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  optionInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 8,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  addOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  durationPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  publishBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

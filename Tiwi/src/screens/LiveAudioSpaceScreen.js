import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { TiwiAPI } from '../services/tiwiApi';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

const { width } = Dimensions.get('window');

export default function LiveAudioSpaceScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeRoom, setActiveRoom] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomTopic, setRoomTopic] = useState('Tech & AI');
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/audio-spaces`);
      if (res.ok) {
        const data = await res.json();
        setSpaces(Array.isArray(data.spaces) ? data.spaces : []);
      } else {
        setSpaces([]);
      }
    } catch {
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const topics = ['Technology', 'UI/UX Design', 'Startups', 'Music & Podcasting', 'Crypto & FinTech'];

  const handleStartSpace = async () => {
    if (!roomTitle.trim()) {
      Alert.alert('Room Title Required', 'Please enter a title for your live audio space.');
      return;
    }

    const newSpace = {
      id: `space-${Date.now()}`,
      title: roomTitle.trim(),
      topic: roomTopic,
      host: {
        id: currentUser?.id || 'me',
        name: currentUser?.name || 'You',
        handle: currentUser?.handle || '@me',
        avatar: currentUser?.avatar || null,
      },
      speakers: [
        {
          id: currentUser?.id || 'me',
          name: currentUser?.name || 'You (Host)',
          isSpeaking: false,
          isHost: true,
        },
      ],
      listenersCount: 1,
      isLive: true,
    };

    try {
      await fetch(`${API_BASE_URL}/api/social/audio-spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: roomTitle.trim(),
          topic: roomTopic,
          hostId: currentUser?.id,
          hostUsername: currentUser?.handle || currentUser?.name,
        }),
      });
    } catch {
      // Offline fallback
    }

    setSpaces([newSpace, ...spaces]);
    setActiveRoom(newSpace);
    setCreatingRoom(false);
    setRoomTitle('');
    setIsMicMuted(false);
  };

  const handleToggleHand = () => {
    setIsHandRaised((prev) => {
      const next = !prev;
      Alert.alert(
        next ? 'Hand Raised' : 'Hand Lowered',
        next
          ? 'The host has been notified that you wish to speak.'
          : 'You lowered your hand request.'
      );
      return next;
    });
  };

  const handleLeaveRoom = () => {
    if (activeRoom?.id && currentUser?.id) {
      TiwiAPI.leaveAudioSpace(activeRoom.id, currentUser.id).catch(() => {});
    }
    setActiveRoom(null);
    setIsHandRaised(false);
    setIsMicMuted(true);
  };

  const handleJoinSpace = async (sp) => {
    setActiveRoom(sp);
    if (sp?.id && currentUser?.id) {
      try {
        await TiwiAPI.joinAudioSpace(sp.id, {
          userId: currentUser.id,
          username: currentUser.handle || currentUser.name,
          name: currentUser.name || 'User',
          avatar: currentUser.avatar || null,
        });
      } catch (e) {
        console.warn('Failed to persist joinAudioSpace:', e);
      }
    }
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Tiwi Audio Spaces</Text>
        <TouchableOpacity
          onPress={() => setCreatingRoom(!creatingRoom)}
          style={[styles.createPillBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={creatingRoom ? 'close' : 'radio'} size={15} color={COLORS.white} style={{ marginRight: 4 }} />
          <Text style={styles.createPillText}>{creatingRoom ? 'Cancel' : 'Go Live'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active In-Call Stage if in a room */}
        {activeRoom ? (
          <View style={[styles.stageCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            {/* Live Room Header */}
            <View style={styles.stageHeaderRow}>
              <View style={styles.liveBadgeRow}>
                <View style={styles.livePulseRed} />
                <Text style={styles.liveText}>LIVE STAGE</Text>
              </View>
              <View style={[styles.topicChip, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                <Text style={[styles.topicChipText, { color: theme.primary || COLORS.primary }]}>
                  {activeRoom.topic}
                </Text>
              </View>
            </View>

            <Text style={[styles.stageTitle, { color: theme.text }]}>{activeRoom.title}</Text>
            <Text style={[styles.stageSub, { color: theme.textSecondary }]}>
              Hosted by {activeRoom.host.name} • {activeRoom.listenersCount} listeners tuning in
            </Text>

            {/* Speakers Grid */}
            <Text style={[styles.speakersLabel, { color: theme.textSecondary }]}>SPEAKERS</Text>
            <View style={styles.speakersGrid}>
              {activeRoom.speakers.map((sp) => (
                <View key={sp.id} style={styles.speakerAvatarItem}>
                  <View
                    style={[
                      styles.speakerAvatarRing,
                      sp.isSpeaking && { borderColor: COLORS.hex_10B981, borderWidth: 2 },
                    ]}
                  >
                    <View style={[styles.speakerAvatarCircle, { backgroundColor: theme.primary || COLORS.primary }]}>
                      <Text style={styles.speakerInitial}>{sp.name.charAt(0)}</Text>
                    </View>
                    {sp.isHost && (
                      <View style={styles.hostStarBadge}>
                        <Ionicons name="star" size={10} color={COLORS.white} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.speakerName, { color: theme.text }]} numberOfLines={1}>
                    {sp.name}
                  </Text>
                  <Text style={[styles.speakerRole, { color: sp.isSpeaking ? COLORS.hex_10B981 : theme.textSecondary }]}>
                    {sp.isSpeaking ? 'Speaking...' : sp.isHost ? 'Host' : 'Speaker'}
                  </Text>
                </View>
              ))}
            </View>

            {/* In-Room Audio Controls Toolbar */}
            <View style={[styles.stageControlsRow, { borderTopColor: theme.borderLight }]}>
              <TouchableOpacity
                style={[
                  styles.controlCircleBtn,
                  { backgroundColor: isMicMuted ? (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E5E7EB) : COLORS.hex_10B981 },
                ]}
                onPress={() => setIsMicMuted(!isMicMuted)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isMicMuted ? 'mic-off' : 'mic'}
                  size={20}
                  color={isMicMuted ? theme.text : COLORS.white}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlCircleBtn,
                  { backgroundColor: isHandRaised ? COLORS.hex_F59E0B : (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E5E7EB) },
                ]}
                onPress={handleToggleHand}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="hand-right"
                  size={20}
                  color={isHandRaised ? COLORS.white : theme.text}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.leaveBtn, { backgroundColor: COLORS.hex_EF4444 }]}
                onPress={handleLeaveRoom}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.leaveBtnText}>Leave Quietly</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Room Creation Flow */}
        {creatingRoom && (
          <View style={[styles.createCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <View style={styles.createCardHeader}>
              <Ionicons name="radio-outline" size={24} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.createCardTitle, { color: theme.text }]}>Host a Live Audio Space</Text>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>What do you want to talk about?</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              placeholder="e.g. Next-Gen Mobile App Architecture & Scaling"
              placeholderTextColor={theme.textSecondary}
              value={roomTitle}
              onChangeText={setRoomTitle}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Select Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroll}>
              {topics.map((t) => {
                const isSelected = roomTopic === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.topicPill,
                      {
                        backgroundColor: isSelected
                          ? (theme.primary || COLORS.primary)
                          : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                      },
                    ]}
                    onPress={() => setRoomTopic(t)}
                  >
                    <Text style={[styles.topicPillText, { color: isSelected ? COLORS.white : theme.text }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.startRoomBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleStartSpace}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.startRoomBtnText}>Start Your Space Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Live Audio Rooms Directory */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>HAPPENING NOW</Text>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Scanning live voice stages...</Text>
          </View>
        ) : spaces.length === 0 ? (
          <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 12 }}>
            <Ionicons name="headset-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>No Active Spaces</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>
              There are no live audio rooms happening right now. Be the first to start a conversation!
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: theme.primary || COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
              onPress={() => setCreatingRoom(true)}
            >
              <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Start a Live Space</Text>
            </TouchableOpacity>
          </View>
        ) : (
          spaces.map((sp) => (
            <TouchableOpacity
              key={sp.id}
              style={[styles.spaceCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              activeOpacity={0.8}
              onPress={() => handleJoinSpace(sp)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopicBadge}>
                  <Ionicons name="headset" size={13} color={COLORS.hex_10B981} style={{ marginRight: 4 }} />
                  <Text style={styles.cardTopicText}>{sp.topic}</Text>
                </View>
                <View style={styles.listenerBadge}>
                  <Ionicons name="people-outline" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.listenerText, { color: theme.textSecondary }]}>
                    {sp.listenersCount || 1} listening
                  </Text>
                </View>
              </View>

              <Text style={[styles.spaceCardTitle, { color: theme.text }]}>{sp.title}</Text>

              <View style={styles.hostRow}>
                {sp.host?.avatar && !sp.host.avatar.includes('unsplash') ? (
                  <Image source={{ uri: sp.host.avatar }} style={styles.hostAvatar} />
                ) : (
                  <View style={[styles.hostAvatar, { backgroundColor: theme.primary || COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                      {(sp.host?.name || 'H').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hostName, { color: theme.text }]}>{sp.host?.name || 'Host'}</Text>
                  <Text style={[styles.hostHandle, { color: theme.textSecondary }]}>{sp.host?.handle || '@host'} • Host</Text>
                </View>
                <View style={[styles.joinBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                  <Text style={[styles.joinBtnText, { color: theme.primary || COLORS.primary }]}>Tune In</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
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
  createPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  createPillText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stageCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
  },
  stageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.hex_EF4444,
    marginRight: 6,
  },
  liveText: {
    color: COLORS.hex_EF4444,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  topicChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stageTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 22,
  },
  stageSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  speakersLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  speakersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  speakerAvatarItem: {
    alignItems: 'center',
    width: (width - 68) / 3,
    marginBottom: 14,
  },
  speakerAvatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  speakerAvatarCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerInitial: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  hostStarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.hex_F59E0B,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerName: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 80,
  },
  speakerRole: {
    fontSize: 10,
    marginTop: 1,
  },
  stageControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  controlCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
  },
  leaveBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  createCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  createCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  createCardTitle: {
    fontSize: 16,
    fontWeight: '700',
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
  topicScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  topicPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  topicPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  startRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    marginTop: 16,
  },
  startRoomBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  spaceCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTopicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTopicText: {
    color: COLORS.hex_10B981,
    fontSize: 12,
    fontWeight: '700',
  },
  listenerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listenerText: {
    fontSize: 11,
    fontWeight: '500',
  },
  spaceCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 20,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  hostName: {
    fontSize: 13,
    fontWeight: '600',
  },
  hostHandle: {
    fontSize: 11,
    marginTop: 1,
  },
  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

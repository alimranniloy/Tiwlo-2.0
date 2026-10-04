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
import { COLORS } from '../config/colors';

export default function VoiceNotesScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceTitle, setVoiceTitle] = useState('');

  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasRecorded(true);
    } else {
      setRecordSeconds(0);
      setHasRecorded(false);
      setIsRecording(true);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handlePublishVoiceNote = () => {
    if (!hasRecorded) {
      Alert.alert('No Audio', 'Please record your voice note before publishing.');
      return;
    }

    Alert.alert('Voice Note Published!', 'Your audio broadcast is now available on your feed.', [
      { text: 'OK', onPress: () => onNavigate && onNavigate('back') },
    ]);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Voice Studio</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Voice Recorder Card */}
        <View style={[styles.recordCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.recordCardTitle, { color: theme.text }]}>Record an Audio Broadcast</Text>
          <Text style={[styles.recordCardSub, { color: theme.textSecondary }]}>
            Share voice notes, quick audio commentary, and soundbites up to 3 minutes
          </Text>

          {/* Waveform Visualization Bars */}
          <View style={styles.waveformContainer}>
            {[24, 45, 68, 90, 52, 78, 34, 88, 62, 40, 75, 95, 30, 60, 85, 45, 70, 35].map((height, i) => (
              <View
                key={`wave-${i}`}
                style={[
                  styles.waveformBar,
                  {
                    height: isRecording ? Math.max(12, (height * (recordSeconds % 3 + 1)) % 80) : 16,
                    backgroundColor: isRecording ? COLORS.hex_EF4444 : hasRecorded ? (theme.primary || COLORS.primary) : theme.borderLight,
                  },
                ]}
              />
            ))}
          </View>

          {/* Timer Display */}
          <Text style={[styles.timerText, { color: isRecording ? COLORS.hex_EF4444 : theme.text }]}>
            {formatTimer(recordSeconds)}
          </Text>

          {/* Record Button */}
          <TouchableOpacity
            style={[
              styles.recordBtnCircle,
              { backgroundColor: isRecording ? COLORS.hex_EF4444 : (theme.primary || COLORS.primary) },
            ]}
            onPress={handleToggleRecord}
            activeOpacity={0.8}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={[styles.recordHint, { color: theme.textSecondary }]}>
            {isRecording ? 'Tap red button to finish recording' : hasRecorded ? 'Recording complete. Tap to re-record.' : 'Tap to start recording'}
          </Text>
        </View>

        {/* Post Details (If recorded) */}
        {hasRecorded && (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Caption or Title</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="What is this voice note about?"
              placeholderTextColor={theme.textSecondary}
              value={voiceTitle}
              onChangeText={setVoiceTitle}
            />

            {/* Audio Preview Bar */}
            <View style={[styles.previewBar, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.inputBackground }]}>
              <TouchableOpacity
                style={[styles.playBtnCircle, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={() => setIsPlaying(!isPlaying)}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={COLORS.white} style={{ marginLeft: isPlaying ? 0 : 2 }} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.previewTitle, { color: theme.text }]}>Voice Memo • {formatTimer(recordSeconds)}</Text>
                <Text style={[styles.previewSub, { color: theme.textSecondary }]}>
                  {isPlaying ? 'Playing preview...' : 'Ready to broadcast'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.publishVoiceBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handlePublishVoiceNote}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.publishVoiceBtnText}>Publish Voice Note to Feed</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  recordCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  recordCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  recordCardSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    gap: 5,
    marginBottom: 16,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  timerText: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 20,
  },
  recordBtnCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginBottom: 12,
  },
  recordHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
    marginBottom: 14,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
  },
  playBtnCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: 11,
    marginTop: 1,
  },
  publishVoiceBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishVoiceBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

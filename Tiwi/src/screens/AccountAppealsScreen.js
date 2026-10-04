import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function AccountAppealsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [appealReason, setAppealReason] = useState('');
  const [incidentRef, setIncidentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitAppeal = () => {
    if (!appealReason.trim()) {
      Alert.alert('Explanation Required', 'Please explain why you believe the moderation decision was incorrect.');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      Alert.alert('Appeal Filed', 'Your appeal has been escalated to the Trust & Safety review team.');
    }, 1200);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Account Health & Appeals</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account Standing Status Card */}
        <View style={[styles.standingCard, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_10B981 }]}>
          <View style={styles.standingIconCircle}>
            <Ionicons name="shield-checkmark" size={36} color={COLORS.hex_10B981} />
          </View>
          <Text style={[styles.standingTitle, { color: theme.text }]}>Account in Excellent Standing</Text>
          <Text style={[styles.standingSub, { color: theme.textSecondary }]}>
            You have 0 active strikes. Your profile, posts, reels, and live audio capabilities are fully active.
          </Text>

          <View style={[styles.strikeIndicatorRow, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.inputBackground }]}>
            <View style={styles.strikeCol}>
              <Text style={[styles.strikeVal, { color: COLORS.hex_10B981 }]}>0 / 3</Text>
              <Text style={[styles.strikeLabel, { color: theme.textSecondary }]}>Active Strikes</Text>
            </View>
            <View style={styles.strikeDivider} />
            <View style={styles.strikeCol}>
              <Text style={[styles.strikeVal, { color: theme.text }]}>100%</Text>
              <Text style={[styles.strikeLabel, { color: theme.textSecondary }]}>Safe Content Score</Text>
            </View>
          </View>
        </View>

        {/* Appeal Submission Form */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>FILE A FORMAL APPEAL</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
          <Text style={[styles.formSubText, { color: theme.textSecondary }]}>
            If one of your posts, reels, or comments was flagged or removed by automated systems, you can request an independent human review.
          </Text>

          <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
            Incident or Post ID (Optional)
          </Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
            ]}
            placeholder="e.g. POST-81920 or notification reference"
            placeholderTextColor={theme.textSecondary}
            value={incidentRef}
            onChangeText={setIncidentRef}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
            Statement & Rationale
          </Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
            ]}
            placeholder="Explain why the content complies with Tiwi Community Guidelines..."
            placeholderTextColor={theme.textSecondary}
            value={appealReason}
            onChangeText={setAppealReason}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitAppealBtn, { backgroundColor: theme.primary || COLORS.primary }]}
            onPress={handleSubmitAppeal}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="shield-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.submitAppealBtnText}>Submit Appeal for Human Review</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  standingCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
  },
  standingIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.rgba_16_185_129_0p12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  standingTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  standingSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  strikeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  strikeCol: {
    flex: 1,
    alignItems: 'center',
  },
  strikeVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  strikeLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  strikeDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: COLORS.rgba_150_150_150_0p3,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  formSubText: {
    fontSize: 13,
    lineHeight: 18,
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
  textArea: {
    height: 110,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  submitAppealBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitAppealBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

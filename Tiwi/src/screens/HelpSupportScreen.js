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

const FAQS = [
  {
    q: 'How does my Tiwi ID work?',
    a: 'Every Tiwi user has a unique numeric/alphanumeric Tiwi ID (e.g. TIW-00042). You can share this ID with friends or use it for direct search and verification across the platform.',
  },
  {
    q: 'How can I get a Verified badge?',
    a: 'You can apply directly via the Account Verification screen in your Settings. Creators with authentic identity and adherence to our Community Guidelines are eligible for the badge.',
  },
  {
    q: 'Is my media and data secure on Tiwi?',
    a: 'Yes. All video uploads, reels, and stories are processed with secure cloud infrastructure and encrypted database records. We never sell your personal data.',
  },
  {
    q: 'How do I block or report inappropriate content?',
    a: 'Tap the three-dots menu on any post or reel to report violations. You can also block users directly from their profile or manage your list in Privacy & Safety.',
  },
];

export default function HelpSupportScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [expandedIndex, setExpandedIndex] = useState(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Account & Security');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categories = ['Account & Security', 'Bug Report', 'Creator Features', 'Billing & Badges', 'Other'];

  const handleSubmitTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Incomplete Form', 'Please provide both a subject and a message description.');
      return;
    }

    setSending(true);
    // Simulate direct secure support dispatch
    setTimeout(() => {
      setSending(false);
      setSubmitted(true);
      setSubject('');
      setMessage('');
    }, 1000);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Help & Support</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* System Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.statusDot} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.statusTitle, { color: theme.text }]}>All Systems Operational</Text>
            <Text style={[styles.statusSub, { color: theme.textSecondary }]}>Tiwi Core API & Video Streaming: 99.98% Uptime</Text>
          </View>
        </View>

        {/* FAQs */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          {FAQS.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={`faq-${index}`}>
                <TouchableOpacity
                  style={styles.faqRow}
                  activeOpacity={0.7}
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                >
                  <Text style={[styles.faqQuestion, { color: theme.text }]}>{faq.q}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>{faq.a}</Text>
                  </View>
                )}

                {index < FAQS.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Contact Support Form */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>SUBMIT A SUPPORT TICKET</Text>

        {submitted ? (
          <View style={[styles.successCard, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_22C55E }]}>
            <Ionicons name="checkmark-circle" size={40} color={COLORS.hex_22C55E} style={{ marginBottom: 8 }} />
            <Text style={[styles.successTitle, { color: theme.text }]}>Ticket Submitted Successfully</Text>
            <Text style={[styles.successSub, { color: theme.textSecondary }]}>
              Our support team will inspect your request and respond to your registered email ({currentUser?.email || 'account'}).
            </Text>
            <TouchableOpacity
              style={[styles.newTicketBtn, { borderColor: theme.borderLight }]}
              onPress={() => setSubmitted(false)}
            >
              <Text style={[styles.newTicketText, { color: theme.accent || COLORS.hex_1D9BF0 }]}>Submit Another Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}>
            {/* Category selector chips */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Issue Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {categories.map((cat) => {
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? (theme.accent || COLORS.hex_1D9BF0)
                          : (isDarkMode ? COLORS.hex_222222 : COLORS.borderLight),
                      },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? COLORS.white : theme.text },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Subject Input */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Subject</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              placeholder="e.g. Question regarding video upload"
              placeholderTextColor={theme.textSecondary}
              value={subject}
              onChangeText={setSubject}
            />

            {/* Message Input */}
            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Description</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              placeholder="Describe your issue in detail..."
              placeholderTextColor={theme.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.accent || COLORS.hex_1D9BF0 }]}
              activeOpacity={0.8}
              onPress={handleSubmitTicket}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Ticket</Text>
                </>
              )}
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.hex_22C55E,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    paddingRight: 10,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  successCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  newTicketBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  newTicketText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function DataExportScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [includePosts, setIncludePosts] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [includeMessages, setIncludeMessages] = useState(true);
  const [includeActivity, setIncludeActivity] = useState(true);
  const [format, setFormat] = useState('JSON (Machine Readable)'); // 'JSON' | 'HTML'
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleRequestArchive = () => {
    setRequesting(true);
    setTimeout(() => {
      setRequesting(false);
      setRequested(true);
      Alert.alert(
        'Archive Requested',
        `A secure download link will be dispatched to ${currentUser?.email || 'your registered email'} once your export is compiled.`
      );
    }, 1500);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Download Your Data</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Ionicons name="cloud-download-outline" size={32} color={theme.primary || COLORS.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Export Complete Account Archive</Text>
          <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
            You have full ownership of your data on Tiwi. Download a complete copy of your posts, media files, messages, and account history anytime.
          </Text>
        </View>

        {requested ? (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_10B981, padding: 20, alignItems: 'center' }]}>
            <Ionicons name="checkmark-circle" size={44} color={COLORS.hex_10B981} style={{ marginBottom: 10 }} />
            <Text style={[styles.successTitle, { color: theme.text }]}>Export In Progress</Text>
            <Text style={[styles.successSub, { color: theme.textSecondary }]}>
              Our cloud archive generator is compiling your requested files. You will receive an encrypted download link at {currentUser?.email || 'your email'} within a few minutes.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>CHOOSE DATA TO INCLUDE</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Posts & Captions</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>All timeline updates, reels descriptions, and polls</Text>
                </View>
                <Switch
                  value={includePosts}
                  onValueChange={setIncludePosts}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Photos, Videos & Audio</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Original high-resolution uploads and voice notes</Text>
                </View>
                <Switch
                  value={includeMedia}
                  onValueChange={setIncludeMedia}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Direct Messages</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Encrypted conversation history and attachments</Text>
                </View>
                <Switch
                  value={includeMessages}
                  onValueChange={setIncludeMessages}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.optionRow}>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Profile & Activity History</Text>
                  <Text style={[styles.optionSub, { color: theme.textSecondary }]}>Followers, following, likes, bookmarks, and lists</Text>
                </View>
                <Switch
                  value={includeActivity}
                  onValueChange={setIncludeActivity}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.requestBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleRequestArchive}
              disabled={requesting}
              activeOpacity={0.85}
            >
              {requesting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.requestBtnText}>Request Complete Data Export</Text>
                </>
              )}
            </TouchableOpacity>
          </>
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
  bannerCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 19,
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
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  requestBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  requestBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function ContentFiltersScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [harassmentShield, setHarassmentShield] = useState(true);
  const [blurSensitive, setBlurSensitive] = useState(true);
  const [hideLowQuality, setHideLowQuality] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [mutedWords, setMutedWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFilters = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/content-filters?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.filters) {
          setHarassmentShield(data.filters.harassmentShield ?? true);
          setBlurSensitive(data.filters.blurSensitive ?? true);
          setHideLowQuality(data.filters.hideLowQuality ?? true);
          setMutedWords(Array.isArray(data.filters.mutedWords) ? data.filters.mutedWords : []);
        }
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const saveFilterState = async (updatedFilters) => {
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      await fetch(`${API_BASE_URL}/api/social/content-filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updatedFilters }),
      });
    } catch {
      // silent
    }
  };

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed) return;
    if (mutedWords.includes(trimmed)) {
      Alert.alert('Already Muted', 'This keyword is already in your filter list.');
      return;
    }
    const updated = [...mutedWords, trimmed];
    setMutedWords(updated);
    setNewKeyword('');
    saveFilterState({ harassmentShield, blurSensitive, hideLowQuality, mutedWords: updated });
  };

  const handleRemoveKeyword = (word) => {
    const updated = mutedWords.filter((w) => w !== word);
    setMutedWords(updated);
    saveFilterState({ harassmentShield, blurSensitive, hideLowQuality, mutedWords: updated });
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Content & Feed Filters</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchFilters();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Safe Browsing & Clean Feeds</Text>
          <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
            Tune your feed algorithm to eliminate harassment, hide spoilers, and blur sensitive content.
          </Text>
        </View>

        {/* Toggles */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>SAFETY CONTROLS</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Smart Harassment Shield</Text>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                Auto-hide abusive mentions and offensive replies
              </Text>
            </View>
            <Switch
              value={harassmentShield}
              onValueChange={(val) => {
                setHarassmentShield(val);
                saveFilterState({ harassmentShield: val, blurSensitive, hideLowQuality, mutedWords });
              }}
              trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Blur Sensitive Media</Text>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                Place a warning overlay on potentially sensitive images and videos
              </Text>
            </View>
            <Switch
              value={blurSensitive}
              onValueChange={(val) => {
                setBlurSensitive(val);
                saveFilterState({ harassmentShield, blurSensitive: val, hideLowQuality, mutedWords });
              }}
              trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Filter Low-Quality Spam</Text>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                Suppress automated bot accounts and repetitive link drops
              </Text>
            </View>
            <Switch
              value={hideLowQuality}
              onValueChange={(val) => {
                setHideLowQuality(val);
                saveFilterState({ harassmentShield, blurSensitive, hideLowQuality: val, mutedWords });
              }}
              trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Muted Words Section */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 20 }]}>
          MUTED WORDS & KEYWORDS
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}>
          <Text style={[styles.inputSub, { color: theme.textSecondary }]}>
            Posts containing these words or phrases will never appear in your feeds or notifications.
          </Text>

          <View style={styles.addInputRow}>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. spoilers, crypto"
              placeholderTextColor={theme.textSecondary}
              value={newKeyword}
              onChangeText={setNewKeyword}
              onSubmitEditing={handleAddKeyword}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleAddKeyword}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={theme.primary || COLORS.primary} />
            </View>
          ) : mutedWords.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="funnel-outline" size={32} color={theme.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Muted Words</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Add words or phrases above to prevent them from showing in your feeds.
              </Text>
            </View>
          ) : (
            <View style={styles.tagsContainer}>
              {mutedWords.map((word) => (
                <View
                  key={word}
                  style={[styles.wordTag, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6, borderColor: theme.borderLight }]}
                >
                  <Text style={[styles.wordText, { color: theme.text }]}>{word}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveKeyword(word)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
  bannerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  inputSub: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 10,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  wordText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

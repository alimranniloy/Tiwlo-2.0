import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

export default function BioLinkBuilderScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/bio-links?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(Array.isArray(data.links) ? data.links : []);
      } else {
        setLinks([]);
      }
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAddLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      Alert.alert('Incomplete Form', 'Please provide a link title and destination URL.');
      return;
    }

    const formattedUrl = newUrl.startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`;
    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/bio-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: newTitle.trim(),
          url: formattedUrl,
          icon: 'link',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newL = data.link || {
          id: `l-${Date.now()}`,
          title: newTitle.trim(),
          url: formattedUrl,
          icon: 'link',
          clicks: 0,
        };
        setLinks([...links, newL]);
        setNewTitle('');
        setNewUrl('');
        setAddingLink(false);
        Alert.alert('Link Added', 'Your bio link has been saved to your profile.');
      } else {
        Alert.alert('Error', 'Failed to save bio link on the server.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = (id) => {
    Alert.alert('Delete Bio Link?', 'Are you sure you want to remove this link from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLinks(links.filter((l) => l.id !== id));
          try {
            await fetch(`${API_BASE_URL}/api/social/bio-links/${id}`, { method: 'DELETE' });
          } catch {
            // silent catch
          }
        },
      },
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Link-in-Bio Builder</Text>
        <TouchableOpacity
          onPress={() => setAddingLink(!addingLink)}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={addingLink ? 'close' : 'add'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchLinks();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Unified Showcase Hub</Text>
          <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
            Give your audience one clean destination for your store, portfolio, masterclasses, and social handles.
          </Text>
        </View>

        {addingLink && (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18, marginBottom: 18 }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Add New Bio Link</Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>Title</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Official Portfolio & Case Studies"
              placeholderTextColor={theme.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Destination URL</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={theme.textSecondary}
              value={newUrl}
              onChangeText={setNewUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleAddLink}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Link</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Links Directory */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>YOUR ACTIVE BIO LINKS</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading bio links...</Text>
          </View>
        ) : links.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Ionicons name="link-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Bio Links Added</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Add links to your portfolio, YouTube, storefront, or contact channels to showcase on your profile.
            </Text>
            <TouchableOpacity
              style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={() => setAddingLink(true)}
            >
              <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.createFirstBtnText}>Add Your First Link</Text>
            </TouchableOpacity>
          </View>
        ) : (
          links.map((item) => (
            <View
              key={item.id}
              style={[styles.linkCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            >
              <View style={styles.linkLeft}>
                <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.inputBackground }]}>
                  <Ionicons name={item.icon || 'link'} size={18} color={theme.primary || COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.linkTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.linkUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.url}
                  </Text>
                </View>
              </View>

              <View style={styles.linkRight}>
                <View style={styles.clicksBadge}>
                  <Ionicons name="trending-up" size={12} color={COLORS.hex_10B981} style={{ marginRight: 4 }} />
                  <Text style={styles.clicksText}>{item.clicks || 0}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteLink(item.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.hex_EF4444} />
                </TouchableOpacity>
              </View>
            </View>
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
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    marginTop: 18,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createFirstBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clicksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_16_185_129_0p1,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clicksText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.hex_10B981,
  },
  deleteBtn: {
    padding: 4,
  },
});

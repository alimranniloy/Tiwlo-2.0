import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function CustomListsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('my_lists'); // 'my_lists' | 'new'

  // Create List State
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Lists Data
  const [myLists, setMyLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/custom-lists?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setMyLists(Array.isArray(data.lists) ? data.lists : []);
      } else {
        setMyLists([]);
      }
    } catch {
      setMyLists([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleTogglePin = async (id) => {
    const list = myLists.find((l) => l.id === id);
    if (!list) return;
    const newPinned = !list.isPinned;
    // Optimistic update
    setMyLists(myLists.map((l) => (l.id === id ? { ...l, isPinned: newPinned } : l)));
    try {
      await fetch(`${API_BASE_URL}/api/social/custom-lists/${id}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinned }),
      });
    } catch {
      // Revert if error
      setMyLists(myLists.map((l) => (l.id === id ? { ...l, isPinned: !newPinned } : l)));
    }
  };

  const handleCreateList = async () => {
    if (!listName.trim()) {
      Alert.alert('List Name Required', 'Please enter a name for your custom list.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/custom-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: listName.trim(),
          description: listDesc.trim(),
          isPrivate,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        const item = created.list || {
          id: `list-${Date.now()}`,
          name: listName.trim(),
          description: listDesc.trim(),
          isPrivate,
          isPinned: false,
          membersCount: 0,
          subscribersCount: 0,
        };
        setMyLists([item, ...myLists]);
        setListName('');
        setListDesc('');
        setIsPrivate(false);
        setActiveTab('my_lists');
        Alert.alert('List Created', `"${item.name}" has been created.`);
      } else {
        Alert.alert('Error', 'Failed to create list on the server. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network request failed. Please verify your connection.');
    } finally {
      setSubmitting(false);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Custom Lists & Feeds</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'new' ? 'my_lists' : 'new')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'new' ? 'close' : 'add'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'my_lists' && styles.activeTabBtn]}
          onPress={() => setActiveTab('my_lists')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'my_lists' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'my_lists' && { fontWeight: '700' },
            ]}
          >
            My Lists ({myLists.length})
          </Text>
          {activeTab === 'my_lists' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'new' && styles.activeTabBtn]}
          onPress={() => setActiveTab('new')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'new' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'new' && { fontWeight: '700' },
            ]}
          >
            Create List
          </Text>
          {activeTab === 'new' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
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
              fetchLists();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {activeTab === 'new' ? (
          /* CREATE LIST FORM */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <View style={styles.createTitleRow}>
              <Ionicons name="list" size={24} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.createTitle, { color: theme.text }]}>Create a Custom Feed</Text>
                <Text style={[styles.createSub, { color: theme.textSecondary }]}>
                  Curate accounts into custom feeds without cluttering your home feed
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>List Name</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. AI Researchers & Founders"
              placeholderTextColor={theme.textSecondary}
              value={listName}
              onChangeText={setListName}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Description</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="What kind of posts belong in this list?"
              placeholderTextColor={theme.textSecondary}
              value={listDesc}
              onChangeText={setListDesc}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Make Private</Text>
                <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                  Only you will be able to see this list and its members
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleCreateList}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.createBtnText}>Create Custom List</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading custom lists...</Text>
          </View>
        ) : myLists.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Ionicons name="list-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Custom Lists Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Organize your feed by creating targeted lists for topics, friends, or creator niches.
            </Text>
            <TouchableOpacity
              style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={() => setActiveTab('new')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.createFirstBtnText}>Create First List</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* MY LISTS DIRECTORY */
          myLists.map((list) => (
            <View
              key={list.id}
              style={[styles.listCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            >
              <View style={styles.listTopRow}>
                <View style={styles.listTitleBlock}>
                  <View style={styles.nameLockRow}>
                    <Text style={[styles.listName, { color: theme.text }]}>{list.name}</Text>
                    {list.isPrivate && (
                      <Ionicons name="lock-closed" size={13} color={theme.textSecondary} style={{ marginLeft: 6 }} />
                    )}
                  </View>
                  {list.description ? (
                    <Text style={[styles.listDesc, { color: theme.textSecondary }]}>{list.description}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[
                    styles.pinBtn,
                    {
                      backgroundColor: list.isPinned
                        ? (theme.primary || COLORS.primary)
                        : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                    },
                  ]}
                  onPress={() => handleTogglePin(list.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={list.isPinned ? 'pin' : 'pin-outline'}
                    size={16}
                    color={list.isPinned ? COLORS.white : theme.text}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.listFooterRow}>
                <View style={styles.footerItem}>
                  <Ionicons name="people-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                    {list.membersCount || 0} members
                  </Text>
                </View>
                {!list.isPrivate && (
                  <View style={styles.footerItem}>
                    <Ionicons name="eye-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                      {list.subscribersCount || 0} subscribers
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.viewFeedBtn}
                  onPress={() => Alert.alert('List Feed', `Viewing custom timeline for "${list.name}".`)}
                >
                  <Text style={[styles.viewFeedText, { color: theme.primary || COLORS.primary }]}>View Feed</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.primary || COLORS.primary} />
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
  activeTabBtn: {},
  tabText: {
    fontSize: 14,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  createTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  createSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
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
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchSub: {
    fontSize: 12,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    marginTop: 20,
  },
  createBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
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
    marginTop: 20,
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
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  listTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  listTitleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  nameLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listName: {
    fontSize: 15,
    fontWeight: '700',
  },
  listDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  pinBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  listFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  footerText: {
    fontSize: 12,
  },
  viewFeedBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewFeedText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 2,
  },
});

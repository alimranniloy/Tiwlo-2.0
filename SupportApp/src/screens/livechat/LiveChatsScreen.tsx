import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SITE_CONFIG, resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type {
  AuthUser,
  LiveChatCounts,
  LiveChatPresence,
  LiveChatSession,
  StaffProfileMe,
} from '../../types/support';
import { formatRelativeTime, getStatusLabel, getStatusTone } from '../../utils/formatters';
import { evaluateLiveChatReplyAccess } from '../../utils/replyGuard';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  MagicSwitch,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from '../ops/QuickPeekModal';

interface LiveChatsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onOpenChat: (chatId: string) => void;
  onWaitingCountChange?: (count: number) => void;
  onPulseSync?: () => void;
}

type ChatTabKey = 'waiting' | 'my_active' | 'all_active' | 'on_hold' | 'closed';

export const LiveChatsScreen: React.FC<LiveChatsScreenProps> = ({
  user,
  staffProfile,
  onOpenChat,
  onWaitingCountChange,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [filterTab, setFilterTab] = useState<ChatTabKey>('waiting');
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<LiveChatSession[]>([]);
  const [counts, setCounts] = useState<LiveChatCounts | null>(null);
  const [presence, setPresence] = useState<LiveChatPresence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [peekChat, setPeekChat] = useState<LiveChatSession | null>(null);

  const loadChats = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const statusParam =
          filterTab === 'my_active' || filterTab === 'all_active' ? 'active' : filterTab;
        const res = await supportService.listLiveChats({
          status: statusParam,
          mine: filterTab === 'my_active',
          q: searchQuery.trim() || undefined,
        });

        let list = res.chats || [];
        if (filterTab === 'my_active') {
          list = list.filter((c) => c.assignedAgentId === user.id);
        }
        setChats(list);
        setCounts(res.counts || null);
        setPresence(res.presence || null);
        onWaitingCountChange?.(res.counts?.waiting ?? 0);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to fetch live chats.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filterTab, onWaitingCountChange, searchQuery, toast, user.id]
  );

  useEffect(() => {
    loadChats(false);
    const interval = setInterval(() => loadChats(true), Math.max(4000, SITE_CONFIG.livePollIntervalMs));
    return () => clearInterval(interval);
  }, [loadChats]);

  const handleTogglePresence = async (next: boolean) => {
    setPresenceBusy(true);
    try {
      await supportService.updatePresence(next);
      setIsOnline(next);
      loadChats(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not toggle status.',
      });
    } finally {
      setPresenceBusy(false);
    }
  };

  const handleAccept = async (chatId: string) => {
    setAcceptingId(chatId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptLiveChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Chat accepted & locked to you.' });
      onOpenChat(chatId);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to accept chat.',
      });
      loadChats(true);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCancel = async (chatId: string) => {
    setAcceptingId(chatId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelLiveChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Live chat dismissed from your queue.' });
      loadChats(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to dismiss chat.',
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const tabItems: { key: ChatTabKey; label: string; count?: number }[] = [
    { key: 'waiting', label: 'Waiting', count: counts?.waiting },
    { key: 'my_active', label: 'My Active', count: counts?.myActive },
    { key: 'all_active', label: 'All Active', count: counts?.active },
    { key: 'on_hold', label: 'On Hold', count: counts?.on_hold },
    { key: 'closed', label: 'Closed', count: counts?.closed },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Flat Header with Inline Presence (No Pill Border) */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.pageTitle, { color: tokens.text }]}>Live Chat</Text>
          <View style={styles.presenceInline}>
            <PulsatingDot color={isOnline ? tokens.accent : tokens.warning} size={6} active={isOnline} />
            <Text style={[styles.subText, { color: tokens.textMuted }]}>
              {presence?.onlineAgentsCount ?? 0} online · {presence?.freeAgentsCount ?? 0} free
            </Text>
          </View>
        </View>

        <View style={styles.switchInline}>
          <Text style={[styles.switchLabel, { color: isOnline ? tokens.accent : tokens.textMuted }]}>
            {isOnline ? 'Online' : 'Away'}
          </Text>
          <MagicSwitch value={isOnline} disabled={presenceBusy} onValueChange={handleTogglePresence} />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <FlatInput
          placeholder="Search visitor, topic, or chat ID"
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
          rightSlot={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={tokens.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      {/* Borderless Hairline Underline Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {tabItems.map((tab) => {
            const active = filterTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.7}
                onPress={() => setFilterTab(tab.key)}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {tab.label}
                  {typeof tab.count === 'number' ? ` (${tab.count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && chats.length === 0 ? (
        <MagicSpinner label="Loading live conversations..." />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadChats(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              No live chats in this queue.
            </Text>
          }
          renderItem={({ item, index }) => {
            const isWaiting = item.status === 'waiting';
            const replyAccess = evaluateLiveChatReplyAccess(item, user, staffProfile);
            return (
              <AnimatedListItem index={index}>
                <TouchableOpacity
                  style={styles.chatRow}
                  activeOpacity={0.65}
                  onLongPress={() => setPeekChat(item)}
                  onPress={() => {
                    if (isWaiting) {
                      setPeekChat(item);
                      return;
                    }
                    onOpenChat(item.id);
                  }}
                >
                  <MagicAvatar
                    name={item.guestName || 'Visitor'}
                    uri={resolveWebsiteUrl(item.userAvatar)}
                    size={36}
                  />

                  <View style={styles.chatRowMain}>
                    <View style={styles.rowTop}>
                      <Text numberOfLines={1} style={[styles.visitorName, { color: tokens.text }]}>
                        {item.guestName || item.guestEmail || 'Guest Visitor'}
                      </Text>
                      <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                        {formatRelativeTime(item.lastMessageAt || item.createdAt)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={[styles.topicText, { color: tokens.textMuted }]}>
                      {item.topic || item.lastMessage || 'Support chat'}
                    </Text>

                    <View style={styles.badgeLine}>
                      <FlatBadge
                        label={getStatusLabel(item.status)}
                        tone={getStatusTone(item.status)}
                        withDot
                      />
                      <FlatBadge
                        label={replyAccess.shortStatusLabel}
                        tone={replyAccess.tone}
                      />
                      {item.assignedAgentName ? (
                        <Text style={[styles.agentText, { color: tokens.textMuted }]}>
                          · {item.assignedAgentName}
                        </Text>
                      ) : null}
                      {item.coBrowseConsent || item.coBrowse?.consent ? (
                        <FlatBadge label="Co-Browse" tone="success" />
                      ) : null}
                    </View>
                  </View>

                  <BorderlessIconButton
                    name="eye"
                    size={16}
                    color={tokens.textMuted}
                    onPress={() => setPeekChat(item)}
                    accessibilityLabel="Quick peek chat"
                  />

                  {isWaiting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ShimmerButton
                        label="Accept"
                        size="xs"
                        variant="accent"
                        loading={acceptingId === item.id}
                        onPress={() => handleAccept(item.id)}
                      />
                      <ShimmerButton
                        label="Cancel"
                        size="xs"
                        variant="subtle"
                        disabled={acceptingId === item.id}
                        onPress={() => handleCancel(item.id)}
                      />
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={16} color={tokens.textMuted} />
                  )}
                </TouchableOpacity>
              </AnimatedListItem>
            );
          }}
        />
      )}

      <QuickPeekModal
        visible={Boolean(peekChat)}
        kind="livechat"
        targetId={peekChat?.id || null}
        initialChat={peekChat}
        user={user}
        staffProfile={staffProfile}
        onClose={() => setPeekChat(null)}
        onOpenFull={(_, id) => {
          setPeekChat(null);
          onOpenChat(id);
        }}
        onChanged={() => {
          loadChats(true);
          onPulseSync?.();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  presenceInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  subText: { fontSize: 11.5 },
  switchInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 18,
    gap: 18,
  },
  tabItem: {
    paddingVertical: 9,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 32,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
  },
  chatRowMain: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeText: { fontSize: 11 },
  topicText: { fontSize: 12.5 },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  agentText: { fontSize: 11 },
});

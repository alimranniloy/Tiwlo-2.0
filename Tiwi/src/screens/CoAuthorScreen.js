import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function CoAuthorScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('invites'); // 'invites' | 'active' | 'new'

  // Invitation Form
  const [partnerHandle, setPartnerHandle] = useState('');
  const [collabNote, setCollabNote] = useState('');

  const [pendingInvites, setPendingInvites] = useState([]);
  const [activeCollabs, setActiveCollabs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCollabs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/coauthor/invitations?userId=${currentUser?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(Array.isArray(data.invitations) ? data.invitations : []);
        setActiveCollabs(Array.isArray(data.activeCollabs) ? data.activeCollabs : []);
      } else {
        setPendingInvites([]);
        setActiveCollabs([]);
      }
    } catch {
      setPendingInvites([]);
      setActiveCollabs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollabs();
  }, [currentUser?.id]);

  const handleAcceptInvite = (id, partnerName) => {
    const invite = pendingInvites.find((i) => i.id === id);
    if (!invite) return;

    setPendingInvites(pendingInvites.filter((i) => i.id !== id));
    setActiveCollabs([
      {
        id: `collab-${Date.now()}`,
        partner: invite.sender,
        title: invite.postTitle,
        publishedDate: 'Just now',
        jointReach: 'Publishing...',
        mutualLikes: '0 Likes',
      },
      ...activeCollabs,
    ]);

    Alert.alert('Collaboration Accepted!', `You and ${partnerName} are now co-authors on this post.`);
  };

  const handleDeclineInvite = (id) => {
    setPendingInvites(pendingInvites.filter((i) => i.id !== id));
    Alert.alert('Invitation Declined', 'The co-author invitation has been removed.');
  };

  const handleSendInvite = () => {
    if (!partnerHandle.trim()) {
      Alert.alert('Partner Required', 'Please enter your collaborator @handle.');
      return;
    }

    setPartnerHandle('');
    setCollabNote('');
    setActiveTab('invites');
    Alert.alert('Invite Sent', 'Your co-author request has been sent to the creator.');
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Co-Authoring & Collabs</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'new' ? 'invites' : 'new')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'new' ? 'close' : 'person-add'} size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'invites' && styles.activeTabBtn]}
          onPress={() => setActiveTab('invites')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'invites' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'invites' && { fontWeight: '700' },
            ]}
          >
            Invites ({pendingInvites.length})
          </Text>
          {activeTab === 'invites' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

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
            Active Collabs ({activeCollabs.length})
          </Text>
          {activeTab === 'active' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
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
            Invite Partner
          </Text>
          {activeTab === 'new' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'new' ? (
          /* SEND CO-AUTHOR INVITE */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <View style={styles.inviteHeaderRow}>
              <Ionicons name="git-merge" size={24} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.inviteTitle, { color: theme.text }]}>Invite a Co-Author</Text>
                <Text style={[styles.inviteSub, { color: theme.textSecondary }]}>
                  Both of your profiles will appear on the post and share metrics
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Partner @handle</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="@collaborator"
              placeholderTextColor={theme.textSecondary}
              value={partnerHandle}
              onChangeText={setPartnerHandle}
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Collaboration Note</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Hey, let's co-author this tech breakdown together!"
              placeholderTextColor={theme.textSecondary}
              value={collabNote}
              onChangeText={setCollabNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleSendInvite}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.sendBtnText}>Send Co-Author Request</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'invites' ? (
          /* PENDING INVITATIONS */
          pendingInvites.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Ionicons name="mail-open-outline" size={44} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Pending Invitations</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                When other creators invite you to co-author posts, they will show up here.
              </Text>
            </View>
          ) : (
            pendingInvites.map((inv) => (
              <View
                key={inv.id}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}
              >
                <View style={styles.partnerRow}>
                  {inv.sender?.avatar && !inv.sender.avatar.includes('unsplash') ? (
                    <Image source={{ uri: inv.sender.avatar }} style={styles.partnerAvatar} />
                  ) : (
                    <View style={[styles.partnerAvatar, { backgroundColor: theme.primary || COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>
                        {(inv.sender?.name || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.partnerName, { color: theme.text }]}>{inv.sender?.name}</Text>
                    <Text style={[styles.partnerHandle, { color: theme.textSecondary }]}>
                      {inv.sender?.handle} • {inv.timeAgo}
                    </Text>
                  </View>
                  <View style={[styles.collabBadge, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                    <Text style={[styles.collabBadgeText, { color: theme.primary || COLORS.primary }]}>
                      Co-Author Invite
                    </Text>
                  </View>
                </View>

                <View style={[styles.postPreviewBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F9FAFB }]}>
                  <Text style={[styles.postPreviewTitle, { color: theme.text }]}>{inv.postTitle}</Text>
                  <Text style={[styles.postPreviewType, { color: theme.textSecondary }]}>{inv.postType}</Text>
                </View>

                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.declineBtn, { borderColor: theme.borderLight }]}
                    onPress={() => handleDeclineInvite(inv.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.declineBtnText, { color: theme.textSecondary }]}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.acceptBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                    onPress={() => handleAcceptInvite(inv.id, inv.sender.name)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark" size={16} color={COLORS.white} style={{ marginRight: 4 }} />
                    <Text style={styles.acceptBtnText}>Accept Co-Author</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : activeCollabs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Ionicons name="people-outline" size={44} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Active Collaborations</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Accepted co-authored posts with shared audience metrics will be cataloged here.
            </Text>
          </View>
        ) : (
          /* ACTIVE COLLABORATIONS */
          activeCollabs.map((collab) => (
            <View
              key={collab.id}
              style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}
            >
              <View style={styles.partnerRow}>
                {collab.partner?.avatar && !collab.partner.avatar.includes('unsplash') ? (
                  <Image source={{ uri: collab.partner.avatar }} style={styles.partnerAvatar} />
                ) : (
                  <View style={[styles.partnerAvatar, { backgroundColor: COLORS.hex_10B981, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 13 }}>
                      {(collab.partner?.name || 'P').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.partnerName, { color: theme.text }]}>Co-authored with {collab.partner?.name}</Text>
                  <Text style={[styles.partnerHandle, { color: theme.textSecondary }]}>
                    {collab.partner?.handle} • Published {collab.publishedDate}
                  </Text>
                </View>
              </View>

              <Text style={[styles.activeTitle, { color: theme.text }]}>{collab.title}</Text>

              <View style={[styles.metricRow, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F9FAFB }]}>
                <View style={styles.metricItem}>
                  <Ionicons name="eye-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.metricVal, { color: theme.text }]}>{collab.jointReach}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="heart-outline" size={15} color={COLORS.hex_E11D48} style={{ marginRight: 4 }} />
                  <Text style={[styles.metricVal, { color: theme.text }]}>{collab.mutualLikes}</Text>
                </View>
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
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  partnerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  partnerHandle: {
    fontSize: 11,
    marginTop: 1,
  },
  collabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  collabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postPreviewBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  postPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  postPreviewType: {
    fontSize: 11,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    gap: 20,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inviteSub: {
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
  textArea: {
    height: 80,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  sendBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  sendBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});

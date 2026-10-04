import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function GroupMembersScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversation = routeParams?.conversation || routeParams;
  const conversationId = conversation?.id || routeParams?.conversationId;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // New member add mode
  const [addingMode, setAddingMode] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      loadMembers();
    }
  }, [conversationId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getGroupMembers(conversationId, currentUser?.id);
      setMembers(data || []);
    } catch (err) {
      console.warn('Failed to load members:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const myMembership = members.find((m) => m.user_id === currentUser?.id);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(myMembership?.role);

  const handleOpenAddMember = async () => {
    setAddingMode(true);
    setLoadingUsers(true);
    try {
      const res = await TiwiAPI.search('', currentUser?.id);
      if (res && res.users) {
        const existingIds = members.map((m) => m.user_id);
        setAllUsers(res.users.filter((u) => !existingIds.includes(u.id)));
      }
    } catch (err) {
      console.warn('Failed to search users:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddMemberToGroup = async (user) => {
    try {
      setActionLoading(true);
      const res = await TiwiAPI.addGroupMember(conversationId, user.id, 'member', currentUser?.id);
      if (res.success) {
        setAddingMode(false);
        await loadMembers();
      } else {
        Alert.alert('Error', res.error || 'Failed to add member');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (targetUserId, newRole) => {
    try {
      setActionLoading(true);
      const res = await TiwiAPI.updateMemberRole(conversationId, targetUserId, newRole, currentUser?.id);
      if (res.success) {
        setSelectedMember(null);
        await loadMembers();
      } else {
        Alert.alert('Error', res.error || 'Failed to update role');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${targetName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const res = await TiwiAPI.removeGroupMember(conversationId, targetUserId, currentUser?.id);
              if (res.success) {
                setSelectedMember(null);
                await loadMembers();
              } else {
                Alert.alert('Error', res.error || 'Failed to remove member');
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to remove member');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const filteredMembers = members.filter((m) =>
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.tiwi_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role) => {
    switch (role) {
      case 'owner':
        return { label: 'Owner', bg: COLORS.primaryLight, text: COLORS.primary };
      case 'admin':
        return { label: 'Admin', bg: COLORS.hex_E6F4EA, text: COLORS.hex_137333 };
      case 'editor':
        return { label: 'Editor', bg: COLORS.hex_FEF7E0, text: COLORS.hex_B06000 };
      default:
        return { label: 'Member', bg: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight, text: theme.textSecondary };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (addingMode) {
              setAddingMode(false);
            } else if (navigation?.goBack) {
              navigation.goBack();
            } else if (onNavigate) {
              onNavigate('back');
            }
          }}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={topTheme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>
          {addingMode ? 'Add Member' : `Members (${members.length})`}
        </Text>
        {!addingMode && isOwnerOrAdmin && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
            onPress={handleOpenAddMember}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color={COLORS.white} style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary || COLORS.hex_757575} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={addingMode ? 'Search contacts to add...' : 'Search members...'}
          placeholderTextColor={theme.textSecondary || COLORS.hex_888888}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Member Management Panel (Dedicated On-Page, NO POPUPS) */}
      {selectedMember && (
        <View style={[styles.actionPanel, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.actionPanelHeader}>
            <Text style={[styles.actionPanelTitle, { color: theme.text }]}>
              Manage {selectedMember.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedMember(null)}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtonsRow}>
            {selectedMember.role !== 'admin' && (
              <TouchableOpacity
                style={[styles.roleActionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.primaryLight }]}
                onPress={() => handleUpdateRole(selectedMember.user_id, 'admin')}
                disabled={actionLoading}
              >
                <Ionicons name="shield-checkmark" size={16} color={COLORS.primary} />
                <Text style={[styles.roleActionText, { color: COLORS.primary }]}>Make Admin</Text>
              </TouchableOpacity>
            )}

            {selectedMember.role !== 'editor' && (
              <TouchableOpacity
                style={[styles.roleActionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.hex_FEF7E0 }]}
                onPress={() => handleUpdateRole(selectedMember.user_id, 'editor')}
                disabled={actionLoading}
              >
                <Ionicons name="create" size={16} color={COLORS.hex_B06000} />
                <Text style={[styles.roleActionText, { color: COLORS.hex_B06000 }]}>Make Editor</Text>
              </TouchableOpacity>
            )}

            {selectedMember.role !== 'member' && (
              <TouchableOpacity
                style={[styles.roleActionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
                onPress={() => handleUpdateRole(selectedMember.user_id, 'member')}
                disabled={actionLoading}
              >
                <Ionicons name="person" size={16} color={theme.textSecondary} />
                <Text style={[styles.roleActionText, { color: theme.text }]}>Set as Member</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.roleActionBtn, { backgroundColor: isDarkMode ? COLORS.rgba_217_48_37_0p15 : COLORS.hex_FCE8E6 }]}
              onPress={() => handleRemoveMember(selectedMember.user_id, selectedMember.name)}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.hex_D93025} />
              <Text style={[styles.roleActionText, { color: COLORS.hex_D93025 }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content List */}
      {addingMode ? (
        loadingUsers ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={allUsers.filter((u) =>
              (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={40} color={theme.textTertiary || COLORS.hex_999999} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users available</Text>
              </View>
            }
            renderItem={({ item }) => {
              const avatar = item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=100`;
              return (
                <View style={[styles.memberRow, { borderBottomColor: theme.borderLight }]}>
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.memberHandle, { color: theme.textSecondary }]}>
                      @{item.handle || item.tiwi_id || 'user'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addMemberBtn, { backgroundColor: COLORS.primary }]}
                    onPress={() => handleAddMemberToGroup(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addMemberBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id || item.user_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getRoleBadge(item.role);
            const avatar = item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=100`;
            const isMe = item.user_id === currentUser?.id;
            const canManage = isOwnerOrAdmin && !isMe && item.role !== 'owner';

            return (
              <TouchableOpacity
                style={[
                  styles.memberRow,
                  { borderBottomColor: theme.borderLight },
                  selectedMember?.user_id === item.user_id && { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight },
                ]}
                onPress={() => {
                  if (canManage) {
                    setSelectedMember(selectedMember?.user_id === item.user_id ? null : item);
                  }
                }}
                activeOpacity={canManage ? 0.7 : 1}
              >
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                  {item.is_online && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.memberName, { color: theme.text }]}>
                      {item.name} {isMe ? '(You)' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.memberHandle, { color: theme.textSecondary }]}>
                    {item.is_online ? 'Active now' : 'Offline'}
                  </Text>
                </View>

                <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.roleBadgeText, { color: badge.text }]}>{badge.label}</Text>
                </View>

                {canManage && (
                  <Ionicons
                    name="ellipsis-vertical"
                    size={18}
                    color={theme.textTertiary || COLORS.hex_888888}
                    style={{ marginLeft: 8 }}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  actionPanel: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleActionText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.hex_34A853,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addMemberBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addMemberBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
});

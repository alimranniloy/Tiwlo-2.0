import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function CreateGroupScreen({ onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await TiwiAPI.search('', currentUser?.id);
      if (res && res.users) {
        setAvailableUsers(res.users.filter((u) => u.id !== currentUser?.id));
      }
    } catch (err) {
      console.warn('Failed to load users for group creation:', err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleSelectUser = (id) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds((prev) => prev.filter((uid) => uid !== id));
    } else {
      setSelectedUserIds((prev) => [...prev, id]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      Alert.alert('Required', 'Please enter a group name');
      return;
    }
    if (selectedUserIds.length === 0) {
      Alert.alert('Members Required', 'Please select at least one member to join the group');
      return;
    }

    try {
      setCreating(true);
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupTitle)}&background=0B57D0&color=fff&size=200&bold=true`;
      const res = await TiwiAPI.createGroupChat(
        groupTitle.trim(),
        selectedUserIds,
        groupAvatar.trim() || defaultAvatar,
        currentUser?.id
      );

      if (res && res.id) {
        if (navigation?.navigate) {
          navigation.navigate('chat-conversation', { conversationId: res.id, conversation: res });
        } else if (onNavigate) {
          onNavigate('chat-conversation', { conversationId: res.id, conversation: res });
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = availableUsers.filter((u) =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.handle || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation?.goBack ? navigation.goBack() : onNavigate?.('back'))}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={topTheme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>New Group</Text>
        <TouchableOpacity
          style={[
            styles.createBtn,
            {
              backgroundColor: groupTitle.trim() && selectedUserIds.length > 0 ? COLORS.primary : (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E0E0E0),
            },
          ]}
          onPress={handleCreateGroup}
          disabled={creating || !groupTitle.trim() || selectedUserIds.length === 0}
          activeOpacity={0.8}
        >
          {creating ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text
              style={[
                styles.createBtnText,
                {
                  color: groupTitle.trim() && selectedUserIds.length > 0 ? COLORS.white : (isDarkMode ? COLORS.hex_888888 : COLORS.hex_757575),
                },
              ]}
            >
              Create
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Group Info Card */}
      <View style={[styles.infoCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="people" size={32} color={COLORS.primary} />
        </View>
        <View style={styles.inputsWrapper}>
          <TextInput
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.borderLight }]}
            placeholder="Group Name"
            placeholderTextColor={theme.textTertiary || COLORS.hex_888888}
            value={groupTitle}
            onChangeText={setGroupTitle}
            maxLength={60}
          />
          <TextInput
            style={[styles.subInput, { color: theme.text }]}
            placeholder="Avatar Image URL (Optional)"
            placeholderTextColor={theme.textTertiary || COLORS.hex_888888}
            value={groupAvatar}
            onChangeText={setGroupAvatar}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Selected Members Chips */}
      {selectedUserIds.length > 0 && (
        <View style={styles.selectedSection}>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            Selected ({selectedUserIds.length})
          </Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={selectedUserIds}
            keyExtractor={(id) => `selected_${id}`}
            contentContainerStyle={styles.chipsContainer}
            renderItem={({ item: id }) => {
              const user = availableUsers.find((u) => u.id === id);
              return (
                <TouchableOpacity
                  style={[styles.userChip, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.primaryLight, borderColor: COLORS.primary }]}
                  onPress={() => toggleSelectUser(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                    {user?.name || 'User'}
                  </Text>
                  <Ionicons name="close-circle" size={16} color={COLORS.primary} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Search Input for Members */}
      <View style={[styles.searchBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary || COLORS.hex_757575} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search people to add..."
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

      {/* User Selection List */}
      {loadingUsers ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={40} color={theme.textTertiary || COLORS.hex_999999} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedUserIds.includes(item.id);
            const avatar = item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=100`;

            return (
              <TouchableOpacity
                style={[styles.userRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => toggleSelectUser(item.id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: avatar }} style={styles.userAvatar} />
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.userHandle, { color: theme.textSecondary }]}>
                    @{item.handle || item.tiwi_id || 'user'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? COLORS.primary : (isDarkMode ? COLORS.hex_555555 : COLORS.hex_CCCCCC),
                      backgroundColor: isSelected ? COLORS.primary : COLORS.named_transparent,
                    },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </View>
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
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  inputsWrapper: {
    flex: 1,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  subInput: {
    fontSize: 13,
    paddingVertical: 6,
  },
  selectedSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    paddingVertical: 4,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 100,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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

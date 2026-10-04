import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function BlockedUsersScreen({ onNavigate }) {
  const { theme, isDarkMode } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);

  const handleUnblock = (user) => {
    Alert.alert(
      `Unblock ${user.name}?`,
      `They will now be able to view your profile and send you messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => {
            setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));
            Alert.alert('Unblocked', `${user.name} has been unblocked.`);
          },
        },
      ]
    );
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Blocked Accounts</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="shield-checkmark-outline" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Blocked Accounts</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              When you block someone, they won't be able to see your profile, posts, or message you.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.userRow, { borderBottomColor: theme.borderLight }]}>
            <Image
              source={{
                uri:
                  item.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
              }}
              style={styles.avatar}
            />
            <View style={styles.userTextCol}>
              <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.userHandle, { color: theme.textMuted }]}>{item.handle || '@user'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.unblockBtn, { borderColor: theme.borderLight }]}
              onPress={() => handleUnblock(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.unblockText, { color: theme.text }]}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

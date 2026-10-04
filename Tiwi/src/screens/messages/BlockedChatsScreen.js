import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function BlockedChatsScreen({ onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    loadBlockedList();
  }, []);

  const loadBlockedList = async () => {
    try {
      setLoading(true);
      // Fetch privacy settings to inspect real blocked array
      const settings = await TiwiAPI.getPrivacySettings(currentUser?.id);
      if (settings && settings.blockedUsers) {
        setBlockedUsers(settings.blockedUsers);
      } else {
        setBlockedUsers([]);
      }
    } catch (err) {
      console.warn('Failed to load blocked list:', err.message);
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = (user) => {
    Alert.alert('Unblock Contact', `Unblock ${user.name}? They will be able to message and call you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => {
          setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));
          Alert.alert('Unblocked', `${user.name} has been unblocked.`);
        },
      },
    ]);
  };

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Blocked Contacts</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Notice */}
      <View style={[styles.infoBanner, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <Ionicons name="shield-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
          Blocked contacts cannot send you messages or start audio/video calls with you.
        </Text>
      </View>

      {/* Blocked List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.hex_34A853} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Blocked Contacts</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                You haven't blocked any accounts. Your inbox and calling are open to all contacts.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const avatar = item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=100`;

            return (
              <View style={[styles.userRow, { borderBottomColor: theme.borderLight }]}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.userDetails}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.userHandle, { color: theme.textSecondary }]}>
                    @{item.handle || item.tiwi_id || 'user'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.unblockBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
                  onPress={() => handleUnblock(item)}
                >
                  <Text style={[styles.unblockBtnText, { color: COLORS.primary }]}>Unblock</Text>
                </TouchableOpacity>
              </View>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
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
  avatar: {
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
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  unblockBtnText: {
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
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});

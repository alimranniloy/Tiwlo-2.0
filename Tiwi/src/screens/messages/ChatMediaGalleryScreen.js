import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 32 - 16) / 3;

export default function ChatMediaGalleryScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversationId = routeParams?.conversationId;
  const chatTitle = routeParams?.title || 'Shared Media';

  const [activeTab, setActiveTab] = useState('media'); // 'media', 'audio', 'docs', 'links'
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      loadMediaMessages();
    }
  }, [conversationId]);

  const loadMediaMessages = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getAllChatMessages(conversationId, currentUser?.id);
      setMessages(data || []);
    } catch (err) {
      console.warn('Failed to load media messages:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter messages by category
  const mediaItems = messages.filter((m) => m.media_url && ['image', 'video'].includes(m.message_type || 'image'));
  const audioItems = messages.filter((m) => m.message_type === 'audio' || (m.media_url && m.media_url.endsWith('.mp3')));
  const docItems = messages.filter((m) => m.message_type === 'file' || (m.media_url && m.media_url.endsWith('.pdf')));
  const linkItems = messages.filter((m) => m.content && (m.content.includes('http://') || m.content.includes('https://')));

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (activeTab === 'media') {
      return (
        <FlatList
          data={mediaItems}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No photos or videos shared yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.gridItem} activeOpacity={0.8}>
              <Image source={{ uri: item.media_url }} style={styles.mediaThumb} />
              {item.message_type === 'video' && (
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={14} color={COLORS.white} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeTab === 'audio') {
      return (
        <FlatList
          data={audioItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mic-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No voice notes shared yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.cardItem, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={styles.cardIconBox}>
                <Ionicons name="volume-medium" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Voice Message</Text>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity style={styles.playBtn} activeOpacity={0.7}>
                <Ionicons name="play" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }

    if (activeTab === 'docs') {
      return (
        <FlatList
          data={docItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No documents shared yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.cardItem, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={[styles.cardIconBox, { backgroundColor: COLORS.hex_FCE8E6 }]}>
                <Ionicons name="document" size={22} color={COLORS.hex_D93025} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.content || 'Document.pdf'}
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>PDF Document</Text>
              </View>
              <TouchableOpacity style={styles.downloadBtn}>
                <Ionicons name="download-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }

    // Links Tab
    return (
      <FlatList
        data={linkItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="link-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No links shared yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.cardItem, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <View style={[styles.cardIconBox, { backgroundColor: COLORS.primaryLight }]}>
              <Ionicons name="globe-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.cardDetails}>
              <Text style={[styles.cardTitle, { color: COLORS.primary }]} numberOfLines={1}>
                {item.content}
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Shared Web Link</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textTertiary || COLORS.hex_888888} />
          </TouchableOpacity>
        )}
      />
    );
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]} numberOfLines={1}>
          {chatTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Material 3 Segmented Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        {[
          { key: 'media', label: 'Media', count: mediaItems.length },
          { key: 'audio', label: 'Audio', count: audioItems.length },
          { key: 'docs', label: 'Docs', count: docItems.length },
          { key: 'links', label: 'Links', count: linkItems.length },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, isActive && [styles.tabBtnActive, { backgroundColor: theme.cardBg }]]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isActive ? COLORS.primary : theme.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Tab Content */}
      {renderContent()}
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
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 4,
    borderRadius: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContent: {
    padding: 16,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: COLORS.rgba_0_0_0_0p6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  playBtn: {
    padding: 8,
  },
  downloadBtn: {
    padding: 8,
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
  },
  emptyText: {
    fontSize: 14,
    marginTop: 10,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import ScreenHeader from './ScreenHeader';
import { COLORS } from '../config/colors';

const DEFAULT_SOUND_COVER = require('../../assets/tiwi.png');

export const POPULAR_SOUNDS = [
  {
    id: 'snd_1',
    title: 'Original sound - Imru • Tiwi Audio',
    artist: 'Imru',
    duration: '0:30',
    videosCount: '14.2K',
    cover: null,
    category: 'Trending',
  },
  {
    id: 'snd_2',
    title: 'Sunset Memories - Lo-Fi Beats',
    artist: 'Zahid Hasan',
    duration: '0:45',
    videosCount: '45.8K',
    cover: null,
    category: 'Lo-Fi',
  },
  {
    id: 'snd_3',
    title: 'Chilled Cow - Ambient Study',
    artist: 'Ayesha Rahman',
    duration: '0:30',
    videosCount: '8.9K',
    cover: null,
    category: 'Lo-Fi',
  },
  {
    id: 'snd_4',
    title: 'Tech Talk Soundbite - Samiul',
    artist: 'Samiul Islam',
    duration: '0:25',
    videosCount: '23.1K',
    cover: null,
    category: 'Trending',
  },
  {
    id: 'snd_5',
    title: 'Bengali Acoustic Rhythms',
    artist: 'Tiwi Originals',
    duration: '0:35',
    videosCount: '62.4K',
    cover: null,
    category: 'Beats',
  },
  {
    id: 'snd_6',
    title: 'Cyberpunk 2026 Future Bass',
    artist: 'Synth Lab',
    duration: '0:30',
    videosCount: '31.2K',
    cover: null,
    category: 'Beats',
  },
  {
    id: 'snd_7',
    title: 'Dhaka Night Drive Vibes',
    artist: 'Urban Soundscape',
    duration: '0:40',
    videosCount: '19.7K',
    cover: null,
    category: 'Top Sounds',
  },
];

export default function SoundSearchModal({ visible, onClose, onSelectSound }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Top Sounds'); // 'Top Sounds' | 'Trending' | 'Lo-Fi' | 'Beats' | 'Saved'
  const [playingSoundId, setPlayingSoundId] = useState(null);
  const [savedMap, setSavedMap] = useState({});

  const categories = ['Top Sounds', 'Trending', 'Lo-Fi', 'Beats', 'Saved'];

  const filteredSounds = POPULAR_SOUNDS.filter((snd) => {
    const matchesQuery =
      snd.title.toLowerCase().includes(query.toLowerCase()) ||
      snd.artist.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (activeTab === 'Saved') return !!savedMap[snd.id];
    if (activeTab === 'Top Sounds') return true;
    return snd.category === activeTab;
  });

  const toggleSave = (id) => {
    setSavedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const togglePlay = (id) => {
    setPlayingSoundId((prev) => (prev === id ? null : id));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: COLORS.black }]}>
        {/* Top Header */}
        <ScreenHeader
          title="Add sound"
          leftIcon="close"
          onLeftPress={onClose}
          isModal={true}
          isImmersive={true}
          customBg={COLORS.black}
        />

        {/* Search Bar */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={19} color={COLORS.hex_8E918F} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search sounds, artists, titles..."
              placeholderTextColor={COLORS.hex_777777}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.hex_8E918F} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryRow}>
          {categories.map((cat) => {
            const isActive = activeTab === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  { backgroundColor: isActive ? COLORS.white : COLORS.hex_272727 },
                ]}
                onPress={() => setActiveTab(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isActive ? COLORS.black : COLORS.hex_CCCCCC },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sounds List */}
        <FlatList
          data={filteredSounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isPlaying = playingSoundId === item.id;
            const isSaved = !!savedMap[item.id];

            return (
              <View style={styles.soundItemRow}>
                {/* Artwork + Play Preview Overlay */}
                <TouchableOpacity
                  style={styles.coverWrapper}
                  onPress={() => togglePlay(item.id)}
                  activeOpacity={0.8}
                >
                  <Image source={item.cover ? { uri: item.cover } : DEFAULT_SOUND_COVER} style={styles.coverImage} />
                  <View style={styles.playOverlay}>
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={18}
                      color={COLORS.white}
                      style={!isPlaying ? { marginLeft: 2 } : {}}
                    />
                  </View>
                </TouchableOpacity>

                {/* Track Details */}
                <TouchableOpacity
                  style={styles.soundInfoCol}
                  onPress={() => togglePlay(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.soundTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.soundArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                  <Text style={styles.soundMeta}>
                    {item.duration} • {item.videosCount} Shorts
                  </Text>
                </TouchableOpacity>

                {/* Save Icon Button */}
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => toggleSave(item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={isSaved ? COLORS.hex_3B82F6 : COLORS.hex_8E918F}
                  />
                </TouchableOpacity>

                {/* YouTube Signature "Use" Button */}
                <TouchableOpacity
                  style={styles.useBtn}
                  onPress={() => {
                    onClose();
                    if (onSelectSound) onSelectSound(item);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.useBtnText}>Use</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={44} color={COLORS.hex_555555} />
              <Text style={styles.emptyTitle}>No sounds found</Text>
              <Text style={styles.emptySubtitle}>Try searching for another artist or track name</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hex_272727,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.hex_1E1F20,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.hex_333537,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14.5,
    height: '100%',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  soundItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hex_222222,
  },
  coverWrapper: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.hex_222222,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.rgba_0_0_0_0p45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  soundTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  soundArtist: {
    color: COLORS.hex_AAAAAA,
    fontSize: 12,
    marginTop: 2,
  },
  soundMeta: {
    color: COLORS.hex_777777,
    fontSize: 11,
    marginTop: 2,
  },
  saveBtn: {
    padding: 8,
    marginRight: 4,
  },
  useBtn: {
    backgroundColor: COLORS.hex_3B82F6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  useBtnText: {
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: COLORS.hex_777777,
    fontSize: 12,
    textAlign: 'center',
  },
});

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

import SharedDrawer from './SharedDrawer';
import { COLORS } from '../config/colors';

export default function RemixModal({ visible, reel, onClose, onSelectOption }) {
  const { theme, isDarkMode } = useAuth();
  const insets = useSafeAreaInsets();

  if (!reel) return null;

  const remixOptions = [
    {
      id: 'sound',
      title: 'Use this sound',
      subtitle: `Use "${reel.audioTitle || 'Original sound'}" in your Short`,
      icon: 'musical-notes-outline',
      iconColor: COLORS.hex_3B82F6,
    },
    {
      id: 'collab',
      title: 'Collab',
      subtitle: 'Record side-by-side or picture-in-picture with this video',
      icon: 'people-outline',
      iconColor: COLORS.hex_10B981,
    },
    {
      id: 'green_screen',
      title: 'Green Screen',
      subtitle: 'Use this video as your custom background',
      icon: 'color-filter-outline',
      iconColor: COLORS.hex_8B5CF6,
    },
    {
      id: 'cut',
      title: 'Cut this video',
      subtitle: 'Sample up to 5 seconds into your Short',
      icon: 'cut-outline',
      iconColor: COLORS.hex_F59E0B,
    },
  ];

  return (
    <SharedDrawer
      visible={visible}
      onClose={onClose}
      showHandle={true}
      scrollable={false}
    >
      <View style={{ paddingHorizontal: 16 }}>
        {/* Target Short Header Preview */}
        <View style={styles.headerRow}>
          <Image
            source={{ uri: reel.videoUrl || reel.image }}
            style={styles.shortThumb}
          />
          <View style={styles.headerTextCol}>
            <Text style={[styles.headerTitleText, { color: isDarkMode ? COLORS.white : COLORS.text }]}>Remix this Short</Text>
            <Text style={styles.headerAuthorText} numberOfLines={1}>
              {reel.author?.name || 'Creator'} • {reel.caption || reel.audioTitle || 'Tiwi Short'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: isDarkMode ? COLORS.hex_333537 : COLORS.hex_E8EAED }]} />

        {/* YouTube Shorts Remix Option Items */}
        {remixOptions.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.optionRow}
            onPress={() => {
              onClose();
              if (onSelectOption) onSelectOption(opt.id, reel);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
              <Ionicons name={opt.icon} size={22} color={opt.iconColor} />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={[styles.optionTitle, { color: isDarkMode ? COLORS.white : COLORS.text }]}>{opt.title}</Text>
              <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.hex_8E918F} />
          </TouchableOpacity>
        ))}
      </View>
    </SharedDrawer>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.rgba_0_0_0_0p6,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 16,
    elevation: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.hex_8E918F,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  shortThumb: {
    width: 44,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.hex_333333,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitleText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  headerAuthorText: {
    color: COLORS.hex_8E918F,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.hex_333537,
    marginVertical: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: COLORS.hex_8E918F,
    fontSize: 11.5,
    marginTop: 2,
  },
});

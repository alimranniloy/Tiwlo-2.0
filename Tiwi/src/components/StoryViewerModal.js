import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/colors';

const { width, height } = Dimensions.get('window');

export default function StoryViewerModal({ visible, story, onClose }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible || !story) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(interval);
          onClose();
          return 1;
        }
        return prev + 0.05;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [visible, story]);

  if (!story) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} translucent />
      <View style={styles.container}>
        {/* Background Story Image */}
        <Image
          source={{ uri: story.mediaUrl || story.avatar }}
          style={styles.storyImage}
          resizeMode="cover"
        />

        {/* Top Overlay Controls */}
        <View style={styles.topOverlay}>
          {/* Progress Bar */}
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>

          {/* User Info & Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.userInfo}>
              <Image source={{ uri: story.avatar }} style={styles.avatar} />
              <View>
                <Text style={styles.userName}>{story.name}</Text>
                <Text style={styles.timeAgo}>3h ago</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Reaction Bar */}
        <View style={styles.bottomOverlay}>
          <TouchableOpacity style={styles.replyBox} onPress={onClose}>
            <Text style={styles.replyPlaceholder}>Send message...</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.heartBtn} onPress={onClose}>
            <Ionicons name="heart" size={28} color={COLORS.hex_EF4444} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
    position: 'relative',
  },
  storyImage: {
    width,
    height,
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  progressBarBackground: {
    width: '100%',
    height: 3,
    backgroundColor: COLORS.rgba_255_255_255_0p3,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  userName: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
  timeAgo: {
    color: COLORS.rgba_255_255_255_0p7,
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyBox: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.rgba_255_255_255_0p4,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  replyPlaceholder: {
    color: COLORS.rgba_255_255_255_0p7,
    fontSize: 14,
  },
  heartBtn: {
    padding: 4,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import TiwiVideoPlayer from './TiwiVideoPlayer';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TEXT_COLORS = [COLORS.white, COLORS.hex_FBBF24, COLORS.hex_38BDF8, COLORS.hex_4ADE80, COLORS.hex_F43F5E, COLORS.hex_A855F7];

export default function CreateStoryModal({ visible, onClose, onStoryCreated }) {
  const { theme, isDarkMode, currentUser, showInAppNotification } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [textColor, setTextColor] = useState(COLORS.white);
  const [uploading, setUploading] = useState(false);

  const handlePickMedia = async (useCamera = false) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.85,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          processPickedAsset(res.assets[0]);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Gallery permission is required.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.85,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          processPickedAsset(res.assets[0]);
        }
      }
    } catch (err) {
      console.warn('Pick media error:', err);
      Alert.alert('Error', 'Could not open media picker.');
    }
  };

  const processPickedAsset = async (asset) => {
    const isVid =
      asset.type === 'video' ||
      (asset.mimeType && asset.mimeType.startsWith('video/')) ||
      /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(asset.fileName || asset.uri);

    setUploading(true);
    try {
      const fileMeta = {
        fileName: asset.fileName || (isVid ? `story_${Date.now()}.mp4` : `story_${Date.now()}.jpg`),
        mimeType: asset.mimeType || (isVid ? 'video/mp4' : 'image/jpeg'),
        mediaType: isVid ? 'video' : 'image',
      };
      const url = await TiwiAPI.uploadMedia(
        asset.uri,
        'stories',
        isVid ? null : asset.base64,
        currentUser?.id,
        fileMeta
      );
      if (url) {
        setSelectedMedia(url);
        setIsVideo(isVid);
      }
    } catch (err) {
      Alert.alert('Upload Failed', err.message || 'Could not upload media');
    } finally {
      setUploading(false);
    }
  };

  const handleShareStory = async () => {
    if (!selectedMedia && !caption.trim()) {
      Alert.alert('Empty Story', 'Please pick a photo/video or write some text for your story.');
      return;
    }

    setUploading(true);
    try {
      const newStory = await TiwiAPI.createStory(
        {
          mediaUrl: selectedMedia || currentUser?.avatar,
          caption: caption.trim(),
        },
        currentUser?.id
      );

      setSelectedMedia(null);
      setCaption('');
      onClose();
      if (showInAppNotification) {
        showInAppNotification({
          title: 'Story Added',
          message: 'Your story is live for 24 hours!',
          type: 'success',
        });
      }
      if (onStoryCreated) onStoryCreated(newStory);
    } catch (err) {
      Alert.alert('Story Failed', err.message || 'Could not post story.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedMedia(null);
    setCaption('');
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: COLORS.black }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} translucent={false} />

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Add to Story</Text>
            <View style={styles.badge24h}>
              <Ionicons name="time-outline" size={11} color={COLORS.hex_A8C7FA} />
              <Text style={styles.badge24hText}>24h</Text>
            </View>
          </View>
          {selectedMedia ? (
            <TouchableOpacity onPress={handleReset} style={styles.iconBtn}>
              <Ionicons name="refresh-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Story Canvas / Preview Area */}
        <View style={styles.canvasContainer}>
          {selectedMedia ? (
            <View style={styles.mediaFrame}>
              {isVideo ? (
                <TiwiVideoPlayer
                  sourceUri={selectedMedia}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  isActive={true}
                  isMuted={false}
                  loop={true}
                />
              ) : (
                <Image source={{ uri: selectedMedia }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              )}
            </View>
          ) : (
            <View style={styles.emptyCanvas}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="sparkles" size={36} color={COLORS.hex_A8C7FA} />
              </View>
              <Text style={styles.emptyCanvasTitle}>Share a moment</Text>
              <Text style={styles.emptyCanvasSub}>
                Capture a photo, pick a video, or add text to your story.
              </Text>

              <View style={styles.pickerButtonsRow}>
                <TouchableOpacity
                  style={styles.pickerActionBtn}
                  onPress={() => handlePickMedia(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={22} color={COLORS.white} />
                  <Text style={styles.pickerActionBtnText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pickerActionBtn, { backgroundColor: COLORS.hex_1A73E8 }]}
                  onPress={() => handlePickMedia(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={22} color={COLORS.white} />
                  <Text style={styles.pickerActionBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Text Overlay Input */}
          <View style={styles.captionOverlay}>
            <TextInput
              style={[styles.captionInput, { color: textColor }]}
              placeholder="Add a caption..."
              placeholderTextColor={COLORS.rgba_255_255_255_0p6}
              multiline
              value={caption}
              onChangeText={setCaption}
            />
          </View>
        </View>

        {/* Color Palette Picker */}
        <View style={styles.paletteRow}>
          {TEXT_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => setTextColor(color)}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                textColor === color && styles.colorCircleSelected,
              ]}
              activeOpacity={0.8}
            />
          ))}
        </View>

        {/* Bottom Action Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.galleryShortcutBtn}
            onPress={() => handlePickMedia(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={22} color={COLORS.white} />
            <Text style={styles.galleryShortcutText}>Media</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.shareStoryBtn,
              { backgroundColor: !selectedMedia && !caption.trim() ? COLORS.hex_333537 : COLORS.primary },
            ]}
            onPress={handleShareStory}
            disabled={uploading || (!selectedMedia && !caption.trim())}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                <Text style={styles.shareStoryBtnText}>Share to Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  badge24h: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.rgba_168_199_250_0p2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badge24hText: {
    color: COLORS.hex_A8C7FA,
    fontSize: 11,
    fontWeight: '700',
  },
  canvasContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.hex_1E1F20,
    position: 'relative',
  },
  mediaFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.rgba_168_199_250_0p15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCanvasTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyCanvasSub: {
    color: COLORS.rgba_255_255_255_0p65,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  pickerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.hex_282A2C,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  pickerActionBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '600',
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: COLORS.rgba_0_0_0_0p45,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  captionInput: {
    fontSize: 15,
    minHeight: 40,
    maxHeight: 100,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: COLORS.white,
    transform: [{ scale: 1.15 }],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.rgba_255_255_255_0p12,
  },
  galleryShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.rgba_255_255_255_0p12,
  },
  galleryShortcutText: {
    color: COLORS.white,
    fontSize: 13.5,
    fontWeight: '600',
  },
  shareStoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shareStoryBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
});

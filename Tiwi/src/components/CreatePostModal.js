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
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function CreatePostModal({ visible, onClose, onPostCreated, onNavigate }) {
  const { theme, isDarkMode, currentUser, showInAppNotification } = useAuth();
  const [caption, setCaption] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [postAsShort, setPostAsShort] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [audience, setAudience] = useState('Public');
  const [selectedFeeling, setSelectedFeeling] = useState(null);
  const [showFeelings, setShowFeelings] = useState(false);
  const [showAiAssist, setShowAiAssist] = useState(false);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);

  const FEELINGS = [
    { label: 'Happy', emoji: '😊' },
    { label: 'Excited', emoji: '🎉' },
    { label: 'Blessed', emoji: '🙏' },
    { label: 'Loved', emoji: '❤️' },
    { label: 'Traveling', emoji: '✈️' },
    { label: 'Coding', emoji: '💻' },
    { label: 'Coffee', emoji: '☕' },
    { label: 'Motivated', emoji: '🚀' },
  ];

  const handleAiAssist = (actionType) => {
    if (!caption.trim()) {
      Alert.alert('AI Assist', 'Please enter some text in your post first so AI can assist you.');
      return;
    }
    setAiAssistLoading(true);
    setTimeout(() => {
      if (actionType === 'polish') {
        const cleaned = caption.trim();
        setCaption(cleaned.charAt(0).toUpperCase() + cleaned.slice(1) + (cleaned.endsWith('.') ? '' : '.'));
      } else if (actionType === 'hook') {
        setCaption((prev) => `🔥 Insight: ${prev.trim()}`);
      } else if (actionType === 'hashtags') {
        const words = caption.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const unique = [...new Set(words)].slice(0, 3).map((w) => `#${w}`).join(' ');
        setCaption((prev) => `${prev.trim()} ${unique || '#community #social'}`);
      }
      setAiAssistLoading(false);
    }, 300);
  };

  const handlePickGalleryImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access your photos and videos is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        const uploadedUrls = [];
        let lastError = null;
        for (const asset of result.assets) {
          try {
            const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/')) || /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(asset.fileName || asset.uri);
            const fileMeta = {
              fileName: asset.fileName || (isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
              mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
              mediaType: isVideo ? 'video' : 'image',
            };
            const url = await TiwiAPI.uploadMedia(
              asset.uri,
              isVideo ? 'reels' : 'posts',
              isVideo ? null : asset.base64,
              currentUser?.id,
              fileMeta
            );
            if (url) {
              uploadedUrls.push(url);
            }
          } catch (uploadErr) {
            console.warn('Single media upload failed:', uploadErr);
            lastError = uploadErr;
          }
        }
        if (uploadedUrls.length > 0) {
          setSelectedImages((prev) => [...prev, ...uploadedUrls].slice(0, 5));
        } else if (lastError) {
          Alert.alert('Upload Failed', lastError.message || 'Failed to upload photo or video.');
        }
      }
    } catch (err) {
      console.error('Error picking post images:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload media.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAppendHashtag = (tag) => {
    setCaption((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const handlePublish = async () => {
    if (!caption.trim() && selectedImages.length === 0) {
      Alert.alert('Empty Post', 'Please write something or attach at least one photo or video.');
      return;
    }

    setLoading(true);
    try {
      const finalCaption = selectedFeeling
        ? `${selectedFeeling.emoji} Feeling ${selectedFeeling.label} — ${caption.trim()}`
        : caption.trim();

      const newPost = await TiwiAPI.createPost({
        caption: finalCaption,
        images: selectedImages,
        image: selectedImages[0] || null,
        userId: currentUser.id,
        audience,
      });

      setCaption('');
      setSelectedImages([]);
      setSelectedFeeling(null);
      setShowFeelings(false);
      setShowAiAssist(false);
      onClose();
      if (showInAppNotification) {
        showInAppNotification({
          title: 'Post Published',
          message: 'Your new post is now live on Tiwi!',
          type: 'success',
        });
      }
      if (onPostCreated) onPostCreated(newPost);
    } catch (err) {
      Alert.alert('Post Failed', err.message || 'Could not create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: topTheme.statusBarBg }]}>
        <StatusBar
          barStyle={topTheme.barStyle}
          backgroundColor={topTheme.statusBarBg}
          translucent={false}
        />
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.cardBg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Create Post</Text>
            <TouchableOpacity
              style={[
                styles.publishBtn,
                { backgroundColor: !caption.trim() && selectedImages.length === 0 ? theme.border : theme.primary },
              ]}
              onPress={handlePublish}
              disabled={loading || uploadingImage || (!caption.trim() && selectedImages.length === 0)}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.publishText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Author Row with Clean Audience Selector */}
          <View style={styles.userRow}>
            <Image
              source={{
                uri:
                  currentUser?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
              }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>{currentUser?.name || 'User'}</Text>
              <View style={styles.audienceRow}>
                <TouchableOpacity
                  style={[
                    styles.audiencePill,
                    { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, borderColor: theme.borderLight },
                  ]}
                  onPress={() => setAudience((prev) => (prev === 'Public' ? 'Followers' : 'Public'))}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={audience === 'Public' ? 'globe-outline' : 'people-outline'}
                    size={12}
                    color={theme.primary}
                  />
                  <Text style={[styles.audienceText, { color: theme.textSecondary }]}>{audience}</Text>
                  <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Active Feeling Badge */}
          {selectedFeeling && (
            <View style={styles.feelingBadgeRow}>
              <View style={[styles.feelingChip, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                <Text style={styles.feelingEmoji}>{selectedFeeling.emoji}</Text>
                <Text style={[styles.feelingText, { color: theme.text }]}>Feeling {selectedFeeling.label}</Text>
                <TouchableOpacity onPress={() => setSelectedFeeling(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* AI Assist Tray */}
          {showAiAssist && (
            <View style={[styles.aiTray, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.inputBackground }]}>
              <View style={styles.aiTrayHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={15} color={COLORS.primary} />
                  <Text style={[styles.aiTrayTitle, { color: theme.text }]}>AI Writing Assist</Text>
                </View>
                {aiAssistLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiChipsScroll}>
                <TouchableOpacity
                  style={[styles.aiChip, { backgroundColor: isDarkMode ? COLORS.hex_2A2B2D : COLORS.white }]}
                  onPress={() => handleAiAssist('polish')}
                  disabled={aiAssistLoading}
                >
                  <Text style={[styles.aiChipText, { color: theme.text }]}>✨ Polish Tone</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiChip, { backgroundColor: isDarkMode ? COLORS.hex_2A2B2D : COLORS.white }]}
                  onPress={() => handleAiAssist('hook')}
                  disabled={aiAssistLoading}
                >
                  <Text style={[styles.aiChipText, { color: theme.text }]}>🔥 Catchy Hook</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiChip, { backgroundColor: isDarkMode ? COLORS.hex_2A2B2D : COLORS.white }]}
                  onPress={() => handleAiAssist('hashtags')}
                  disabled={aiAssistLoading}
                >
                  <Text style={[styles.aiChipText, { color: theme.text }]}># Smart Hashtags</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* Feeling Picker Tray */}
          {showFeelings && (
            <View style={[styles.feelingsTray, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.inputBackground }]}>
              <Text style={[styles.feelingsTrayTitle, { color: theme.textSecondary }]}>HOW ARE YOU FEELING?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feelingsScroll}>
                {FEELINGS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.feelingOptionPill,
                      {
                        backgroundColor: selectedFeeling?.label === item.label
                          ? (theme.primary || COLORS.primary)
                          : (isDarkMode ? COLORS.hex_2A2B2D : COLORS.white),
                      },
                    ]}
                    onPress={() => {
                      setSelectedFeeling(selectedFeeling?.label === item.label ? null : item);
                      setShowFeelings(false);
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                    <Text
                      style={[
                        styles.feelingOptionText,
                        { color: selectedFeeling?.label === item.label ? COLORS.white : theme.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Post Text Input */}
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="What's happening?"
            placeholderTextColor={theme.textMuted}
            multiline
            autoFocus
            value={caption}
            onChangeText={setCaption}
          />

          {/* Selected Images Multi-Preview */}
          {selectedImages.length > 0 && (
            <View style={styles.previewContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewScroll}
              >
                {selectedImages.map((uri, idx) => {
                  const isVid = /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(uri) || uri.includes('/reels/');
                  const thumbUri = isVid ? uri.replace(/\.(mp4|mov|webm|mkv|m4v)(\?|$)/i, '_poster.jpg$2') : uri;
                  return (
                    <View key={`img_${idx}`} style={styles.previewItem}>
                      <Image source={{ uri: thumbUri }} style={styles.previewImage} />
                      {isVid && (
                        <View style={styles.videoPlayBadge} pointerEvents="none">
                          <Ionicons name="play" size={16} color={COLORS.white} />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => handleRemoveImage(idx)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={24} color={COLORS.hex_EF4444} />
                      </TouchableOpacity>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>{idx + 1}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Quick Topic Hashtags */}
          <View style={styles.tagsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
              {['#technology', '#creative', '#photography', '#lifestyle', '#news', '#music'].map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagPill,
                    { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, borderColor: theme.borderLight },
                  ]}
                  onPress={() => handleAppendHashtag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Uploading Image Spinner */}
          {uploadingImage && (
            <View style={styles.uploadingBox}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.uploadingText, { color: theme.textMuted }]}>
                Uploading media to Tiwlo Cloud...
              </Text>
            </View>
          )}

          {/* Google M3 Category Action Toolbar */}
          <View style={[styles.footerToolbar, { borderTopColor: theme.borderLight, backgroundColor: theme.cardBg }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionToolbarScroll}>
              {/* 1. Photos / Video */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                ]}
                onPress={handlePickGalleryImages}
                activeOpacity={0.7}
                disabled={uploadingImage || selectedImages.length >= 5}
              >
                <Ionicons name="images" size={18} color={COLORS.hex_10B981} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>
                  {selectedImages.length === 0 ? 'Photo/Video' : `Media (${selectedImages.length}/5)`}
                </Text>
              </TouchableOpacity>

              {/* 2. Feeling / Activity */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  {
                    backgroundColor: showFeelings || selectedFeeling
                      ? (isDarkMode ? COLORS.hex_383020 : COLORS.hex_FEF3C7)
                      : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                  },
                ]}
                onPress={() => setShowFeelings(!showFeelings)}
                activeOpacity={0.7}
              >
                <Ionicons name="happy" size={18} color={COLORS.hex_F59E0B} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>
                  {selectedFeeling ? selectedFeeling.label : 'Feeling'}
                </Text>
              </TouchableOpacity>

              {/* 3. AI Assist */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  {
                    backgroundColor: showAiAssist
                      ? (isDarkMode ? COLORS.hex_1E293B : COLORS.hex_E0E7FF)
                      : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                  },
                ]}
                onPress={() => setShowAiAssist(!showAiAssist)}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={18} color={COLORS.hex_6366F1} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>AI Assist</Text>
              </TouchableOpacity>

              {/* 4. Live Audio Space */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                ]}
                onPress={() => {
                  onClose();
                  if (onNavigate) onNavigate('audio-space');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="radio" size={18} color={COLORS.hex_EC4899} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>Audio Space</Text>
              </TouchableOpacity>

              {/* 5. Live Poll */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                ]}
                onPress={() => {
                  onClose();
                  if (onNavigate) onNavigate('live-polls');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="bar-chart" size={18} color={COLORS.primary} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>Poll</Text>
              </TouchableOpacity>

              {/* 6. Voice Note */}
              <TouchableOpacity
                style={[
                  styles.categoryActionBtn,
                  { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                ]}
                onPress={() => {
                  onClose();
                  if (onNavigate) onNavigate('voice-notes');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="mic" size={18} color={COLORS.hex_8B5CF6} />
                <Text style={[styles.categoryActionText, { color: theme.text }]}>Voice</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
  closeBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  publishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  publishText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
  },
  audienceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tagsScroll: {
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  previewContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 140,
  },
  previewScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  previewItem: {
    width: 130,
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.hex_0F172A,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  previewBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  videoPlayBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  uploadingText: {
    fontSize: 13,
  },
  feelingBadgeRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
  },
  feelingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  feelingEmoji: {
    fontSize: 15,
  },
  feelingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aiTray: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 10,
  },
  aiTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiTrayTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  aiChipsScroll: {
    gap: 8,
  },
  aiChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.rgba_0_0_0_0p1,
  },
  aiChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feelingsTray: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 10,
  },
  feelingsTrayTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  feelingsScroll: {
    gap: 8,
  },
  feelingOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.rgba_0_0_0_0p08,
  },
  feelingOptionText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  footerToolbar: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionToolbarScroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  categoryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  categoryActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  attachBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  shortToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shortToggleLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});

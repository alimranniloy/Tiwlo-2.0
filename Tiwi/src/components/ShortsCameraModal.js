import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import SoundSearchModal from './SoundSearchModal';
import TiwiVideoPlayer from './TiwiVideoPlayer';
import { LAYOUT } from '../config/layout';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

export default function ShortsCameraModal({
  visible,
  initialSound = null,
  remixMode = null,
  remixReel = null,
  onClose,
  onShortPublished,
}) {
  const { theme, currentUser, showInAppNotification } = useAuth();
  const insets = useSafeAreaInsets();

  // Creation Stage: 'record' | 'edit' | 'publish'
  const [stage, setStage] = useState('record');

  // Sound State
  const [selectedSound, setSelectedSound] = useState(initialSound);
  const [soundSearchVisible, setSoundSearchVisible] = useState(false);

  // Camera Settings
  const [cameraFacing, setCameraFacing] = useState('back'); // 'front' | 'back'
  const [recordingSpeed, setRecordingSpeed] = useState('1x'); // '0.3x' | '0.5x' | '1x' | '2x' | '3x'
  const [maxDuration, setMaxDuration] = useState(15); // 15 or 60 seconds
  const [timerSeconds, setTimerSeconds] = useState(0); // 0 | 3 | 10
  const [activeFilter, setActiveFilter] = useState('Normal');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recordProgress = useRef(new Animated.Value(0)).current;

  // Captured Media State
  const [capturedMedia, setCapturedMedia] = useState(null);

  // Edit Stage Overlay Text
  const [overlayText, setOverlayText] = useState('');
  const [isAddingText, setIsAddingText] = useState(false);

  // Publish Stage Form
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public'); // 'public' | 'unlisted' | 'private'
  const [isUploading, setIsUploading] = useState(false);

  // Sync initial sound if passed
  useEffect(() => {
    if (initialSound) {
      setSelectedSound(initialSound);
    }
  }, [initialSound]);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setStage('record');
      setIsRecording(false);
      setRecordedSeconds(0);
      recordProgress.setValue(0);
      setCapturedMedia(null);
      setOverlayText('');
      setCaption('');
      if (remixMode && remixReel) {
        setCaption(`Remix with @${remixReel.author?.name || 'creator'} #Shorts`);
      }
    }
  }, [visible, remixMode, remixReel]);

  // Recording timer tick
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordedSeconds((prev) => {
          const next = prev + 0.1;
          if (next >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return next;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isRecording, maxDuration]);

  // Animate progress bar
  useEffect(() => {
    if (isRecording) {
      Animated.timing(recordProgress, {
        toValue: 1,
        duration: (maxDuration - recordedSeconds) * 1000,
        useNativeDriver: false,
      }).start();
    } else {
      recordProgress.stopAnimation();
    }
  }, [isRecording, maxDuration]);

  // Start Recording
  const startRecording = () => {
    setIsRecording(true);
  };

  // Stop Recording
  const stopRecording = () => {
    setIsRecording(false);
    // This modal has no native camera recorder wired in. Never publish a demo
    // video as if it were recorded by the user.
    if (!capturedMedia) {
      Alert.alert('Select a video', 'Recording is not available in this build yet. Choose a real video from your gallery.');
    }
  };

  // Toggle Record
  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (timerSeconds > 0) {
        Alert.alert(`Timer ${timerSeconds}s`, 'Recording will start in 3 seconds...', [
          { text: 'Start', onPress: startRecording },
        ]);
      } else {
        startRecording();
      }
    }
  };

  // Pick Media from Gallery
  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow gallery access to upload a Short.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCapturedMedia(asset);
        setStage('edit');
      }
    } catch (err) {
      Alert.alert('Gallery Error', err.message || 'Failed to select media.');
    }
  };

  // Publish to Real Backend
  const handlePublish = async () => {
    if (!capturedMedia && !caption.trim()) {
      Alert.alert('Missing Info', 'Please record/select a video and write a caption.');
      return;
    }

    setIsUploading(true);
    try {
      const isVideo = capturedMedia?.type === 'video' ||
        (capturedMedia?.mimeType && capturedMedia.mimeType.startsWith('video/')) ||
        /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(capturedMedia?.fileName || capturedMedia?.uri || '');
      let finalMediaUrl = capturedMedia?.uri || '';
      if (capturedMedia?.base64 || capturedMedia?.uri) {
        const fileMeta = {
          fileName: capturedMedia?.fileName || (isVideo ? `short_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
          mimeType: capturedMedia?.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          mediaType: isVideo ? 'video' : 'image',
        };
        finalMediaUrl = await TiwiAPI.uploadMedia(capturedMedia.uri, 'reels', isVideo ? null : capturedMedia.base64, currentUser?.id, fileMeta);
      }

      const audioTitle = selectedSound?.title || `Original sound - ${currentUser?.name || 'Creator'}`;

      const newReel = await TiwiAPI.createReel({
        caption: caption.trim() || 'My new Short 🚀 #Shorts',
        videoUrl: isVideo ? finalMediaUrl : null,
        image: finalMediaUrl,
        audioTitle,
        userId: currentUser?.id,
      });

      if (showInAppNotification) {
        showInAppNotification({
          title: 'Short Published! 🚀',
          message: 'Your Short is now live on Tiwi Shorts feed.',
          type: 'success',
        });
      }
      if (onShortPublished) onShortPublished(newReel);
      onClose();
    } catch (err) {
      Alert.alert('Publish Error', err.message || 'Could not publish Short.');
    } finally {
      setIsUploading(false);
    }
  };

  const speedOptions = ['0.5x', '1x', '2x'];
  const filters = ['Normal', 'Vibrant', 'Vintage', 'B&W', 'Warm', 'Glow'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} translucent={true} />
      <View style={[styles.root, { backgroundColor: COLORS.black, paddingTop: LAYOUT.getModalTopSpacing(insets) }]}>
        {/* ============================================================ */}
        {/* STAGE 1: YOUTUBE SHORTS CAMERA VIEWFINDER & RECORDING */}
        {/* ============================================================ */}
        {stage === 'record' && (
          <View style={styles.stageContainer}>
            {/* 1. Thin Red Progress Bar at the Very Top */}
            <View style={styles.topProgressTrack}>
              <Animated.View
                style={[
                  styles.topProgressBar,
                  {
                    width: recordProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* 2. Top Controls Overlay */}
            <View style={styles.cameraTopRow}>
              {/* Close Button */}
              <TouchableOpacity onPress={onClose} style={styles.camIconBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={26} color={COLORS.white} />
              </TouchableOpacity>

              {/* YouTube Signature "Add sound 🎵" Pill Button */}
              <TouchableOpacity
                style={styles.soundPillBtn}
                onPress={() => setSoundSearchVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="musical-notes" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.soundPillText} numberOfLines={1}>
                  {selectedSound ? selectedSound.title : 'Add sound'}
                </Text>
                {!!selectedSound && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedSound(null);
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons name="close-circle" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Max Duration Toggle (15s / 60s) */}
              <TouchableOpacity
                style={styles.durationPill}
                onPress={() => setMaxDuration((prev) => (prev === 15 ? 60 : 15))}
                activeOpacity={0.7}
              >
                <Text style={styles.durationPillText}>{maxDuration}s</Text>
              </TouchableOpacity>
            </View>

            {/* 3. Right Side Camera Tools Column */}
            <View style={styles.cameraRightTools}>
              {/* Flip Camera */}
              <TouchableOpacity
                style={styles.camToolItem}
                onPress={() => setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-reverse-outline" size={24} color={COLORS.white} />
                <Text style={styles.camToolLabel}>Flip</Text>
              </TouchableOpacity>

              {/* Speed Selector */}
              <TouchableOpacity
                style={styles.camToolItem}
                onPress={() => {
                  const idx = speedOptions.indexOf(recordingSpeed);
                  setRecordingSpeed(speedOptions[(idx + 1) % speedOptions.length]);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="speedometer-outline" size={24} color={COLORS.white} />
                <Text style={styles.camToolLabel}>{recordingSpeed}</Text>
              </TouchableOpacity>

              {/* Timer */}
              <TouchableOpacity
                style={styles.camToolItem}
                onPress={() => setTimerSeconds((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0))}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={timerSeconds > 0 ? 'timer' : 'timer-outline'}
                  size={24}
                  color={timerSeconds > 0 ? COLORS.hex_3B82F6 : COLORS.white}
                />
                <Text style={styles.camToolLabel}>{timerSeconds > 0 ? `${timerSeconds}s` : 'Timer'}</Text>
              </TouchableOpacity>

              {/* Filters */}
              <TouchableOpacity
                style={styles.camToolItem}
                onPress={() => setShowFilterDrawer(!showFilterDrawer)}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles-outline" size={24} color={COLORS.white} />
                <Text style={styles.camToolLabel}>Filters</Text>
              </TouchableOpacity>

              {/* Green Screen */}
              <TouchableOpacity
                style={styles.camToolItem}
                onPress={() => Alert.alert('Green Screen', 'Green Screen mode active! Choose a backdrop.')}
                activeOpacity={0.7}
              >
                <Ionicons name="color-filter-outline" size={24} color={COLORS.white} />
                <Text style={styles.camToolLabel}>Green Screen</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Drawer Popup */}
            {showFilterDrawer && (
              <View style={styles.filterDrawer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
                  {filters.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.filterChip,
                        { backgroundColor: activeFilter === f ? COLORS.shortsAccent : COLORS.rgba_0_0_0_0p6 },
                      ]}
                      onPress={() => setActiveFilter(f)}
                    >
                      <Text style={styles.filterChipText}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 4. Center Viewfinder Simulation */}
            <View style={styles.viewfinderCenter}>
              {remixMode && (
                <View style={styles.remixBadge}>
                  <Ionicons name="flash" size={13} color={COLORS.white} style={{ marginRight: 4 }} />
                  <Text style={styles.remixBadgeText}>Remixing: {remixMode.toUpperCase()}</Text>
                </View>
              )}
              {isRecording && (
                <View style={styles.recordingLiveIndicator}>
                  <View style={styles.recordingRedDot} />
                  <Text style={styles.recordingLiveText}>
                    {recordedSeconds.toFixed(1)}s / {maxDuration}s
                  </Text>
                </View>
              )}
            </View>

            {/* 5. Bottom Controls Bar: Gallery, Big Red Record Button, Next Checkmark */}
            <View style={[styles.cameraBottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              {/* Gallery Import Button */}
              <TouchableOpacity
                style={styles.galleryBtn}
                onPress={handlePickGallery}
                activeOpacity={0.8}
              >
                <Ionicons name="images-outline" size={24} color={COLORS.white} />
                <Text style={styles.galleryBtnText}>Gallery</Text>
              </TouchableOpacity>

              {/* YouTube Signature Big Red Circular Record Button */}
              <TouchableOpacity
                style={[styles.recordBtnOuter, isRecording && styles.recordBtnOuterActive]}
                onPress={handleToggleRecord}
                activeOpacity={0.9}
              >
                <View style={[styles.recordBtnInner, isRecording && styles.recordBtnInnerActive]} />
              </TouchableOpacity>

              {/* Next Checkmark Button (Enabled once recorded or media picked) */}
              <TouchableOpacity
                style={[
                  styles.nextCheckBtn,
                  { opacity: recordedSeconds > 0 || capturedMedia ? 1 : 0.3 },
                ]}
                disabled={recordedSeconds === 0 && !capturedMedia}
                onPress={() => setStage('edit')}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={26} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* STAGE 2: PREVIEW & EDITING (Text Overlays, Sound, Filters) */}
        {/* ============================================================ */}
        {stage === 'edit' && (
          <View style={styles.stageContainer}>
            {/* Top Bar */}
            <View style={styles.editTopRow}>
              <TouchableOpacity onPress={() => setStage('record')} style={styles.camIconBtn}>
                <Ionicons name="arrow-back" size={24} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.soundPillBtn}
                onPress={() => setSoundSearchVisible(true)}
              >
                <Ionicons name="musical-notes" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.soundPillText} numberOfLines={1}>
                  {selectedSound ? selectedSound.title : 'Sound'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextStageBtn}
                onPress={() => setStage('publish')}
                activeOpacity={0.8}
              >
                <Text style={styles.nextStageBtnText}>Next</Text>
              </TouchableOpacity>
            </View>

            {/* Video Preview Center */}
            <View style={styles.editPreviewCenter}>
              {capturedMedia ? (
                capturedMedia?.type === 'video' || /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(capturedMedia.uri) ? (
                  <TiwiVideoPlayer
                    sourceUri={capturedMedia.uri}
                    style={styles.previewImage}
                    resizeMode="cover"
                    isActive={stage === 'edit'}
                    isMuted={false}
                    loop={true}
                    showControls={false}
                  />
                ) : (
                  <Image source={{ uri: capturedMedia.uri }} style={styles.previewImage} resizeMode="cover" />
                )
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Ionicons name="videocam" size={60} color={COLORS.shortsAccent} />
                </View>
              )}

              {/* Custom Overlay Text if added */}
              {!!overlayText && (
                <View style={styles.overlayTextContainer}>
                  <Text style={styles.overlayTextContent}>{overlayText}</Text>
                </View>
              )}
            </View>

            {/* Editing Tools Drawer at Bottom */}
            <View style={[styles.editBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              {/* Add Text Tool */}
              <TouchableOpacity
                style={styles.editToolBtn}
                onPress={() => setIsAddingText(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="text-outline" size={22} color={COLORS.white} />
                <Text style={styles.editToolLabel}>Text</Text>
              </TouchableOpacity>

              {/* Filters Tool */}
              <TouchableOpacity
                style={styles.editToolBtn}
                onPress={() => Alert.alert('Filters', 'Filter preset applied.')}
                activeOpacity={0.7}
              >
                <Ionicons name="color-wand-outline" size={22} color={COLORS.white} />
                <Text style={styles.editToolLabel}>Filters</Text>
              </TouchableOpacity>

              {/* Audio Mixer Tool */}
              <TouchableOpacity
                style={styles.editToolBtn}
                onPress={() => Alert.alert('Audio Mixer', 'Voiceover: 100% | Sound Track: 80%')}
                activeOpacity={0.7}
              >
                <Ionicons name="volume-high-outline" size={22} color={COLORS.white} />
                <Text style={styles.editToolLabel}>Volume</Text>
              </TouchableOpacity>
            </View>

            {/* Text Overlay Input Modal */}
            {isAddingText && (
              <View style={styles.textInputOverlay}>
                <TextInput
                  style={styles.overlayTextInput}
                  placeholder="Type text overlay..."
                  placeholderTextColor={COLORS.hex_888888}
                  value={overlayText}
                  onChangeText={setOverlayText}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.doneTextBtn}
                  onPress={() => setIsAddingText(false)}
                >
                  <Text style={styles.doneTextBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* STAGE 3: FINALIZE & PUBLISH (Caption, Visibility, Upload) */}
        {/* ============================================================ */}
        {stage === 'publish' && (
          <View style={styles.stageContainer}>
            {/* Top Bar */}
            <View style={styles.publishHeader}>
              <TouchableOpacity onPress={() => setStage('edit')} style={styles.camIconBtn}>
                <Ionicons name="arrow-back" size={24} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={styles.publishHeaderTitle}>Upload Short</Text>
              <View style={{ width: 36 }} />
            </View>

            <ScrollView contentContainerStyle={styles.publishContent} showsVerticalScrollIndicator={false}>
              {/* Media Preview + Caption Input Row */}
              <View style={styles.publishMediaRow}>
                <View style={styles.publishThumbWrapper}>
                  {capturedMedia && (
                    <Image source={{ uri: capturedMedia.uri }} style={styles.publishThumbImage} />
                  )}
                  <View style={styles.editThumbBadge}>
                    <Text style={styles.editThumbText}>Thumbnail</Text>
                  </View>
                </View>

                <View style={styles.captionInputCol}>
                  <TextInput
                    style={styles.publishCaptionInput}
                    placeholder="Caption your Short (#Shorts, #Trending)..."
                    placeholderTextColor={COLORS.hex_777777}
                    multiline
                    value={caption}
                    onChangeText={setCaption}
                  />
                </View>
              </View>

              {/* Quick Hashtags Chips */}
              <View style={styles.hashtagRow}>
                {['#Shorts', '#Viral', '#Tiwi', '#Trending', '#Tech'].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tagChip}
                    onPress={() => setCaption((prev) => `${prev} ${tag}`.trim())}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.publishDivider} />

              {/* Sound Attached Indicator */}
              {selectedSound && (
                <View style={styles.publishSettingRow}>
                  <Ionicons name="musical-notes" size={20} color={COLORS.shortsAccent} />
                  <View style={styles.settingTextCol}>
                    <Text style={styles.settingTitle}>Sound</Text>
                    <Text style={styles.settingSub} numberOfLines={1}>
                      {selectedSound.title}
                    </Text>
                  </View>
                </View>
              )}

              {/* Visibility Setting */}
              <TouchableOpacity
                style={styles.publishSettingRow}
                onPress={() => {
                  const next = visibility === 'public' ? 'unlisted' : visibility === 'unlisted' ? 'private' : 'public';
                  setVisibility(next);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={visibility === 'public' ? 'globe-outline' : visibility === 'unlisted' ? 'link-outline' : 'lock-closed-outline'}
                  size={20}
                  color={COLORS.white}
                />
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Visibility</Text>
                  <Text style={styles.settingSub}>
                    {visibility === 'public' ? 'Public (Anyone can search and view)' : visibility === 'unlisted' ? 'Unlisted (Anyone with link)' : 'Private (Only you)'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.hex_666666} />
              </TouchableOpacity>

              {/* Audience Setting */}
              <View style={styles.publishSettingRow}>
                <Ionicons name="people-outline" size={20} color={COLORS.white} />
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Audience</Text>
                  <Text style={styles.settingSub}>No, it's not made for kids</Text>
                </View>
              </View>

              {/* Red Upload Short Button */}
              <TouchableOpacity
                style={styles.uploadSubmitBtn}
                onPress={handlePublish}
                disabled={isUploading}
                activeOpacity={0.85}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.uploadSubmitText}>Upload Short</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Sound Search Modal Overlay */}
        <SoundSearchModal
          visible={soundSearchVisible}
          onClose={() => setSoundSearchVisible(false)}
          onSelectSound={(snd) => {
            setSelectedSound(snd);
            setSoundSearchVisible(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stageContainer: {
    flex: 1,
    position: 'relative',
  },
  // Progress Bar
  topProgressTrack: {
    height: 4,
    backgroundColor: COLORS.hex_333333,
    width: '100%',
  },
  topProgressBar: {
    height: '100%',
    backgroundColor: COLORS.shortsAccent,
  },
  // Camera Top Row
  cameraTopRow: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    zIndex: 20,
  },
  camIconBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    maxWidth: '65%',
    borderWidth: 1,
    borderColor: COLORS.rgba_255_255_255_0p2,
  },
  soundPillText: {
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '700',
  },
  durationPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.rgba_255_255_255_0p2,
  },
  durationPillText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  // Camera Right Tools
  cameraRightTools: {
    position: 'absolute',
    top: 70,
    right: 12,
    gap: 18,
    alignItems: 'center',
    zIndex: 20,
  },
  camToolItem: {
    alignItems: 'center',
    gap: 4,
  },
  camToolLabel: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: COLORS.rgba_0_0_0_0p8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Filter Drawer
  filterDrawer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  // Viewfinder
  viewfinderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 20,
  },
  remixBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  recordingLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_255_0_0_0p8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  recordingRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
  recordingLiveText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  // Camera Bottom Bar
  cameraBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  galleryBtn: {
    alignItems: 'center',
    gap: 4,
    width: 50,
  },
  galleryBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  recordBtnOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnOuterActive: {
    borderColor: COLORS.shortsAccent,
  },
  recordBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.shortsAccent,
  },
  recordBtnInnerActive: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.shortsAccent,
  },
  nextCheckBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.shortsAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Edit Stage
  editTopRow: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
  },
  nextStageBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
  },
  nextStageBtnText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: 13.5,
  },
  editPreviewCenter: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.hex_1E1E1E,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTextContainer: {
    position: 'absolute',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.rgba_0_0_0_0p6,
    borderRadius: 10,
  },
  overlayTextContent: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  editBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    paddingTop: 16,
  },
  editToolBtn: {
    alignItems: 'center',
    gap: 4,
  },
  editToolLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  textInputOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: COLORS.hex_1E1E1E,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    zIndex: 50,
  },
  overlayTextInput: {
    color: COLORS.white,
    fontSize: 16,
    minHeight: 50,
  },
  doneTextBtn: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.shortsAccent,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  doneTextBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  // Publish Stage
  publishHeader: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hex_272727,
  },
  publishHeaderTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  publishContent: {
    padding: 16,
    gap: 16,
  },
  publishMediaRow: {
    flexDirection: 'row',
    gap: 14,
  },
  publishThumbWrapper: {
    width: 80,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.hex_272727,
    position: 'relative',
  },
  publishThumbImage: {
    width: '100%',
    height: '100%',
  },
  editThumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.rgba_0_0_0_0p7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  editThumbText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  captionInputCol: {
    flex: 1,
    backgroundColor: COLORS.hex_1E1E1E,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.hex_333333,
  },
  publishCaptionInput: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 20,
    height: '100%',
    textAlignVertical: 'top',
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: COLORS.hex_272727,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    color: COLORS.shortsAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  publishDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.hex_272727,
  },
  publishSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
  settingSub: {
    color: COLORS.hex_888888,
    fontSize: 12,
    marginTop: 2,
  },
  uploadSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.shortsAccent,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 20,
    shadowColor: COLORS.shortsAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  uploadSubmitText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

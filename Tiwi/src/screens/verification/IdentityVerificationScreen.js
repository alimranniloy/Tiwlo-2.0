import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function IdentityVerificationScreen({ onNavigate }) {
  const { theme, isDarkMode } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  // Steps: 1 (Select), 2 (Upload), 3 (Selfie), 4 (Processing), 5 (Success), 6 (Failed)
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDoc, setSelectedDoc] = useState('passport');
  const [docImage, setDocImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [testOutcome, setTestOutcome] = useState('success'); // 'success' | 'failed'

  const pickDocumentImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are needed to select your document.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDocImage(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Selection Error', 'Could not open image picker.');
    }
  };

  const launchCameraSelfie = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Needed', 'Please allow camera access to take your selfie.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelfieImage(result.assets[0].uri);
        // Advance to processing step
        setCurrentStep(4);
        setTimeout(() => {
          setCurrentStep(testOutcome === 'failed' ? 6 : 5);
        }, 3200);
      }
    } catch (e) {
      Alert.alert('Camera Error', 'Could not launch camera.');
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && currentStep <= 4) {
      setCurrentStep(currentStep - 1);
    } else if (currentStep === 6) {
      setCurrentStep(1);
    } else if (onNavigate) {
      onNavigate('back');
    }
  };

  // Stepper dots
  const renderStepIndicator = () => (
    <View style={styles.stepperContainer}>
      {[1, 2, 3, 4, 5].map((s) => {
        const isActive = s === Math.min(currentStep, 5);
        return (
          <View
            key={s}
            style={[
              styles.stepDot,
              isActive ? styles.stepDotActive : styles.stepDotInactive,
              isActive && { backgroundColor: COLORS.hex_1D9BF0 },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header - Rendered only on steps 1, 2, and 3 matching reference image */}
      {currentStep <= 3 && (
        <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Identity Verification</Text>
          <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
        </View>
      )}

      {/* Stepper (Steps 1 to 4 only) */}
      {currentStep <= 4 && renderStepIndicator()}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* STEP 1: Select Document */}
        {currentStep === 1 && (
          <View style={styles.stepBlock}>
            <Text style={[styles.mainHeading, { color: theme.text }]}>
              Choose your{'\n'}government document
            </Text>
            <Text style={[styles.subHeading, { color: theme.textSecondary }]}>
              We need a valid government-issued document to verify your identity. Please select one of the following options.
            </Text>

            {/* Document Options */}
            <View style={styles.docList}>
              {/* Passport */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedDoc('passport');
                  setCurrentStep(2);
                }}
                style={[
                  styles.docCard,
                  { backgroundColor: theme.cardBg, borderColor: selectedDoc === 'passport' ? COLORS.hex_1D9BF0 : theme.borderLight },
                ]}
                activeOpacity={0.75}
              >
                <View style={[styles.docIconWrap, { backgroundColor: '#142850', borderRadius: 8, padding: 4 }]}>
                  <View style={{ width: 34, height: 42, borderWidth: 1, borderColor: '#E6C65B', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#E6C65B', marginBottom: 2 }} />
                    <Text style={{ fontSize: 6, fontWeight: '700', color: '#F3E5AB' }}>PASSPORT</Text>
                  </View>
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docTitle, { color: theme.text }]}>Passport</Text>
                  <Text style={[styles.docSub, { color: theme.textSecondary }]}>International passport{'\n'}(cover page)</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* National ID */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedDoc('national_id');
                  setCurrentStep(2);
                }}
                style={[
                  styles.docCard,
                  { backgroundColor: theme.cardBg, borderColor: selectedDoc === 'national_id' ? COLORS.hex_1D9BF0 : theme.borderLight },
                ]}
                activeOpacity={0.75}
              >
                <View style={[styles.docIconWrap, { backgroundColor: '#0D5C3A', borderRadius: 8, padding: 4 }]}>
                  <View style={{ width: 40, height: 28, borderWidth: 1, borderColor: '#34D399', borderRadius: 4, padding: 3, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 12, backgroundColor: '#E2E8F0', borderRadius: 2, marginRight: 4 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ width: '80%', height: 2, backgroundColor: '#FFFFFF', marginBottom: 2, borderRadius: 1 }} />
                      <View style={{ width: '60%', height: 2, backgroundColor: '#FFFFFF', opacity: 0.7, borderRadius: 1 }} />
                    </View>
                  </View>
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docTitle, { color: theme.text }]}>National ID Card</Text>
                  <Text style={[styles.docSub, { color: theme.textSecondary }]}>Government-issued{'\n'}national ID card</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Aadhaar Card */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedDoc('aadhaar');
                  setCurrentStep(2);
                }}
                style={[
                  styles.docCard,
                  { backgroundColor: theme.cardBg, borderColor: selectedDoc === 'aadhaar' ? COLORS.hex_1D9BF0 : theme.borderLight },
                ]}
                activeOpacity={0.75}
              >
                <View style={[styles.docIconWrap, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 8, padding: 4 }]}>
                  <View style={{ width: 40, height: 28, borderRadius: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: '100%', height: 2, backgroundColor: '#F97316' }} />
                    <View style={{ width: '100%', height: 1.5, backgroundColor: '#FFFFFF' }} />
                    <View style={{ width: '100%', height: 2, backgroundColor: '#16A34A', marginBottom: 2 }} />
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
                    </View>
                  </View>
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docTitle, { color: theme.text }]}>Aadhaar Card</Text>
                  <Text style={[styles.docSub, { color: theme.textSecondary }]}>Indian Aadhaar card{'\n'}(front and back)</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Security note */}
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[styles.securityText, { color: theme.textSecondary }]}>
                Your information is secure and will only be used for identity verification purposes.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 2: Upload Document */}
        {currentStep === 2 && (
          <View style={styles.stepBlock}>
            {/* Tilted Passport + ID Card on Soft Blue Blob */}
            <View style={styles.illustrationHero}>
              <View style={{ width: 140, height: 110, borderRadius: 55, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' }}>
                {/* Tilted Passport Left */}
                <View style={{ position: 'absolute', left: 16, top: 18, width: 48, height: 68, backgroundColor: '#1E3A8A', borderRadius: 6, transform: [{ rotate: '-12deg' }], padding: 4, alignItems: 'center', elevation: 4 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#FDE047', marginTop: 12 }} />
                  <Text style={{ color: '#FEF08A', fontSize: 5, fontWeight: 'bold', marginTop: 4 }}>PASSPORT</Text>
                </View>
                {/* Tilted ID Card Right */}
                <View style={{ position: 'absolute', right: 12, top: 32, width: 58, height: 40, backgroundColor: '#FFFFFF', borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', transform: [{ rotate: '8deg' }], padding: 4, elevation: 5 }}>
                  <View style={{ width: '100%', height: 5, backgroundColor: '#3B82F6', borderRadius: 2, marginBottom: 4 }} />
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: 12, height: 16, backgroundColor: '#E2E8F0', borderRadius: 2, marginRight: 4 }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ width: '90%', height: 2, backgroundColor: '#0F172A', marginBottom: 2 }} />
                      <View style={{ width: '60%', height: 2, backgroundColor: '#64748B' }} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[styles.mainHeadingCenter, { color: theme.text }]}>
              Upload your document
            </Text>
            <Text style={[styles.subHeadingCenter, { color: theme.textSecondary }]}>
              Take a clear photo or upload a scanned copy of your passport, national ID card or Aadhaar card. Make sure all details are visible and readable.
            </Text>

            {/* Upload Zone */}
            <TouchableOpacity
              onPress={pickDocumentImage}
              style={[
                styles.uploadZone,
                { borderColor: docImage ? COLORS.hex_1D9BF0 : COLORS.hex_BFDBFE, backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' },
              ]}
              activeOpacity={0.8}
            >
              {docImage ? (
                <Image source={{ uri: docImage }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <View style={styles.uploadPrompt}>
                  <View style={styles.cloudCircle}>
                    <Ionicons name="cloud-upload-outline" size={26} color={COLORS.hex_1D9BF0} />
                  </View>
                  <Text style={[styles.uploadText, { color: theme.text }]}>Tap to upload</Text>
                  <Text style={[styles.uploadSub, { color: theme.textSecondary }]}>JPG, PNG or PDF • Max 10MB</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCurrentStep(3)}
              style={styles.primaryBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert('Help', 'Ensure adequate lighting without glare.')}
              style={styles.helpLink}
            >
              <Text style={styles.helpLinkText}>Need help?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Capture Selfie */}
        {currentStep === 3 && (
          <View style={styles.stepBlock}>
            {/* Viewfinder Circle */}
            <View style={styles.selfieCircleContainer}>
              <View style={[styles.selfieOuterRing, { borderColor: '#2563EB', borderWidth: 4 }]}>
                {selfieImage ? (
                  <Image source={{ uri: selfieImage }} style={styles.selfieImage} />
                ) : (
                  <Image
                    source={require('../../../assets/sample-selfie.jpg')}
                    style={styles.selfieImage}
                  />
                )}
              </View>
            </View>

            <Text style={[styles.mainHeadingCenter, { color: theme.text }]}>
              Take a selfie
            </Text>
            <Text style={[styles.subHeadingCenter, { color: theme.textSecondary }]}>
              Please <Text style={{ fontWeight: 'bold', color: theme.text }}>take a clear selfie</Text> of yourself. Make sure your face is fully visible and well lit. No sunglasses or hats.
            </Text>

            {/* Bottom Camera Controls */}
            <View style={styles.cameraControls}>
              <TouchableOpacity onPress={pickDocumentImage} style={styles.smallCtrlBtn}>
                <Ionicons name="images-outline" size={22} color={theme.text} />
              </TouchableOpacity>

              <TouchableOpacity onPress={launchCameraSelfie} style={styles.shutterBtn}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <TouchableOpacity onPress={launchCameraSelfie} style={styles.smallCtrlBtn}>
                <Ionicons name="camera-reverse-outline" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 4: Processing */}
        {currentStep === 4 && (
          <View style={styles.stepBlock}>
            <View style={styles.processingSpinnerContainer}>
              <View style={styles.processingCircle}>
                <Ionicons name="shield-checkmark" size={48} color={COLORS.hex_1D9BF0} />
              </View>
            </View>

            <Text style={[styles.mainHeadingCenter, { color: theme.text }]}>
              Verifying your identity
            </Text>
            <Text style={[styles.subHeadingCenter, { color: theme.textSecondary }]}>
              This may take a few minutes. Please keep this page open and do not refresh.
            </Text>

            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, marginTop: 24, padding: 18 }]}>
              <View style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.hex_1D9BF0} style={{ marginRight: 10 }} />
                <Text style={[styles.checkText, { color: theme.text }]}>Document check</Text>
              </View>
              <View style={[styles.checkRow, { marginTop: 14 }]}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.hex_1D9BF0} style={{ marginRight: 10 }} />
                <Text style={[styles.checkText, { color: theme.text }]}>Face matching</Text>
              </View>
              <View style={[styles.checkRow, { marginTop: 14 }]}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.hex_1D9BF0} style={{ marginRight: 10 }} />
                <Text style={[styles.checkText, { color: theme.text }]}>Security validation</Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 5: Verification Successful */}
        {currentStep === 5 && (
          <View style={[styles.stepBlock, { paddingTop: 40 }]}>
            <View style={styles.resultBadgeContainer}>
              <View style={[styles.resultBadge, { backgroundColor: '#10B981' }]}>
                <Ionicons name="checkmark" size={44} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.mainHeadingCenter, { color: theme.text, marginTop: 20 }]}>
              Verification Successful
            </Text>
            <Text style={[styles.subHeadingCenter, { color: theme.textSecondary }]}>
              Your identity has been verified successfully. You can now continue using the platform.
            </Text>

            <TouchableOpacity
              onPress={() => (onNavigate ? onNavigate('back') : null)}
              style={[styles.primaryBtn, { marginTop: 40 }]}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 6: Verification Failed */}
        {currentStep === 6 && (
          <View style={[styles.stepBlock, { paddingTop: 40 }]}>
            <View style={styles.resultBadgeContainer}>
              <View style={[styles.resultBadge, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="close" size={44} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.mainHeadingCenter, { color: theme.text, marginTop: 20 }]}>
              Verification Failed
            </Text>
            <Text style={[styles.subHeadingCenter, { color: theme.textSecondary }]}>
              We couldn't verify your identity. Please check your information and try again.
            </Text>

            <TouchableOpacity
              onPress={() => setCurrentStep(1)}
              style={[styles.outlineBtn, { marginTop: 40 }]}
              activeOpacity={0.8}
            >
              <Text style={styles.outlineBtnText}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('help-support')}
              style={styles.helpLink}
            >
              <Text style={styles.helpLinkText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: LAYOUT.HEADER_PADDING_HORIZONTAL,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_FONT_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_FONT_WEIGHT,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  stepDot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  stepDotActive: {
    width: 28,
  },
  stepDotInactive: {
    width: 6,
    backgroundColor: '#E2E8F0',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  stepBlock: {
    paddingTop: 10,
  },
  mainHeading: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  subHeading: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  mainHeadingCenter: {
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  subHeadingCenter: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  docList: {
    marginTop: 20,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  docIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  docSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 6,
  },
  securityText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  illustrationHero: {
    alignItems: 'center',
    marginVertical: 14,
  },
  uploadZone: {
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadPrompt: {
    alignItems: 'center',
  },
  cloudCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
  },
  uploadSub: {
    fontSize: 12,
    marginTop: 2,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  primaryBtn: {
    backgroundColor: COLORS.hex_1D9BF0,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.hex_1D9BF0,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  outlineBtnText: {
    color: COLORS.hex_1D9BF0,
    fontSize: 15,
    fontWeight: '600',
  },
  helpLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  helpLinkText: {
    color: COLORS.hex_1D9BF0,
    fontSize: 13.5,
    fontWeight: '500',
  },
  selfieCircleContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  selfieOuterRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  selfiePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieSubText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 6,
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  smallCtrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.hex_1D9BF0,
  },
  processingSpinnerContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  processingCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultBadgeContainer: {
    alignItems: 'center',
  },
  resultBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

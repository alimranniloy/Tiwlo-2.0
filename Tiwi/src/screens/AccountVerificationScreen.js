import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function AccountVerificationScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const isAlreadyVerified = !!currentUser?.verified;

  const [legalName, setLegalName] = useState(currentUser?.name || '');
  const [category, setCategory] = useState('Creator & Media');
  const [docType, setDocType] = useState('National ID');
  const [docNumber, setDocNumber] = useState('');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    'Creator & Media',
    'Technology & Dev',
    'Business / Brand',
    'Journalism & News',
    'Entertainment & Art',
    'Sports & Fitness',
  ];

  const docTypes = ['National ID', 'Passport', "Driver's License"];

  const hasAvatar = !!(currentUser?.avatar || currentUser?.avatar_url);
  const hasBio = !!currentUser?.bio;
  const hasHandle = !!currentUser?.username;

  const handleSubmit = async () => {
    if (!legalName.trim() || !docNumber.trim()) {
      Alert.alert('Required Fields Missing', 'Please enter your legal full name and official document number.');
      return;
    }

    setSubmitting(true);
    // Simulating application submission to compliance queue
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Verified Badge</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isAlreadyVerified ? (
          <View style={[styles.verifiedCard, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_1D9BF0 }]}>
            <View style={styles.verifiedIconWrap}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.hex_1D9BF0} />
            </View>
            <Text style={[styles.verifiedTitle, { color: theme.text }]}>Your Account is Verified</Text>
            <Text style={[styles.verifiedSub, { color: theme.textSecondary }]}>
              Your profile displays the official blue checkmark, confirming your authentic identity across the Tiwi ecosystem.
            </Text>

            <View style={[styles.benefitBox, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.hex_EFF6FF, borderColor: theme.borderLight }]}>
              <View style={styles.benefitRow}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.hex_1D9BF0} style={{ marginRight: 8 }} />
                <Text style={[styles.benefitText, { color: theme.text }]}>Identity Protection & Impersonation Shield</Text>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="sparkles" size={16} color={COLORS.hex_1D9BF0} style={{ marginRight: 8 }} />
                <Text style={[styles.benefitText, { color: theme.text }]}>Priority Reach in Explore & Suggested Users</Text>
              </View>
              <View style={styles.benefitRow}>
                <Ionicons name="videocam" size={16} color={COLORS.hex_1D9BF0} style={{ marginRight: 8 }} />
                <Text style={[styles.benefitText, { color: theme.text }]}>Full 1080p 60FPS Video Transcoding Stream</Text>
              </View>
            </View>
          </View>
        ) : submitted ? (
          <View style={[styles.verifiedCard, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_22C55E }]}>
            <Ionicons name="time" size={48} color={COLORS.hex_22C55E} style={{ marginBottom: 12 }} />
            <Text style={[styles.verifiedTitle, { color: theme.text }]}>Application Under Review</Text>
            <Text style={[styles.verifiedSub, { color: theme.textSecondary }]}>
              Thank you for submitting your verification details. Our safety and trust team will evaluate your credentials within 24 to 48 hours.
            </Text>
            <View style={[styles.infoCallout, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.hex_F8F9FA }]}>
              <Text style={[styles.infoCalloutText, { color: theme.textSecondary }]}>
                Application Reference: TIW-REQ-{String(currentUser?.id || '99').padStart(6, '0')}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Checklist Banner */}
            <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={styles.bannerHeaderRow}>
                <Ionicons name="shield-checkmark" size={24} color={COLORS.hex_1D9BF0} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerTitle, { color: theme.text }]}>Apply for Tiwi Verification</Text>
                  <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
                    Ensure your profile meets the prerequisites before applying
                  </Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight, marginVertical: 12 }]} />

              <View style={styles.checklist}>
                <View style={styles.checkItem}>
                  <Ionicons
                    name={hasAvatar ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={hasAvatar ? COLORS.hex_22C55E : theme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.checkLabel, { color: hasAvatar ? theme.text : theme.textSecondary }]}>
                    Profile Photo Uploaded
                  </Text>
                </View>

                <View style={styles.checkItem}>
                  <Ionicons
                    name={hasHandle ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={hasHandle ? COLORS.hex_22C55E : theme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.checkLabel, { color: hasHandle ? theme.text : theme.textSecondary }]}>
                    Unique @handle registered
                  </Text>
                </View>

                <View style={styles.checkItem}>
                  <Ionicons
                    name={hasBio ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={hasBio ? COLORS.hex_22C55E : theme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.checkLabel, { color: hasBio ? theme.text : theme.textSecondary }]}>
                    Bio & Account details filled
                  </Text>
                </View>
              </View>
            </View>

            {/* Application Form */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>VERIFICATION DETAILS</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}>
              {/* Legal Name */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Legal Full Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                    color: theme.text,
                    borderColor: theme.borderLight,
                  },
                ]}
                placeholder="As shown on official ID"
                placeholderTextColor={theme.textSecondary}
                value={legalName}
                onChangeText={setLegalName}
              />

              {/* Category */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {categories.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? (theme.accent || COLORS.hex_1D9BF0)
                            : (isDarkMode ? COLORS.hex_222222 : COLORS.borderLight),
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? COLORS.white : theme.text }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Document Type */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Document Type</Text>
              <View style={styles.docTypeRow}>
                {docTypes.map((dt) => {
                  const isSelected = docType === dt;
                  return (
                    <TouchableOpacity
                      key={dt}
                      style={[
                        styles.docTypeBtn,
                        {
                          backgroundColor: isSelected
                            ? (theme.accent || COLORS.hex_1D9BF0)
                            : (isDarkMode ? COLORS.hex_222222 : COLORS.borderLight),
                        },
                      ]}
                      onPress={() => setDocType(dt)}
                    >
                      <Text style={[styles.docTypeText, { color: isSelected ? COLORS.white : theme.text }]}>
                        {dt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Document Number */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Document Number</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                    color: theme.text,
                    borderColor: theme.borderLight,
                  },
                ]}
                placeholder="e.g. 19882938192"
                placeholderTextColor={theme.textSecondary}
                value={docNumber}
                onChangeText={setDocNumber}
              />

              {/* Portfolio / Website */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
                Portfolio or Official Link (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB,
                    color: theme.text,
                    borderColor: theme.borderLight,
                  },
                ]}
                placeholder="https://yourportfolio.com or social link"
                placeholderTextColor={theme.textSecondary}
                value={portfolioLink}
                onChangeText={setPortfolioLink}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.accent || COLORS.hex_1D9BF0 }]}
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Submit Verification Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  checklist: {
    marginTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  docTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  docTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  docTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  verifiedIconWrap: {
    marginBottom: 12,
  },
  verifiedTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  verifiedSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  benefitBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCallout: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoCalloutText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

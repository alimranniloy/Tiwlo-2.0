import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { API_BASE_URL } from '../config';
import SharedDrawer from '../components/SharedDrawer';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function ProfileSettingsScreen({ onNavigate }) {
  const { theme, isDarkMode, toggleDarkMode, currentUser, setCurrentUser, logout, refreshUser } = useAuth();

  // Address Prompt dismissal state
  const [addressPromptVisible, setAddressPromptVisible] = useState(true);

  // Billing address modal state
  const [billingModalVisible, setBillingModalVisible] = useState(false);
  const [billingCountry, setBillingCountry] = useState(currentUser?.billingAddress?.country || 'Bangladesh');
  const [billingCity, setBillingCity] = useState(currentUser?.billingAddress?.city || '');
  const [billingStreet, setBillingStreet] = useState(currentUser?.billingAddress?.address || '');
  const [billingPhone, setBillingPhone] = useState(currentUser?.billingAddress?.phone || currentUser?.phone || '');
  const [billingPostal, setBillingPostal] = useState(currentUser?.billingAddress?.postalCode || '');
  const [savingBilling, setSavingBilling] = useState(false);

  // Sub-modal states
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);
  const [blockedUsersModalVisible, setBlockedUsersModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Privacy toggles
  const [protectPosts, setProtectPosts] = useState(Boolean(currentUser?.privacySettings?.protectPosts));
  const [discoverability, setDiscoverability] = useState(currentUser?.privacySettings?.discoverability !== false);
  const [activityStatus, setActivityStatus] = useState(currentUser?.privacySettings?.activityStatus !== false);
  const [readReceipts, setReadReceipts] = useState(currentUser?.privacySettings?.readReceipts !== false);

  // Security toggles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(currentUser?.twoFactorEnabled));

  // Blocked list
  const [blockedList, setBlockedList] = useState(currentUser?.blockedUsers || []);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  const defaultAvatar = currentUser?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0B57D0&color=fff&size=200&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=200&bold=true';

  useEffect(() => {
    if (currentUser?.billingAddress) {
      setBillingCountry(currentUser.billingAddress.country || 'Bangladesh');
      setBillingCity(currentUser.billingAddress.city || '');
      setBillingStreet(currentUser.billingAddress.address || '');
      setBillingPhone(currentUser.billingAddress.phone || currentUser.phone || '');
      setBillingPostal(currentUser.billingAddress.postalCode || '');
    }
  }, [currentUser]);

  // Handle Save Billing Address
  const handleSaveBilling = async () => {
    setSavingBilling(true);
    const newBilling = {
      country: billingCountry.trim(),
      city: billingCity.trim(),
      address: billingStreet.trim(),
      phone: billingPhone.trim(),
      postalCode: billingPostal.trim(),
    };

    try {
      await TiwiAPI.updateProfile({ billingAddress: newBilling, phone: billingPhone.trim() }, currentUser?.id);
      setCurrentUser((prev) => ({
        ...prev,
        phone: billingPhone.trim(),
        billingAddress: newBilling,
      }));
      if (refreshUser) refreshUser();
      setBillingModalVisible(false);
      Alert.alert('Saved', 'Your Tiwi Account billing address has been updated!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update billing address.');
    } finally {
      setSavingBilling(false);
    }
  };

  // Handle Privacy Toggle with real API persistence
  const handleTogglePrivacy = async (key, val, setter) => {
    setter(val);
    try {
      await TiwiAPI.updatePrivacySettings({ [key]: val }, currentUser?.id);
      setCurrentUser((prev) => ({
        ...prev,
        privacySettings: {
          ...(prev?.privacySettings || {}),
          [key]: val,
        },
      }));
    } catch (err) {
      setter(!val);
      Alert.alert('Sync Error', 'Unable to sync privacy setting with server.');
    }
  };

  // Handle Password Change
  const handleChangePasswordSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await TiwiAPI.changePassword(oldPassword, newPassword, currentUser?.id);
      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Security Update', 'Your Tiwi password has been changed successfully!');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your Tiwi Account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          if (logout) logout();
        },
      },
    ]);
  };

  const countries = [
    { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
    { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  ];

  const surfaceBg = isDarkMode ? COLORS.hex_131314 : COLORS.inputBackground;
  const cardBg = isDarkMode ? COLORS.hex_1E1F20 : COLORS.white;
  const dividerColor = isDarkMode ? COLORS.hex_2C2D2F : COLORS.borderLight;
  const textPrimary = isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text;
  const textSecondary = isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: surfaceBg }]}>
      {/* 1. Header: Close (✕) on Left, "Tiwi Account", Help, Search, User Avatar on Right */}
      <View style={[styles.header, { backgroundColor: surfaceBg }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="close" size={24} color={textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textPrimary }]}>Tiwi Account</Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setHelpModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="help-circle-outline" size={22} color={textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setSearchModalVisible(true)}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="search" size={21} color={textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={() => onNavigate && onNavigate('edit-profile')}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: currentUser?.avatar || defaultAvatar }}
              style={styles.headerAvatarImg}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. Top Hero Profile Card (Screenshot 1) */}
        <TouchableOpacity
          style={[styles.heroCard, { backgroundColor: cardBg }]}
          onPress={() => onNavigate && onNavigate('edit-profile')}
          activeOpacity={0.88}
        >
          <View style={styles.heroRow}>
            {/* Avatar with blue ring outline and edit pencil badge */}
            <View style={styles.heroAvatarContainer}>
              <Image source={{ uri: currentUser?.avatar || defaultAvatar }} style={styles.heroAvatar} />
              <View style={styles.pencilBadge}>
                <Ionicons name="pencil" size={11} color={COLORS.text} />
              </View>
            </View>

            {/* User details */}
            <View style={styles.heroInfoCol}>
              <Text style={[styles.heroName, { color: textPrimary }]} numberOfLines={1}>
                {currentUser?.name || 'Al Imran Niloy'}
              </Text>
              <Text style={[styles.heroEmail, { color: textSecondary }]} numberOfLines={1}>
                {currentUser?.email || 'alimranniloybd@gmail.com'}
              </Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro</Text>
              </View>
            </View>

            {/* Chevron dropdown button */}
            <View style={[styles.dropdownPill, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
              <Ionicons name="chevron-down" size={18} color={textPrimary} />
            </View>
          </View>
        </TouchableOpacity>

        {/* 3. Action Prompt Card: Billing Address (Screenshot 1) */}
        {addressPromptVisible && (
          <View style={[styles.promptCard, { backgroundColor: cardBg }]}>
            <View style={styles.promptRow}>
              <View style={styles.promptIconWrap}>
                <Ionicons name="home" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.promptTextCol}>
                <Text style={[styles.promptTitle, { color: textPrimary }]}>
                  Set a billing address for your Tiwi Account
                </Text>
                <Text style={[styles.promptSubtitle, { color: textSecondary }]}>
                  Get faster checkout, secure delivery, and accurate invoices
                </Text>
              </View>
            </View>

            <View style={styles.promptButtonRow}>
              <TouchableOpacity
                onPress={() => setAddressPromptVisible(false)}
                style={styles.promptDismissBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.promptDismissText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setBillingModalVisible(true)}
                style={styles.promptActionBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.promptActionText}>Set billing address</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. Family & Team Card */}
        <TouchableOpacity
          style={[styles.familyCard, { backgroundColor: cardBg }]}
          onPress={() => Alert.alert('Family & Collaborators', 'Manage connected family accounts and team members.')}
          activeOpacity={0.7}
        >
          <View style={styles.familyLeftRow}>
            <Ionicons name="people-outline" size={22} color={textPrimary} style={{ marginRight: 12 }} />
            <Text style={[styles.familyTitle, { color: textPrimary }]}>Family</Text>
          </View>
          <View style={styles.familyRightRow}>
            {currentUser?.familyMembers && currentUser.familyMembers.length > 0 ? (
              currentUser.familyMembers.slice(0, 2).map((m, idx) => (
                <Image
                  key={m.id || idx}
                  source={{ uri: m.avatar || defaultAvatar }}
                  style={idx === 0 ? styles.familyAvatar1 : styles.familyAvatar2}
                />
              ))
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 }}>
                <Ionicons name="person-add-outline" size={14} color={textSecondary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: textSecondary, fontWeight: '500' }}>Add</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* 5. Main Category List Card (Screenshots 1 & 3) */}
        <View style={[styles.servicesGroupCard, { backgroundColor: cardBg }]}>
          {/* Item 1: Tiwi Pro plan */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => setProModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_F3E8FF }]}>
              <Ionicons name="sparkles" size={20} color={COLORS.hex_9333EA} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Tiwi Pro plan</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                AI features, plan benefits, storage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 2: Wallet & subscriptions */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => setWalletModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_EDE9FE }]}>
              <Ionicons name="wallet-outline" size={20} color={COLORS.hex_7C3AED} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Wallet & subscriptions</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Payment Methods, Transactions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 3: Personal info (Navigates to edit-profile per user instruction!) */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('edit-profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_DCFCE7 }]}>
              <Ionicons name="person-outline" size={20} color={COLORS.hex_16A34A} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Personal info</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Name, email, phone, address
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 4: Security & sign-in (Dedicated Screen Route) */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('security-settings')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_E0F2FE }]}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.hex_0284C7} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Security & sign-in</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                2FA, Password update, Active sessions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 5: Data & privacy (Dedicated Screen Route) */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('privacy-settings')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_FFEDD5 }]}>
              <Ionicons name="toggle-outline" size={20} color={COLORS.hex_EA580C} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Data & privacy</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Private account, Activity status, Messaging audience
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 6: People & sharing / Blocked accounts (Dedicated Screen Route) */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('blocked-users')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_FCE7F3 }]}>
              <Ionicons name="people-circle-outline" size={20} color={COLORS.hex_DB2777} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>People & sharing</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Manage blocked users and interactions
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 7: Creator Analytics */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('creator-analytics')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_F3E8FF }]}>
              <Ionicons name="analytics" size={20} color={COLORS.hex_9333EA} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Creator Analytics</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Live post engagement and reaction insights
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Item 8: Verification Badge */}
          <TouchableOpacity
            style={styles.serviceRow}
            onPress={() => onNavigate && onNavigate('account-verification')}
            activeOpacity={0.7}
          >
            <View style={[styles.pastelCircle, { backgroundColor: COLORS.hex_DBEAFE }]}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.hex_2563EB} />
            </View>
            <View style={styles.serviceTextCol}>
              <Text style={[styles.serviceTitle, { color: textPrimary }]}>Verification & Blue Badge</Text>
              <Text style={[styles.serviceSubtitle, { color: textSecondary }]}>
                Official identity verification & privileges
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 6. Search & Help Pill Buttons (Screenshot 3) */}
        <View style={styles.pillButtonsRow}>
          <TouchableOpacity
            style={[styles.outlinePillBtn, { backgroundColor: cardBg, borderColor: isDarkMode ? COLORS.hex_333537 : COLORS.hex_DADCE0 }]}
            onPress={() => setSearchModalVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="search" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.outlinePillText, { color: textPrimary }]}>Search Tiwi Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.outlinePillBtn, { backgroundColor: cardBg, borderColor: isDarkMode ? COLORS.hex_333537 : COLORS.hex_DADCE0 }]}
            onPress={() => setHelpModalVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="help-circle-outline" size={17} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.outlinePillText, { color: textPrimary }]}>Get help</Text>
          </TouchableOpacity>
        </View>

        {/* 7. Privacy & Security Assurance Note with Shield (Screenshot 3) */}
        <View style={styles.assuranceContainer}>
          <View style={styles.assuranceTextCol}>
            <Text style={[styles.assuranceText, { color: textSecondary }]}>
              Only you can see your settings. You might also want to review your settings for privacy, security, or whichever Tiwi services you use most. Tiwi keeps your data private, safe, and secure.
            </Text>
            <TouchableOpacity onPress={() => Alert.alert('Data Privacy & Security', 'All personal data is encrypted in transit and at rest. Tiwi never sells your data to third parties.')}>
              <Text style={styles.learnMoreLink}>Learn more</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.assuranceShieldWrap}>
            <Ionicons name="shield-checkmark" size={32} color={COLORS.primary} />
          </View>
        </View>

        {/* 8. Footer Links (Screenshot 3) */}
        <View style={styles.footerLinksRow}>
          <TouchableOpacity onPress={() => onNavigate && onNavigate('about-tiwi')}>
            <Text style={[styles.footerLinkText, { color: textSecondary }]}>Privacy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate && onNavigate('about-tiwi')}>
            <Text style={[styles.footerLinkText, { color: textSecondary }]}>Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate && onNavigate('help-support')}>
            <Text style={[styles.footerLinkText, { color: textSecondary }]}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onNavigate && onNavigate('about-tiwi')}>
            <Text style={[styles.footerLinkText, { color: textSecondary }]}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.footerLinkText, { color: COLORS.hex_DC2626 }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: BILLING ADDRESS (Requested in detail by user)    */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={billingModalVisible}
        onClose={() => setBillingModalVisible(false)}
        title="Billing Address"
        showCloseButton={true}
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Country / Region</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {countries.map((c) => {
            const isSel = billingCountry === c.name;
            return (
              <TouchableOpacity
                key={c.code}
                onPress={() => setBillingCountry(c.name)}
                style={[
                  styles.countryPill,
                  {
                    backgroundColor: isSel ? COLORS.primary : isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
                    borderColor: isSel ? COLORS.primary : isDarkMode ? COLORS.hex_3C4043 : COLORS.hex_DADCE0,
                  },
                ]}
              >
                <Text style={{ fontSize: 14, marginRight: 6 }}>{c.flag}</Text>
                <Text style={{ fontSize: 13, fontWeight: isSel ? '700' : '500', color: isSel ? COLORS.white : textPrimary }}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.inputLabel, { color: textSecondary }]}>City / District</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={billingCity}
          onChangeText={setBillingCity}
          placeholder="e.g. Dhaka"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Street Address</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={billingStreet}
          onChangeText={setBillingStreet}
          placeholder="House, road, area"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Mobile Phone for Delivery & Billing</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={billingPhone}
          onChangeText={setBillingPhone}
          placeholder="e.g. +1 555-0199 or 01700-000000"
          placeholderTextColor={theme.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Postal / Zip Code</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={billingPostal}
          onChangeText={setBillingPostal}
          placeholder="e.g. 10001"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleSaveBilling}
          disabled={savingBilling}
        >
          {savingBilling ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save Billing Address</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 2: TIWI PASSWORD CHANGE                             */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        title="Change Password"
        showCloseButton={true}
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Current Password</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          secureTextEntry
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Enter current password"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>New Password</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="At least 6 characters"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Confirm New Password</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-type new password"
          placeholderTextColor={theme.textMuted}
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={handleChangePasswordSubmit}
          disabled={changingPassword}
        >
          {changingPassword ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 3: TIWI PRO PLAN                                    */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={proModalVisible}
        onClose={() => setProModalVisible(false)}
        title="Tiwi Pro Plan"
        showCloseButton={true}
      >
        <View style={{ paddingVertical: 10 }}>
          {currentUser?.isPro || currentUser?.planId === 'pro' ? (
            <View style={[styles.proBadge, { marginBottom: 12 }]}>
              <Text style={styles.proBadgeText}>ACTIVE SUBSCRIBER</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 }}>
              <Text style={{ color: textSecondary, fontWeight: '700', fontSize: 11 }}>FREE STARTER PLAN</Text>
            </View>
          )}
          <Text style={{ fontSize: 14, color: textPrimary, marginBottom: 8, fontWeight: '600' }}>
            {currentUser?.isPro || currentUser?.planId === 'pro' ? 'Included with your Tiwi Pro membership:' : 'Upgrade to Tiwi Pro to unlock:'}
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
            ✓ Unlimited AI Content Generation & Captions
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
            ✓ 100 GB High-Speed Cloud Media Storage
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
            ✓ Verified Blue Tick Badge on your profile
          </Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
            ✓ Priority 24/7 Creator Support
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.hex_9333EA }]}
          onPress={() => {
            setProModalVisible(false);
            Alert.alert(
              currentUser?.isPro || currentUser?.planId === 'pro' ? 'Manage Membership' : 'Tiwi Pro Upgrade',
              currentUser?.isPro || currentUser?.planId === 'pro'
                ? 'Your subscription is active.'
                : `Tiwi Pro subscriptions can be activated in the Billing & Subscriptions portal on ${API_BASE_URL}`
            );
          }}
        >
          <Text style={styles.primaryActionBtnText}>
            {currentUser?.isPro || currentUser?.planId === 'pro' ? 'Manage Membership' : 'Upgrade to Pro'}
          </Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 4: WALLET & SUBSCRIPTIONS                           */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={walletModalVisible}
        onClose={() => setWalletModalVisible(false)}
        title="Wallet & Subscriptions"
        showCloseButton={true}
      >
        <View style={{ paddingVertical: 12 }}>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>Payment Methods</Text>
          {currentUser?.paymentMethods && currentUser.paymentMethods.length > 0 ? (
            currentUser.paymentMethods.map((pm, idx) => (
              <View key={pm.id || idx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, padding: 12, borderRadius: 12, marginBottom: 12 }}>
                <Ionicons name="card" size={24} color={COLORS.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary }}>{pm.brand || 'Card'} ending in {pm.last4 || '****'}</Text>
                  <Text style={{ fontSize: 12, color: textSecondary }}>Expires {pm.exp || '--/--'}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.hex_16A34A }}>Active</Text>
              </View>
            ))
          ) : (
            <View style={{ backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, padding: 14, borderRadius: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: textPrimary, marginBottom: 2 }}>No payment methods added</Text>
              <Text style={{ fontSize: 12, color: textSecondary }}>Add a card or mobile wallet in the Tiwlo Cloud Dashboard to make purchases.</Text>
            </View>
          )}

          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 4 }}>Mobile Banking Options</Text>
          <Text style={{ fontSize: 13, color: textPrimary, marginBottom: 6 }}>
            🇧🇩 bKash / Nagad enabled for local Bangladesh payments
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setWalletModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Done</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 5: SECURITY CHECKUP & 2FA                          */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={securityModalVisible}
        onClose={() => setSecurityModalVisible(false)}
        title="Security & Sign-in"
        showCloseButton={true}
      >
        <View style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>2-Step Verification</Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                Protect your account with SMS and email authentication codes.
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={async (val) => {
                setTwoFactorEnabled(val);
                try {
                  await TiwiAPI.updateProfile({ twoFactorEnabled: val }, currentUser?.id);
                  setCurrentUser((p) => ({ ...p, twoFactorEnabled: val }));
                } catch (e) {
                  setTwoFactorEnabled(!val);
                }
              }}
              trackColor={{ false: isDarkMode ? COLORS.hex_333537 : COLORS.border, true: COLORS.primary }}
            />
          </View>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor, marginLeft: 0 }]} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: textPrimary }}>Recent Sign-in Activity</Text>
              <Text style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
                Dhaka, Bangladesh • Xiaomi 13 Pro • Today, 11:16 AM
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.hex_16A34A} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setSecurityModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Done</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 6: DATA & PRIVACY                                  */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
        title="Data & Privacy Controls"
        showCloseButton={true}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Private account</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Only approved followers can view your posts and reels.</Text>
          </View>
          <Switch
            value={protectPosts}
            onValueChange={(val) => handleTogglePrivacy('protectPosts', val, setProtectPosts)}
            trackColor={{ false: isDarkMode ? COLORS.hex_333537 : COLORS.border, true: COLORS.primary }}
          />
        </View>

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor, marginLeft: 0 }]} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Search discoverability</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Allow discovery in Tiwi search and recommendations.</Text>
          </View>
          <Switch
            value={discoverability}
            onValueChange={(val) => handleTogglePrivacy('discoverability', val, setDiscoverability)}
            trackColor={{ false: isDarkMode ? COLORS.hex_333537 : COLORS.border, true: COLORS.primary }}
          />
        </View>

        <View style={[styles.hairlineDivider, { backgroundColor: dividerColor, marginLeft: 0 }]} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Show activity status</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Let friends see when you are active on Tiwi.</Text>
          </View>
          <Switch
            value={activityStatus}
            onValueChange={(val) => handleTogglePrivacy('activityStatus', val, setActivityStatus)}
            trackColor={{ false: isDarkMode ? COLORS.hex_333537 : COLORS.border, true: COLORS.primary }}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setPrivacyModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Save Preferences</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 7: LINKED APPS & DEVICES                            */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={sessionsModalVisible}
        onClose={() => setSessionsModalVisible(false)}
        title="Linked Apps & Devices"
        showCloseButton={true}
      >
        <View style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Xiaomi 13 Pro (Current Device)</Text>
              <Text style={{ fontSize: 12, color: textSecondary }}>Tiwi Android App • Active Now</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name="desktop-outline" size={22} color={COLORS.textSecondary} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Chrome on Windows</Text>
              <Text style={{ fontSize: 12, color: textSecondary }}>Tiwlo Web Dashboard • Dhaka, Bangladesh</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setSessionsModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Close</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 8: BLOCKED USERS                                   */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={blockedUsersModalVisible}
        onClose={() => setBlockedUsersModalVisible(false)}
        title="Blocked Accounts"
        showCloseButton={true}
      >
        <View style={{ maxHeight: 300 }}>
          {blockedList.length > 0 ? (
            blockedList.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: textSecondary }}>{item.handle}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setBlockedList((prev) => prev.filter((b) => b.id !== item.id));
                    Alert.alert('Unblocked', `You unblocked ${item.name}`);
                  }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.primary }}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="shield-checkmark-outline" size={38} color={COLORS.hex_16A34A} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14.5, fontWeight: '600', color: textPrimary, marginBottom: 4 }}>No Blocked Accounts</Text>
              <Text style={{ fontSize: 12.5, color: textSecondary, textAlign: 'center' }}>You have not blocked any accounts.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setBlockedUsersModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Done</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 9: HELP & SUPPORT                                  */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
        title="Tiwi Account Help"
        showCloseButton={true}
      >
        <View style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: 14, color: textPrimary, fontWeight: '600', marginBottom: 6 }}>Popular Questions</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>• How to edit your billing address and phone</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>• How 2-step verification keeps your account safe</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>• Changing profile picture, handle, or bio</Text>
          <Text style={{ fontSize: 13, color: textSecondary, marginBottom: 8 }}>• Contact Tiwi Support: support@{API_BASE_URL.replace(/^https?:\/\//, '').split('/')[0]}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => setHelpModalVisible(false)}
        >
          <Text style={styles.primaryActionBtnText}>Close</Text>
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 10: SEARCH TIWI ACCOUNT                            */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        title="Search Tiwi Account"
        showCloseButton={true}
      >
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search settings, billing, privacy, password..."
          placeholderTextColor={theme.textMuted}
          autoFocus
        />

        <View style={{ paddingVertical: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setSearchModalVisible(false);
              onNavigate && onNavigate('edit-profile');
            }}
            style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Personal info & Edit Profile</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Name, email, phone, birthday, billing address</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSearchModalVisible(false);
              setBillingModalVisible(true);
            }}
            style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Billing address</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Country, city, delivery contact</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSearchModalVisible(false);
              setPasswordModalVisible(true);
            }}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary }}>Change Password</Text>
            <Text style={{ fontSize: 12, color: textSecondary }}>Security & login credentials</Text>
          </TouchableOpacity>
        </View>
      </SharedDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 1. Clean Top Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerAvatarBtn: {
    marginLeft: 6,
  },
  headerAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  // 2. Hero Profile Card (Screenshot 1)
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.rgba_0_0_0_0p04,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  pencilBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  heroInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  proBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 5,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  dropdownPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 3. Billing Address Prompt Card (Screenshot 1)
  promptCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.rgba_0_0_0_0p04,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  promptIconWrap: {
    marginRight: 14,
    marginTop: 2,
  },
  promptTextCol: {
    flex: 1,
  },
  promptTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  promptSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  promptButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  promptDismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  promptDismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  promptActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  promptActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  // 4. Family Card (Screenshot 1)
  familyCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.rgba_0_0_0_0p04,
  },
  familyLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  familyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  familyRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  familyAvatar1: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  familyAvatar2: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.white,
    marginLeft: -8,
  },
  // 5. Main Category List Card (Screenshots 1 & 3)
  servicesGroupCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.rgba_0_0_0_0p04,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pastelCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  serviceTextCol: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  serviceSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70,
  },
  // 6. Pill Action Buttons (Screenshot 3)
  pillButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 12,
    paddingHorizontal: 16,
  },
  outlinePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  outlinePillText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  // 7. Security Assurance (Screenshot 3)
  assuranceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    gap: 16,
  },
  assuranceTextCol: {
    flex: 1,
  },
  assuranceText: {
    fontSize: 12,
    lineHeight: 18,
  },
  learnMoreLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  assuranceShieldWrap: {
    padding: 6,
  },
  // 8. Footer Links (Screenshot 3)
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    gap: 18,
    paddingHorizontal: 16,
  },
  footerLinkText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.rgba_0_0_0_0p5,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  dialogInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14.5,
    marginBottom: 6,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryActionBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import SharedDrawer from '../components/SharedDrawer';
import { COLORS } from '../config/colors';

export default function EditProfileScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser, setCurrentUser, refreshUser } = useAuth();

  // Profile data states
  const [name, setName] = useState(currentUser?.name || '');
  const [handle, setHandle] = useState((currentUser?.handle || '').replace(/^@/, ''));
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [website, setWebsite] = useState(currentUser?.website || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [gender, setGender] = useState(currentUser?.gender || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [recoveryEmail, setRecoveryEmail] = useState(currentUser?.recoveryEmail || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [backupPhone1, setBackupPhone1] = useState(currentUser?.backupPhones?.[0] || '');
  const [backupPhone2, setBackupPhone2] = useState(currentUser?.backupPhones?.[1] || '');
  const [birthday, setBirthday] = useState(currentUser?.birthday || '');
  const [language, setLanguage] = useState(currentUser?.advancedSettings?.language || 'English (United States)');
  const [workAddress, setWorkAddress] = useState(currentUser?.workAddress || '');

  // Billing address state
  const [billingCountry, setBillingCountry] = useState(currentUser?.billingAddress?.country || '');
  const [billingCity, setBillingCity] = useState(currentUser?.billingAddress?.city || '');
  const [billingStreet, setBillingStreet] = useState(currentUser?.billingAddress?.address || '');
  const [billingPhone, setBillingPhone] = useState(currentUser?.billingAddress?.phone || currentUser?.phone || '');
  const [billingPostal, setBillingPostal] = useState(currentUser?.billingAddress?.postalCode || '');

  // Modal active states
  const [activeModal, setActiveModal] = useState(null); // 'name' | 'gender' | 'email' | 'phone' | 'birthday' | 'language' | 'billing' | 'work' | 'bio'
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSuccessVisible, setAvatarSuccessVisible] = useState(false);

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

  const languages = [
    'English (United Kingdom)',
    'English (United States)',
    'Bengali (বাংলা)',
    'Hindi (हिन्दी)',
    'Arabic (العربية)',
    'Spanish (Español)',
  ];

  const genderOptions = ['Male', 'Female', 'Rather not say', 'Custom'];

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setHandle((currentUser.handle || '').replace(/^@/, ''));
      setBio(currentUser.bio || '');
      setWebsite(currentUser.website || '');
      setAvatar(currentUser.avatar || '');
      setGender(currentUser.gender || '');
      setEmail(currentUser.email || '');
      setRecoveryEmail(currentUser.recoveryEmail || '');
      setPhone(currentUser.phone || '');
      setBackupPhone1(currentUser.backupPhones?.[0] || '');
      setBackupPhone2(currentUser.backupPhones?.[1] || '');
      setBirthday(currentUser.birthday || '');
      setWorkAddress(currentUser.workAddress || '');
      setLanguage(currentUser.advancedSettings?.language || 'English (United States)');

      if (currentUser.billingAddress) {
        setBillingCountry(currentUser.billingAddress.country || '');
        setBillingCity(currentUser.billingAddress.city || '');
        setBillingStreet(currentUser.billingAddress.address || '');
        setBillingPhone(currentUser.billingAddress.phone || currentUser.phone || '');
        setBillingPostal(currentUser.billingAddress.postalCode || '');
      } else {
        setBillingCountry('');
        setBillingCity('');
        setBillingStreet('');
        setBillingPhone(currentUser.phone || '');
        setBillingPostal('');
      }
    }
  }, [currentUser]);

  const defaultAvatar = name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0B57D0&color=fff&size=200&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=200&bold=true';

  // Quick Photo Picker (ImagePicker)
  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Permission to access your photos is required to change profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingAvatar(true);
        const asset = result.assets[0];
        const fileMeta = {
          fileName: asset.fileName || `avatar_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          mediaType: 'image',
        };
        const uploadedUrl = await TiwiAPI.uploadMedia(asset.uri, 'profile_pic', asset.base64, currentUser?.id, fileMeta);
        setAvatar(uploadedUrl);
        await TiwiAPI.updateProfile({ avatar: uploadedUrl }, currentUser?.id);
        setCurrentUser((prev) => ({ ...prev, avatar: uploadedUrl }));
        if (refreshUser) await refreshUser();
        setAvatarSuccessVisible(true);
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Failed to update profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Generic Save for any profile section
  const handleSaveFields = async (fieldsToUpdate, successMsg = 'Changes saved successfully!') => {
    setSaving(true);
    try {
      await TiwiAPI.updateProfile(fieldsToUpdate, currentUser?.id);
      setCurrentUser((prev) => ({ ...prev, ...fieldsToUpdate }));
      if (refreshUser) refreshUser();
      setActiveModal(null);
      Alert.alert('Saved', successMsg);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const surfaceBg = isDarkMode ? COLORS.hex_131314 : COLORS.inputBackground;
  const cardBg = isDarkMode ? COLORS.hex_1E1F20 : COLORS.white;
  const dividerColor = isDarkMode ? COLORS.hex_2C2D2F : COLORS.borderLight;
  const textPrimary = isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text;
  const textSecondary = isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary;

  return (
    <View style={[styles.container, { backgroundColor: surfaceBg }]}>
      {/* 1. Header (Screenshot 2: ← Tiwi Account, Help, Search, Avatar) */}
      <View style={[styles.header, { backgroundColor: surfaceBg }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textPrimary }]}>Tiwi Account</Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Alert.alert('Help & Feedback', 'Personal info contains your core identity, contact details, and billing preferences.')}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="help-circle-outline" size={22} color={textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Alert.alert('Search Personal Info', 'Search your account profile, addresses, and contacts.')}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="search" size={21} color={textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerAvatarBtn}>
            <Image source={{ uri: avatar || defaultAvatar }} style={styles.headerAvatarImg} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. Big Title: "Personal info" (Screenshot 2) */}
        <Text style={[styles.headline, { color: textPrimary }]}>Personal info</Text>

        {/* 3. Unified M3 Rounded Card (Screenshot 2) */}
        <View style={[styles.mainCard, { backgroundColor: cardBg }]}>
          {/* Row 1: Profile picture */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={handlePickAvatar}
            activeOpacity={0.7}
            disabled={uploadingAvatar}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="camera-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Profile picture</Text>
              <Text style={[styles.rowSublabel, { color: textSecondary }]}>
                A picture helps personalize your account
              </Text>
            </View>
            <View style={styles.avatarThumbnailWrap}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Image source={{ uri: avatar || defaultAvatar }} style={styles.avatarThumbnail} />
              )}
            </View>
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 2: Name */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('name')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="person-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Name</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{name || 'Not set'}</Text>
              <Text style={[styles.rowSubValue, { color: theme.textMuted }]}>@{handle || 'username'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 3: Gender */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('gender')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="person-circle-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Gender</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{gender || 'Not set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 4: Email */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('email')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="mail-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Email</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{email || 'Not set'}</Text>
              {!!recoveryEmail && (
                <Text style={[styles.rowSubValue, { color: textSecondary }]}>{recoveryEmail}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 5: Phone */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('phone')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="call-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Phone</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{phone || 'Not set'}</Text>
              {!!backupPhone1 && (
                <Text style={[styles.rowSubValue, { color: textSecondary }]}>{backupPhone1}</Text>
              )}
              {!!backupPhone2 && (
                <Text style={[styles.rowSubValue, { color: textSecondary }]}>{backupPhone2}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 6: Birthday */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('birthday')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="gift-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Birthday</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{birthday || 'Not set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 7: Language */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('language')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="globe-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Language</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{language || 'Not set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 8: Billing address */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('billing')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="home-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Billing address</Text>
              {billingCountry || billingCity || billingStreet ? (
                <>
                  <Text style={[styles.rowValue, { color: textSecondary }]}>
                    {[billingCountry, billingCity].filter(Boolean).join(' • ')}
                  </Text>
                  <Text style={[styles.rowSubValue, { color: textSecondary }]}>
                    {[billingStreet, billingPhone ? `Phone: ${billingPhone}` : null, billingPostal].filter(Boolean).join(' • ')}
                  </Text>
                </>
              ) : (
                <Text style={[styles.rowValue, { color: textSecondary }]}>Not set</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 9: Work address */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('work')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="briefcase-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Work address</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]}>{workAddress || 'Not set'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>

          <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />

          {/* Row 10: Bio & Social Website */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setActiveModal('bio')}
            activeOpacity={0.7}
          >
            <View style={styles.rowIconWrap}>
              <Ionicons name="information-circle-outline" size={22} color={textSecondary} />
            </View>
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowLabel, { color: textPrimary }]}>Bio & Website</Text>
              <Text style={[styles.rowValue, { color: textSecondary }]} numberOfLines={2}>
                {bio || 'Not set'}
              </Text>
              {!!website && (
                <Text style={[styles.rowSubValue, { color: COLORS.primary }]}>{website}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: EDIT BILLING ADDRESS                            */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* MODAL 1: EDIT BILLING ADDRESS                            */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'billing'}
        onClose={() => setActiveModal(null)}
        title="Edit Billing Address"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Select Country</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
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
          placeholder="e.g. Dhaka, Chittagong, etc."
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Street / House Address</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={billingStreet}
          onChangeText={setBillingStreet}
          placeholder="House, road, apartment, area"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Billing & Delivery Contact Mobile</Text>
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
          onPress={() => {
            const newBilling = {
              country: billingCountry.trim(),
              city: billingCity.trim(),
              address: billingStreet.trim(),
              phone: billingPhone.trim(),
              postalCode: billingPostal.trim(),
            };
            handleSaveFields({ billingAddress: newBilling, phone: billingPhone.trim() }, 'Billing address saved!');
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save Address</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 2: EDIT NAME & HANDLE                              */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'name'}
        onClose={() => setActiveModal(null)}
        title="Edit Name & Username"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Display Name</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Username (@handle)</Text>
        <View style={[styles.handleRow, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.primary, marginLeft: 12 }}>@</Text>
          <TextInput
            style={[styles.handleInput, { color: textPrimary }]}
            value={handle}
            onChangeText={(t) => setHandle(t.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
            placeholder="username"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => {
            if (!name.trim()) {
              Alert.alert('Required', 'Please enter your name.');
              return;
            }
            const cleanHandle = `@${handle.trim().replace(/^@/, '') || 'user'}`;
            handleSaveFields({ name: name.trim(), handle: cleanHandle }, 'Name and username updated!');
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 3: EDIT GENDER                                     */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'gender'}
        onClose={() => setActiveModal(null)}
        title="Gender"
        showCloseButton
      >
        {genderOptions.map((opt) => {
          const isSelected = gender === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                setGender(opt);
                handleSaveFields({ gender: opt }, 'Gender preference updated!');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }}
            >
              <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: isSelected ? COLORS.primary : textPrimary }}>
                {opt}
              </Text>
              {isSelected && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        })}
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 4: EDIT EMAIL                                      */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'email'}
        onClose={() => setActiveModal(null)}
        title="Email Addresses"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Primary Email (Tiwi Account)</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. user@gmail.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Recovery / Alternate Email</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={recoveryEmail}
          onChangeText={setRecoveryEmail}
          placeholder="e.g. recovery@gmail.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => {
            if (!email.trim()) {
              Alert.alert('Required', 'Primary email cannot be empty.');
              return;
            }
            handleSaveFields({ email: email.trim(), recoveryEmail: recoveryEmail.trim() }, 'Email addresses saved!');
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 5: EDIT PHONE                                      */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'phone'}
        onClose={() => setActiveModal(null)}
        title="Phone Numbers"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Primary Mobile Phone</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. +1 555-0199 or 01700-000000"
          placeholderTextColor={theme.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Backup Phone 1</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={backupPhone1}
          onChangeText={setBackupPhone1}
          placeholder="Alternate phone number"
          placeholderTextColor={theme.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Backup Phone 2</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={backupPhone2}
          onChangeText={setBackupPhone2}
          placeholder="Second backup phone number"
          placeholderTextColor={theme.textMuted}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => {
            const backups = [backupPhone1.trim(), backupPhone2.trim()].filter(Boolean);
            handleSaveFields({ phone: phone.trim(), backupPhones: backups }, 'Phone numbers updated!');
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 6: EDIT BIRTHDAY                                   */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'birthday'}
        onClose={() => setActiveModal(null)}
        title="Birthday"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Birth Date</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={birthday}
          onChangeText={setBirthday}
          placeholder="e.g. November 21, 2000 or YYYY-MM-DD"
          placeholderTextColor={theme.textMuted}
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => handleSaveFields({ birthday: birthday.trim() }, 'Birthday saved!')}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 7: EDIT LANGUAGE                                   */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'language'}
        onClose={() => setActiveModal(null)}
        title="Language"
        showCloseButton
      >
        {languages.map((l) => {
          const isSel = language === l;
          return (
            <TouchableOpacity
              key={l}
              onPress={async () => {
                setLanguage(l);
                try {
                  await TiwiAPI.updateAdvancedSettings({ language: l }, currentUser?.id);
                  setCurrentUser((p) => ({
                    ...p,
                    advancedSettings: { ...(p?.advancedSettings || {}), language: l },
                  }));
                  setActiveModal(null);
                  Alert.alert('Language Updated', `Display language set to ${l}`);
                } catch (e) {
                  setActiveModal(null);
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dividerColor }}
            >
              <Text style={{ fontSize: 15, fontWeight: isSel ? '700' : '500', color: isSel ? COLORS.primary : textPrimary }}>
                {l}
              </Text>
              {isSel && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        })}
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 8: EDIT WORK ADDRESS                               */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'work'}
        onClose={() => setActiveModal(null)}
        title="Work / Studio Address"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Work Location / Store Name</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={workAddress}
          onChangeText={setWorkAddress}
          placeholder="e.g. Tiwi HQ, Dhaka or Not set"
          placeholderTextColor={theme.textMuted}
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => handleSaveFields({ workAddress: workAddress.trim() }, 'Work address updated!')}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* ======================================================== */}
      {/* MODAL 9: EDIT BIO & WEBSITE                              */}
      {/* ======================================================== */}
      <SharedDrawer
        visible={activeModal === 'bio'}
        onClose={() => setActiveModal(null)}
        title="Bio & Website"
        showCloseButton
      >
        <Text style={[styles.inputLabel, { color: textSecondary }]}>Bio</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground, minHeight: 70, textAlignVertical: 'top' }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others what you do or love..."
          placeholderTextColor={theme.textMuted}
          multiline
        />

        <Text style={[styles.inputLabel, { color: textSecondary }]}>Website Link</Text>
        <TextInput
          style={[styles.dialogInput, { color: textPrimary, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}
          value={website}
          onChangeText={setWebsite}
          placeholder="https://tiwlo.com"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => handleSaveFields({ bio: bio.trim(), website: website.trim() }, 'Bio & Website updated!')}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryActionBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </SharedDrawer>

      {/* Profile Picture Updated Bottom Sheet */}
      <SharedDrawer
        visible={avatarSuccessVisible}
        onClose={() => setAvatarSuccessVisible(false)}
        title="Profile picture updated"
        subtitle="Your new photo is now visible across Tiwi"
        footer={
          <TouchableOpacity
            style={[styles.drawerPillBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary }]}
            onPress={() => setAvatarSuccessVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.drawerPillBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Done</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.avatarSuccessBody}>
          <View style={styles.avatarSuccessPreviewWrap}>
            <Image
              source={{ uri: avatar || currentUser?.avatar }}
              style={styles.avatarSuccessPreviewImg}
            />
            <View style={styles.avatarSuccessGreenBadge}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
          </View>
          <Text style={[styles.avatarSuccessDesc, { color: textSecondary }]}>
            Your profile picture has been updated and is saved to your account.
          </Text>
        </View>
      </SharedDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 1. Header (Screenshot 2: ← Tiwi Account, Help, Search, Avatar)
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
  // 2. Big Headline (Screenshot 2)
  headline: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  // 3. Unified M3 Rounded Card (Screenshot 2)
  mainCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.rgba_0_0_0_0p04,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowIconWrap: {
    width: 32,
    marginRight: 14,
    alignItems: 'center',
  },
  rowTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowSublabel: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: {
    fontSize: 13.5,
    marginTop: 2,
  },
  rowSubValue: {
    fontSize: 12.5,
    marginTop: 1,
  },
  avatarThumbnailWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  avatarThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    marginBottom: 6,
  },
  handleInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 10,
    fontSize: 14.5,
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
  avatarSuccessBody: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  avatarSuccessPreviewWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarSuccessPreviewImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarSuccessGreenBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarSuccessDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  drawerPillBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  drawerPillBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

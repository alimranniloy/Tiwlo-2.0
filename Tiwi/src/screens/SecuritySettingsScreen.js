import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function SecuritySettingsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser?.twoFactorEnabled || false);
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleToggle2FA = (val) => {
    setTwoFactorEnabled(val);
    Alert.alert(
      val ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication Disabled',
      val
        ? 'A 6-digit verification code will be sent to your email whenever you sign in from a new device.'
        : 'Two-factor protection has been turned off.'
    );
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Required Fields', 'Please enter your current and new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await TiwiAPI.changePassword({ currentPassword, newPassword }, currentUser?.id);
      Alert.alert('Success', 'Your password has been changed securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Change Failed', err.message || 'Could not update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Password & Security</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Two-Factor Authentication */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Two-Factor Authentication</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Protect your account with an extra layer of email security
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
              trackColor={{ false: COLORS.hex_767577, true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* 2. Login Alerts */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="notifications" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Unrecognized Login Alerts</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Get an alert if someone logs into your account from an unrecognized device
              </Text>
            </View>
            <Switch
              value={loginAlertsEnabled}
              onValueChange={setLoginAlertsEnabled}
              trackColor={{ false: COLORS.hex_767577, true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* 3. Change Password Form */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="key" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Change Password</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Your password must be at least 6 characters
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Current Password</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1E232A : COLORS.hex_F8FAFC,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>New Password</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1E232A : COLORS.hex_F8FAFC,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>Confirm New Password</Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? COLORS.hex_1E232A : COLORS.hex_F8FAFC,
                  color: theme.text,
                  borderColor: theme.borderLight,
                },
              ]}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              placeholderTextColor={theme.textMuted}
            />

            <TouchableOpacity
              style={[
                styles.savePasswordBtn,
                { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary },
              ]}
              onPress={handleChangePassword}
              disabled={savingPassword}
              activeOpacity={0.85}
            >
              {savingPassword ? (
                <ActivityIndicator size="small" color={isDarkMode ? COLORS.hex_040E28 : COLORS.white} />
              ) : (
                <Text style={[styles.savePasswordText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>
                  Update Password
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Active Sessions */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Active Login Sessions</Text>
          <View style={[styles.sessionRow, { borderBottomColor: theme.borderLight }]}>
            <Ionicons name="phone-portrait-outline" size={24} color={theme.primary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionTitle, { color: theme.text }]}>Android Device (This phone)</Text>
              <Text style={[styles.sessionSub, { color: theme.textMuted }]}>Dhaka, Bangladesh • Active Now</Text>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Active</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  savePasswordBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  savePasswordText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: COLORS.hex_DEF7EC,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    color: COLORS.hex_03543F,
    fontSize: 11,
    fontWeight: '700',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../config/colors';

const STORAGE_KEY = '@tiwi_accessibility_prefs';

const FONT_SCALES = [
  { label: 'Small', scale: 0.9 },
  { label: 'Default', scale: 1.0 },
  { label: 'Large', scale: 1.15 },
  { label: 'Max', scale: 1.3 },
];

export default function AccessibilitySettingsScreen({ navigation, onNavigate, isDark }) {
  const insets = useSafeAreaInsets();
  const [fontScale, setFontScale] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [boldText, setBoldText] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [screenReaderHints, setScreenReaderHints] = useState(true);
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.fontScale !== undefined) setFontScale(parsed.fontScale);
        if (parsed.highContrast !== undefined) setHighContrast(parsed.highContrast);
        if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
        if (parsed.boldText !== undefined) setBoldText(parsed.boldText);
        if (parsed.dyslexicFont !== undefined) setDyslexicFont(parsed.dyslexicFont);
        if (parsed.screenReaderHints !== undefined) setScreenReaderHints(parsed.screenReaderHints);
        if (parsed.autoCaptions !== undefined) setAutoCaptions(parsed.autoCaptions);
      }
    } catch {
      // Clean fallback
    }
  };

  const persistSettings = async (updates) => {
    try {
      const current = {
        fontScale,
        highContrast,
        reduceMotion,
        boldText,
        dyslexicFont,
        screenReaderHints,
        autoCaptions,
        ...updates,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // Ignored
    }
  };

  const handleBack = () => {
    if (onNavigate) {
      onNavigate('feed');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const bg = highContrast ? (isDark ? COLORS.black : COLORS.white) : (isDark ? COLORS.hex_0B0F19 : COLORS.white);
  const surface = highContrast ? (isDark ? COLORS.hex_111111 : COLORS.hex_F4F4F4) : (isDark ? COLORS.hex_161D2C : COLORS.white);
  const text = isDark ? COLORS.white : COLORS.hex_0F172A;
  const textMuted = isDark ? COLORS.hex_A1A1AA : COLORS.hex_64748B;
  const border = highContrast ? (isDark ? COLORS.white : COLORS.black) : (isDark ? COLORS.hex_2D3748 : COLORS.hex_E2E8F0);
  const primary = COLORS.hex_2563EB;

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: text }]}>Accessibility & Display</Text>
          <Text style={[styles.headerSub, { color: textMuted }]}>Vision, contrast, and motion adjustments</Text>
        </View>
        {savedSuccess ? (
          <View style={styles.savedPill}>
            <MaterialCommunityIcons name="check" size={14} color={COLORS.hex_10B981} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Interactive Live Preview Box */}
        <View style={[styles.previewCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.previewHeader}>
            <MaterialCommunityIcons name="eye-check-outline" size={20} color={primary} />
            <Text style={[styles.previewTitle, { color: text }]}>Live Readability Preview</Text>
          </View>
          <Text
            style={[
              styles.previewSample,
              {
                color: text,
                fontSize: 15 * fontScale,
                fontWeight: boldText ? '700' : '400',
              },
            ]}
          >
            &quot;The secret of getting ahead is getting started. Break your complex tasks into manageable steps.&quot;
          </Text>
          <Text style={[styles.previewSub, { color: textMuted, fontSize: 12 * fontScale }]}>
            Scale: {Math.round(fontScale * 100)}% &bull; High Contrast: {highContrast ? 'Active' : 'Off'}
          </Text>
        </View>

        {/* Section: Typography & Sizing */}
        <Text style={[styles.sectionHeading, { color: text }]}>Text Size & Readability</Text>
        <View style={[styles.settingGroup, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.settingItemCol}>
            <Text style={[styles.itemTitle, { color: text }]}>Font Scale</Text>
            <Text style={[styles.itemSub, { color: textMuted }]}>Adjust text scale across all feeds and screens</Text>
            <View style={styles.scaleRow}>
              {FONT_SCALES.map((s) => {
                const active = fontScale === s.scale;
                return (
                  <TouchableOpacity
                    key={s.label}
                    style={[
                      styles.scaleBtn,
                      {
                        backgroundColor: active ? primary : bg,
                        borderColor: active ? primary : border,
                      },
                    ]}
                    onPress={() => {
                      setFontScale(s.scale);
                      persistSettings({ fontScale: s.scale });
                    }}
                  >
                    <Text style={[styles.scaleBtnText, { color: active ? COLORS.white : text }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>Bold Text</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Increases thickness of text for higher legibility</Text>
            </View>
            <Switch
              value={boldText}
              onValueChange={(val) => {
                setBoldText(val);
                persistSettings({ boldText: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>Dyslexia-Friendly Layout</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Enhances letter-spacing and word-spacing</Text>
            </View>
            <Switch
              value={dyslexicFont}
              onValueChange={(val) => {
                setDyslexicFont(val);
                persistSettings({ dyslexicFont: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>
        </View>

        {/* Section: Contrast & Motion */}
        <Text style={[styles.sectionHeading, { color: text }]}>Visual Contrast & Motion</Text>
        <View style={[styles.settingGroup, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>High Contrast Mode</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Maximizes contrast between text and background surfaces</Text>
            </View>
            <Switch
              value={highContrast}
              onValueChange={(val) => {
                setHighContrast(val);
                persistSettings({ highContrast: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>Reduce Motion</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Minimizes screen transitions, autoplay, and bounce animations</Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(val) => {
                setReduceMotion(val);
                persistSettings({ reduceMotion: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>
        </View>

        {/* Section: Screen Reader & Media */}
        <Text style={[styles.sectionHeading, { color: text }]}>Screen Reader & Captions</Text>
        <View style={[styles.settingGroup, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>Auto-Generate Video Captions</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Displays live closed captions automatically on short video feeds</Text>
            </View>
            <Switch
              value={autoCaptions}
              onValueChange={(val) => {
                setAutoCaptions(val);
                persistSettings({ autoCaptions: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.settingItemRow}>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: text }]}>Enhanced Screen Reader Hints</Text>
              <Text style={[styles.itemSub, { color: textMuted }]}>Provides extended accessibility labels for interactive actions</Text>
            </View>
            <Switch
              value={screenReaderHints}
              onValueChange={(val) => {
                setScreenReaderHints(val);
                persistSettings({ screenReaderHints: val });
              }}
              trackColor={{ false: border, true: primary }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: COLORS.hex_DCFCE7 },
  savedText: { fontSize: 12, color: COLORS.hex_10B981, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  previewCard: { padding: 18, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '700' },
  previewSample: { lineHeight: 22, marginBottom: 8 },
  previewSub: { fontSize: 12 },
  sectionHeading: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  settingGroup: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  settingItemCol: { padding: 16 },
  settingItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  textWrap: { flex: 1, marginRight: 16 },
  itemTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  itemSub: { fontSize: 12, lineHeight: 16 },
  scaleRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  scaleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  scaleBtnText: { fontSize: 13, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
});

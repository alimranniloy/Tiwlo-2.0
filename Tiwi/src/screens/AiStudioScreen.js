import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function AiStudioScreen({ onNavigate }) {
  const { theme, isDarkMode } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('Engaging & Viral');
  const [format, setFormat] = useState('Single Post');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const tones = ['Engaging & Viral', 'Professional & Tech', 'Inspirational', 'Casual & Friendly', 'Humorous'];
  const formats = ['Single Post', 'Short-Form Reel Script', 'Thread Outline', 'Hashtags Only'];

  const handleGenerate = () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt Required', 'Please enter a topic or rough thoughts for the AI assistant.');
      return;
    }

    setGenerating(true);
    setResult('');

    setTimeout(() => {
      let output = '';
      if (format === 'Single Post') {
        output = `🚀 The future of social media isn't just algorithmic feeds—it's genuine community connection and creator sovereignty.\n\nHere is what we are building with Tiwi:\n1. Zero data exploitation\n2. Real-time audio stages & community circles\n3. Hardware-accelerated creative expression\n\nWhat is your biggest frustration with legacy platforms right now? Drop your thoughts below! 👇\n\n#TechInnovation #CreatorEconomy #FutureOfSocial #Tiwi`;
      } else if (format === 'Short-Form Reel Script') {
        output = `[HOOK - 0:00 to 0:03]:\n"Stop scrolling if you are building mobile apps in 2026!"\n\n[BODY - 0:03 to 0:15]:\nMost apps feel sluggish because of giant unoptimized bundles. Here are the 3 secrets top engineering teams use: lazy screen loaders, hardware video transcoding, and edge PostgreSQL caching.\n\n[CTA - 0:15 to 0:20]:\nFollow for more daily developer blueprints! 💡`;
      } else if (format === 'Thread Outline') {
        output = `🧵 THREAD: 5 Architectural principles for scaling modern mobile apps to 10M+ users:\n\n1/5: Never load all screens on cold start. Use lazy dynamic loaders.\n2/5: Offload video transcoding to cluster FFmpeg workers.\n3/5: Decouple database reads via real-time WebSocket subscriptions.\n4/5: Enforce zero-dummy-data test integrity.\n5/5: Build clean, spacious Google-inspired interfaces.`;
      } else {
        output = `#MobileDev #SoftwareArchitecture #ReactNative #PostgreSQL #DesignSystems #TechInnovation #CreatorEconomy #UIUX`;
      }

      setResult(output);
      setGenerating(false);
    }, 1200);
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Tiwi AI Content Studio</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.bannerRow}>
            <View style={[styles.aiIconCircle, { backgroundColor: COLORS.rgba_168_85_247_0p14 }]}>
              <Ionicons name="sparkles" size={24} color={COLORS.hex_A855F7} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>AI Creative Assistant</Text>
              <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
                Draft viral posts, video scripts, and hashtags in seconds
              </Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>What is on your mind?</Text>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
            ]}
            placeholder="e.g. Share an update on our new open-source mobile architecture and invite developer feedback"
            placeholderTextColor={theme.textSecondary}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Tone Selector */}
          <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Desired Tone</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {tones.map((t) => {
              const isSelected = tone === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? COLORS.hex_A855F7
                        : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                    },
                  ]}
                  onPress={() => setTone(t)}
                >
                  <Text style={[styles.chipText, { color: isSelected ? COLORS.white : theme.text }]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Format Selector */}
          <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Output Format</Text>
          <View style={styles.formatRow}>
            {formats.map((f) => {
              const isSelected = format === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.formatBtn,
                    {
                      backgroundColor: isSelected
                        ? COLORS.hex_A855F7
                        : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                    },
                  ]}
                  onPress={() => setFormat(f)}
                >
                  <Text style={[styles.formatBtnText, { color: isSelected ? COLORS.white : theme.text }]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: COLORS.hex_A855F7 }]}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.generateBtnText}>Generate with Tiwi AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Result Preview Box */}
        {!!result && (
          <View style={[styles.resultCard, { backgroundColor: theme.cardBg, borderColor: COLORS.hex_A855F7 }]}>
            <View style={styles.resultHeaderRow}>
              <View style={styles.aiResultPill}>
                <Ionicons name="checkmark-done" size={14} color={COLORS.hex_A855F7} style={{ marginRight: 4 }} />
                <Text style={styles.aiResultPillText}>Generated Draft</Text>
              </View>

              <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copied ? COLORS.hex_10B981 : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.copyBtnText, { color: copied ? COLORS.hex_10B981 : theme.textSecondary }]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.resultBodyText, { color: theme.text }]}>{result}</Text>
          </View>
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
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 4,
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
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  formatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  formatBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  generateBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aiResultPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiResultPillText: {
    color: COLORS.hex_A855F7,
    fontSize: 12,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultBodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

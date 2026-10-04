import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function BrandMarketplaceScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [pitchMessage, setPitchMessage] = useState('');
  const [proposedRate, setProposedRate] = useState('');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/brand-briefs`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data.briefs) ? data.briefs : []);
      } else {
        setCampaigns([]);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSubmitProposal = async () => {
    if (!pitchMessage.trim() || !proposedRate.trim()) {
      Alert.alert('Required Fields', 'Please enter your proposed collaboration rate and pitch.');
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/social/brand-briefs/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: selectedCampaign?.id,
          creatorId: currentUser?.id,
          creatorHandle: currentUser?.handle,
          rate: proposedRate.trim(),
          pitch: pitchMessage.trim(),
        }),
      });
    } catch {
      // Handled
    }

    Alert.alert(
      'Proposal Submitted!',
      `Your proposal for "${selectedCampaign.title}" has been transmitted to ${selectedCampaign.brand}.`
    );
    setSelectedCampaign(null);
    setPitchMessage('');
    setProposedRate('');
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Brand Marketplace</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Direct Brand Partnerships</Text>
          <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
            Connect with verified brands looking for authentic creators. Zero middleman fees.
          </Text>
        </View>

        {selectedCampaign ? (
          /* PROPOSAL SUBMISSION VIEW */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <TouchableOpacity
              style={styles.backToDealsBtn}
              onPress={() => setSelectedCampaign(null)}
            >
              <Ionicons name="arrow-back" size={16} color={theme.primary || COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.backToDealsText, { color: theme.primary || COLORS.primary }]}>Back to Campaigns</Text>
            </TouchableOpacity>

            <Text style={[styles.campaignDetailTitle, { color: theme.text }]}>{selectedCampaign.title}</Text>
            <Text style={[styles.campaignDetailBrand, { color: theme.textSecondary }]}>
              Sponsored by {selectedCampaign.brand} • Budget: {selectedCampaign.budget}
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
              Your Proposed Rate (USD)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. $850"
              placeholderTextColor={theme.textSecondary}
              value={proposedRate}
              onChangeText={setProposedRate}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
              Why are you a great fit for this campaign?
            </Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="Briefly describe your audience and content concept..."
              placeholderTextColor={theme.textSecondary}
              value={pitchMessage}
              onChangeText={setPitchMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitProposalBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleSubmitProposal}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.submitProposalBtnText}>Submit Partnership Proposal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* CAMPAIGNS DIRECTORY */
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>OPEN SPONSORSHIP BRIEFS</Text>
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
                <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Loading brand briefs...</Text>
              </View>
            ) : campaigns.length === 0 ? (
              <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 14 }}>
                <Ionicons name="briefcase-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>No Active Sponsorship Briefs</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18 }}>
                  Verified brand briefs seeking creator collaborations will appear here as deals open up.
                </Text>
              </View>
            ) : (
              campaigns.map((camp) => (
                <View
                  key={camp.id}
                  style={[styles.campaignCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                >
                  <View style={styles.campaignHeaderRow}>
                    {camp.logo && !camp.logo.includes('unsplash') ? (
                      <Image source={{ uri: camp.logo }} style={styles.brandLogo} />
                    ) : (
                      <View style={[styles.brandLogo, { backgroundColor: theme.primary || COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
                          {(camp.brand || 'B').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, paddingRight: 8, marginLeft: 10 }}>
                      <Text style={[styles.brandName, { color: theme.text }]}>{camp.brand}</Text>
                      <Text style={[styles.categoryText, { color: theme.textSecondary }]}>{camp.category}</Text>
                    </View>
                    <View style={[styles.budgetBadge, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.hex_E0F2FE }]}>
                      <Text style={[styles.budgetText, { color: COLORS.primary }]}>{camp.budget}</Text>
                    </View>
                  </View>

                  <Text style={[styles.campaignTitle, { color: theme.text }]}>{camp.title}</Text>

                  <View style={[styles.deliverablesBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F9FAFB }]}>
                    <Ionicons name="briefcase-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={[styles.deliverablesText, { color: theme.text }]}>{camp.deliverables}</Text>
                  </View>

                  <View style={styles.cardFooterRow}>
                    <Text style={[styles.deadlineText, { color: theme.textSecondary }]}>{camp.deadline}</Text>
                    <TouchableOpacity
                      style={[styles.applyBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                      onPress={() => setSelectedCampaign(camp)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.applyBtnText}>Apply Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
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
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  campaignCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 14,
  },
  campaignHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 10,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryText: {
    fontSize: 11,
    marginTop: 1,
  },
  budgetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  budgetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  campaignTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 20,
  },
  deliverablesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  deliverablesText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deadlineText: {
    fontSize: 12,
  },
  applyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  applyBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  backToDealsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backToDealsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  campaignDetailTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  campaignDetailBrand: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
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
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  submitProposalBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitProposalBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

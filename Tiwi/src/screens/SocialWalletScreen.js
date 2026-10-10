import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function SocialWalletScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [balance, setBalance] = useState(0.00);
  const [recipient, setRecipient] = useState('');
  const [tipAmount, setTipAmount] = useState('5.00');
  const [tipNote, setTipNote] = useState('');
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'tip' | 'topup'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/social/wallet/balance?userId=${userId || ''}`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
        fetch(`${API_BASE_URL}/api/social/wallet/transactions?userId=${userId || ''}`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
      ]);

      if (balRes && balRes.ok) {
        const balData = await balRes.json();
        setBalance(typeof balData.balance === 'number' ? balData.balance : parseFloat(balData.balance || 0));
      }

      if (txRes && txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData.transactions) ? txData.transactions : []);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleSendTip = async () => {
    const amt = parseFloat(tipAmount);
    if (!recipient.trim()) {
      Alert.alert('Recipient Required', 'Please enter a @handle or user name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid tip amount.');
      return;
    }
    if (amt > balance) {
      Alert.alert('Insufficient Balance', 'Please top up your Tiwi Wallet to complete this tip.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/wallet/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recipient: recipient.trim(),
          amount: amt,
          note: tipNote.trim() || 'Tip sent with Tiwi Wallet',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBalance((prev) => Math.max(0, prev - amt));
        const newTx = data.transaction || {
          id: `tx-${Date.now()}`,
          type: 'sent',
          to: recipient.trim(),
          handle: recipient.trim().startsWith('@') ? recipient.trim() : `@${recipient.trim()}`,
          amount: `-$${amt.toFixed(2)}`,
          note: tipNote || 'Tip sent with Tiwi Wallet',
          date: 'Just now',
        };
        setTransactions([newTx, ...transactions]);
        setRecipient('');
        setTipNote('');
        setActiveTab('transactions');
        Alert.alert('Tip Sent!', `Successfully sent $${amt.toFixed(2)} to ${recipient.trim()}.`);
      } else {
        Alert.alert('Transaction Failed', 'Server was unable to process the tip.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopUp = async (amt) => {
    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/wallet/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: amt,
          source: 'Connected Payment Card',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBalance((prev) => prev + amt);
        const newTx = data.transaction || {
          id: `tx-${Date.now()}`,
          type: 'topup',
          source: 'Connected Card',
          amount: `+$${amt.toFixed(2)}`,
          note: 'Wallet balance reload',
          date: 'Just now',
        };
        setTransactions([newTx, ...transactions]);
        setActiveTab('transactions');
        Alert.alert('Balance Loaded', `$${amt.toFixed(2)} added to your Tiwi Wallet.`);
      } else {
        Alert.alert('Top Up Failed', 'Unable to charge payment card.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Social Wallet & Tips</Text>
        <TouchableOpacity
          onPress={() => setActiveTab('topup')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchWallet();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.primary || COLORS.primary }]}>
          <View style={styles.balanceTopRow}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
            </View>
            <View style={styles.walletIconCircle}>
              <Ionicons name="wallet-outline" size={28} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.balanceActionRow}>
            <TouchableOpacity
              style={styles.balanceActionBtn}
              onPress={() => setActiveTab('tip')}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={15} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.balanceActionText}>Send Tip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.balanceActionBtn, styles.topUpBtn]}
              onPress={() => setActiveTab('topup')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.balanceActionText, { color: COLORS.primary }]}>Top Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Selection */}
        <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'transactions' && styles.activeTabBtn]}
            onPress={() => setActiveTab('transactions')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'transactions' ? (theme.primary || COLORS.primary) : theme.textSecondary },
                activeTab === 'transactions' && { fontWeight: '700' },
              ]}
            >
              Activity
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tip' && styles.activeTabBtn]}
            onPress={() => setActiveTab('tip')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'tip' ? (theme.primary || COLORS.primary) : theme.textSecondary },
                activeTab === 'tip' && { fontWeight: '700' },
              ]}
            >
              Tip Creator
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'topup' && styles.activeTabBtn]}
            onPress={() => setActiveTab('topup')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'topup' ? (theme.primary || COLORS.primary) : theme.textSecondary },
                activeTab === 'topup' && { fontWeight: '700' },
              ]}
            >
              Reload
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'tip' ? (
          /* SEND TIP FORM */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Tip a Creator</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              Reward high-signal posts, great reels, and live stream hosts directly
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Creator Username or Handle</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="@username"
              placeholderTextColor={theme.textSecondary}
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Tip Amount ($USD)</Text>
            <View style={styles.quickAmtRow}>
              {['2.00', '5.00', '10.00', '25.00'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.quickAmtChip,
                    tipAmount === amt && { backgroundColor: theme.primary || COLORS.primary, borderColor: theme.primary || COLORS.primary },
                    tipAmount !== amt && { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, borderColor: theme.borderLight },
                  ]}
                  onPress={() => setTipAmount(amt)}
                >
                  <Text style={[styles.quickAmtText, { color: tipAmount === amt ? COLORS.white : theme.text }]}>${amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight, marginTop: 8 },
              ]}
              placeholder="Or enter custom amount"
              placeholderTextColor={theme.textSecondary}
              value={tipAmount}
              onChangeText={setTipAmount}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Note / Encouragement (Optional)</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Loved your latest tutorial!"
              placeholderTextColor={theme.textSecondary}
              value={tipNote}
              onChangeText={setTipNote}
            />

            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleSendTip}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.primaryActionText}>Send ${parseFloat(tipAmount || 0).toFixed(2)} Tip</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : activeTab === 'topup' ? (
          /* RELOAD WALLET */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Add Funds to Tiwi Wallet</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
              Instant zero-fee reload via credit card or digital payments
            </Text>

            <View style={styles.topUpGrid}>
              {[10, 25, 50, 100].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.topUpCard, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, borderColor: theme.borderLight }]}
                  onPress={() => handleTopUp(amt)}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.topUpAmount, { color: theme.text }]}>+${amt}</Text>
                  <Text style={[styles.topUpSub, { color: theme.textSecondary }]}>Instant Load</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* TRANSACTIONS ACTIVITY */
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>RECENT WALLET ACTIVITY</Text>

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading transactions...</Text>
              </View>
            ) : transactions.length === 0 ? (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Wallet Activity Yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Your sent tips, creator earnings, and wallet reloads will appear here.
                </Text>
                <TouchableOpacity
                  style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                  onPress={() => setActiveTab('topup')}
                >
                  <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.createFirstBtnText}>Reload Wallet</Text>
                </TouchableOpacity>
              </View>
            ) : (
              transactions.map((tx) => (
                <View
                  key={tx.id}
                  style={[styles.txCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                >
                  <View style={styles.txLeft}>
                    <View
                      style={[
                        styles.txIconCircle,
                        {
                          backgroundColor:
                            tx.type === 'received' || tx.type === 'topup'
                              ? COLORS.rgba_16_185_129_0p12
                              : COLORS.rgba_239_68_68_0p12,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          tx.type === 'received'
                            ? 'arrow-down'
                            : tx.type === 'topup'
                            ? 'wallet'
                            : 'arrow-up'
                        }
                        size={17}
                        color={tx.type === 'received' || tx.type === 'topup' ? COLORS.hex_10B981 : COLORS.hex_EF4444}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txParty, { color: theme.text }]}>
                        {tx.type === 'received'
                          ? `From ${tx.from || 'Creator'}`
                          : tx.type === 'topup'
                          ? tx.source || 'Wallet Reload'
                          : `To ${tx.to || 'Creator'}`}
                      </Text>
                      {tx.note ? (
                        <Text style={[styles.txNote, { color: theme.textSecondary }]} numberOfLines={1}>
                          {tx.note}
                        </Text>
                      ) : null}
                      <Text style={[styles.txDate, { color: theme.textSecondary }]}>{tx.date || 'Recent'}</Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'received' || tx.type === 'topup' ? COLORS.hex_10B981 : theme.text },
                    ]}
                  >
                    {tx.amount}
                  </Text>
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
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: COLORS.rgba_255_255_255_0p8,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceAmount: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '800',
  },
  walletIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.rgba_255_255_255_0p18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  balanceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.rgba_255_255_255_0p2,
  },
  topUpBtn: {
    backgroundColor: COLORS.white,
  },
  balanceActionText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: COLORS.rgba_11_87_208_0p08,
  },
  tabText: {
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  quickAmtRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAmtChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmtText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    marginTop: 20,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  topUpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  topUpCard: {
    width: '48%',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  topUpAmount: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  topUpSub: {
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createFirstBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  txIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txParty: {
    fontSize: 14,
    fontWeight: '700',
  },
  txNote: {
    fontSize: 12,
    marginTop: 2,
  },
  txDate: {
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import {
  getPickAccountAppeal,
  getStoredPickSession,
  PickAccountDisabledError,
  PickAccountRestoredError,
  PickAccountAppeal,
  PickUser,
  submitPickAccountAppeal
} from '../services/auth';

interface AccountDisabledScreenProps {
  user: PickUser | null;
  onSignOut: () => void;
  onAccountRestored: (user: PickUser, requiresSignIn?: boolean) => void | Promise<void>;
}

function getStatus(status: string | undefined): string {
  return String(status || '').toUpperCase();
}

export const AccountDisabledScreen: React.FC<AccountDisabledScreenProps> = ({
  user,
  onSignOut,
  onAccountRestored
}) => {
  const { language, t } = useLanguage();
  const [appeal, setAppeal] = useState<PickAccountAppeal | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoring, setRestoring] = useState(false);

  const loadAppeal = useCallback(async () => {
    setError('');
    try {
      const currentAppeal = await getPickAccountAppeal();
      setAppeal(currentAppeal);
      setFormOpen(getStatus(currentAppeal?.status) === 'REJECTED');
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : language === 'bn'
          ? 'আপনার সাপোর্ট অনুরোধটি লোড করা যায়নি।'
          : 'Could not load your support request.');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    let active = true;
    let checking = false;
    const refreshAccount = async () => {
      if (!active || checking || AppState.currentState !== 'active') return;
      checking = true;
      try {
        const session = await getStoredPickSession();
        if (session && active && !restoring) {
          setRestoring(true);
          await onAccountRestored(session.user);
        }
      } catch (statusError) {
        if (statusError instanceof PickAccountRestoredError && active) {
          setRestoring(true);
          await onAccountRestored(statusError.user, true);
          return;
        }
        setRestoring(false);
        if (!(statusError instanceof PickAccountDisabledError) && active) {
          setError(statusError instanceof Error
            ? statusError.message
            : language === 'bn'
              ? 'অ্যাকাউন্টের অবস্থা দেখা যায়নি।'
              : 'Could not refresh account status.');
        }
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void refreshAccount(), 10000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAccount();
    });
    void refreshAccount();
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [language, onAccountRestored, restoring]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadAppeal(), 0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void loadAppeal();
    }, 30000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [loadAppeal]);

  const submitAppeal = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 20) {
      setError(t(
        'Please describe your situation in at least 20 characters.',
        'কমপক্ষে ২০ অক্ষরে আপনার বিষয়টি লিখুন।'
      ));
      return;
    }

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const createdAppeal = await submitPickAccountAppeal(trimmedMessage);
      setAppeal(createdAppeal);
      setMessage('');
      setFormOpen(false);
      setNotice(t(
        'Your request was submitted. The Tiwlo account team will review it.',
        'আপনার অনুরোধ জমা হয়েছে। Tiwlo অ্যাকাউন্ট টিম এটি পর্যালোচনা করবে।'
      ));
    } catch (submitError) {
      setError(submitError instanceof Error
        ? submitError.message
        : t('Your request could not be submitted. Please try again.', 'অনুরোধ জমা হয়নি। আবার চেষ্টা করুন।'));
    } finally {
      setSubmitting(false);
    }
  };

  const status = getStatus(appeal?.status);
  const isPending = status === 'OPEN' || status === 'IN_PROGRESS';
  const isRejected = status === 'REJECTED';
  const isResolved = status === 'RESOLVED';

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 28 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.illustrationWrap}>
          <Image
            source={require('../../assets/images/disable-animation.gif')}
            style={styles.illustration}
            resizeMode="contain"
            accessibilityLabel={t('Account access restricted', 'অ্যাকাউন্ট ব্যবহার সীমাবদ্ধ')}
          />
        </View>

        <Text style={styles.eyebrow}>{t('ACCOUNT STATUS', 'অ্যাকাউন্টের অবস্থা')}</Text>
        <Text style={styles.title}>{t('Your account is disabled', 'আপনার অ্যাকাউন্টটি বন্ধ')}</Text>
        <Text style={styles.description}>
          {t(
            'You cannot use PICK while your Tiwlo account is disabled. If you think this is a mistake, send a review request to the account team.',
            'আপনার Tiwlo অ্যাকাউন্ট বন্ধ থাকায় PICK ব্যবহার করা যাচ্ছে না। মনে হলে এটি ভুল, অ্যাকাউন্ট টিমের কাছে পর্যালোচনার অনুরোধ পাঠান।'
          )}
        </Text>

        {Boolean(user?.email) && (
          <View style={styles.accountSummary}>
            {user?.avatar && /^https?:\/\//i.test(user.avatar) ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{(user?.name || user?.email || 'P').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.accountEmail}>{user?.email}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#18181B" />
            <Text style={styles.loadingText}>{t('Checking your support request…', 'আপনার সাপোর্ট অনুরোধ দেখা হচ্ছে…')}</Text>
          </View>
        ) : (
          <>
            {isPending && (
              <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>{t('Review request submitted', 'পর্যালোচনার অনুরোধ জমা হয়েছে')}</Text>
                <Text style={styles.statusText}>
                  {t(
                    `Request ${appeal?.ticketId || ''} is ${status === 'IN_PROGRESS' ? 'being reviewed' : 'waiting for review'}.`,
                    `অনুরোধ ${appeal?.ticketId || ''} ${status === 'IN_PROGRESS' ? 'পর্যালোচনা করা হচ্ছে' : 'পর্যালোচনার অপেক্ষায় আছে'}।`
                  )}
                </Text>
              </View>
            )}

            {isResolved && (
              <View style={styles.statusCard}>
                <Text style={styles.statusTitle}>{t('Review completed', 'পর্যালোচনা সম্পন্ন')}</Text>
                <Text style={styles.statusText}>
                  {appeal?.resolutionNotes || t(
                    'The account team has completed its review.',
                    'অ্যাকাউন্ট টিম পর্যালোচনা সম্পন্ন করেছে।'
                  )}
                </Text>
              </View>
            )}

            {isRejected && (
              <View style={styles.rejectedCard}>
                <Text style={styles.rejectedTitle}>{t('More information needed', 'আরও তথ্য প্রয়োজন')}</Text>
                <Text style={styles.statusText}>
                  {appeal?.resolutionNotes || t(
                    'Your previous request was declined. You can send a new request with more details.',
                    'আগের অনুরোধটি গ্রহণ করা হয়নি। বিস্তারিত তথ্য দিয়ে নতুন অনুরোধ পাঠাতে পারেন।'
                  )}
                </Text>
              </View>
            )}

            {!appeal && !error && !formOpen && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setFormOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>{t('Contact support', 'সাপোর্টে যোগাযোগ করুন')}</Text>
              </TouchableOpacity>
            )}

            {formOpen && !isPending && !isResolved && (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{t('Request an account review', 'অ্যাকাউন্ট পর্যালোচনার অনুরোধ')}</Text>
                <Text style={styles.formHint}>
                  {t(
                    'Explain what happened. Your request will be sent securely to the Tiwlo account team.',
                    'কী ঘটেছে তা লিখুন। আপনার অনুরোধ নিরাপদে Tiwlo অ্যাকাউন্ট টিমের কাছে পাঠানো হবে।'
                  )}
                </Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('Write your message…', 'আপনার বার্তা লিখুন…')}
                  placeholderTextColor="#A1A1AA"
                  multiline
                  maxLength={5000}
                  textAlignVertical="top"
                  editable={!submitting}
                />
                <Text style={styles.characterCount}>{message.length}/5000</Text>
                <TouchableOpacity
                  style={[styles.primaryButton, submitting && styles.disabledButton]}
                  onPress={() => void submitAppeal()}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.primaryButtonText}>{t('Submit request', 'অনুরোধ জমা দিন')}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {Boolean(notice) && <Text accessibilityRole="status" style={styles.noticeText}>{notice}</Text>}
            {Boolean(error) && (
              <View>
                <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => void loadAppeal()} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('Try again', 'আবার চেষ্টা করুন')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <TouchableOpacity onPress={onSignOut} style={styles.signOutButton} activeOpacity={0.75}>
          <Text style={styles.signOutText}>{t('Sign out', 'লগ আউট')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    backgroundColor: '#FFFFFF'
  },
  illustrationWrap: {
    width: 112,
    height: 112,
    alignSelf: 'center',
    marginBottom: 18
  },
  illustration: { width: '100%', height: '100%' },
  eyebrow: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center'
  },
  title: {
    color: '#18181B',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 8
  },
  description: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 22
  },
  accountSummary: { alignItems: 'center', marginBottom: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, marginBottom: 9 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9
  },
  avatarInitial: { color: '#27272A', fontSize: 19, fontWeight: '700' },
  accountEmail: { color: '#52525B', fontSize: 14, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  loadingText: { color: '#71717A', fontSize: 13 },
  statusCard: {
    backgroundColor: '#F4F7F5',
    borderColor: '#DDE8DF',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    marginBottom: 14
  },
  statusTitle: { color: '#166534', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  statusText: { color: '#52525B', fontSize: 13, lineHeight: 19 },
  rejectedCard: {
    backgroundColor: '#FFF8F1',
    borderColor: '#F1DEC8',
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    marginBottom: 14
  },
  rejectedTitle: { color: '#9A3412', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 16,
    marginTop: 5
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabledButton: { opacity: 0.65 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E4E7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 4
  },
  formTitle: { color: '#18181B', fontSize: 16, fontWeight: '700' },
  formHint: { color: '#71717A', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 13 },
  messageInput: {
    minHeight: 132,
    borderColor: '#D4D4D8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#18181B',
    backgroundColor: '#FFFFFF'
  },
  characterCount: { color: '#A1A1AA', fontSize: 11, textAlign: 'right', marginTop: 6 },
  noticeText: { color: '#166534', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  retryButton: { alignSelf: 'center', padding: 10 },
  retryText: { color: '#27272A', fontSize: 13, fontWeight: '600' },
  signOutButton: { alignSelf: 'center', paddingVertical: 20, paddingHorizontal: 16, marginTop: 4 },
  signOutText: { color: '#71717A', fontSize: 13, fontWeight: '600' }
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AddressVerificationScreen } from '../../../mobile/src/screens/AddressVerificationScreen';
import { PickLogo } from '../../../mobile/src/components/common/PickLogo';
import type { PickUser } from '../../../mobile/src/services/auth';
import {
  clearStoredPickSession,
  getStoredPickSession,
  PickAccountDisabledError,
  PickAccountRestoredError
} from '../../../mobile/src/services/auth';
import {
  acceptDeliveryOffer,
  DeliveryJob,
  DeliveryOffer,
  DeliveryPolicy,
  DeliveryProfile,
  getDeliveryJobs,
  getDeliveryOffers,
  getDeliveryOptions,
  getDeliveryProfile,
  removeDeliveryPushToken,
  submitDeliveryApplication,
  updateDeliveryJob
} from '../services/deliveryApi';
import {
  goOffDeliveryDuty,
  goOnDeliveryDuty,
  restoreDeliveryTracking,
  stopDeliveryLocationTracking
} from '../services/deliveryLocation';

interface DeliveryAppProps {
  user: PickUser;
  onSignOut: () => void | Promise<void>;
  onAccountDisabled: (user: PickUser) => void;
}

const formatDistance = (meters: number) => meters >= 1000
  ? `${(meters / 1000).toFixed(meters % 1000 ? 1 : 0)} km`
  : `${meters} m`;

function DeliveryApplication({
  options,
  currentProfile,
  onSubmitted,
  onSignOut
}: {
  options: DeliveryPolicy[];
  currentProfile: DeliveryProfile | null;
  onSubmitted: (profile: DeliveryProfile) => void;
  onSignOut: () => void;
}) {
  const [vehicleType, setVehicleType] = useState(currentProfile?.vehicleType || options[0]?.vehicleType || '');
  const [capacity, setCapacity] = useState(String(
    currentProfile?.vehicleCapacityKg || options[0]?.maxCapacityKg || ''
  ));
  const [registration, setRegistration] = useState(currentProfile?.vehicleRegistration || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedPolicy = options.find((policy) => policy.vehicleType === vehicleType) || options[0];
  const requiresRegistration = ['motorbike', 'car', 'pickup'].includes(vehicleType);

  const apply = async () => {
    if (!selectedPolicy) {
      setError('No delivery vehicles are available right now.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const profile = await submitDeliveryApplication({
        vehicleType: selectedPolicy.vehicleType,
        vehicleCapacityKg: Number(capacity),
        vehicleRegistration: registration.trim()
      });
      onSubmitted(profile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your application.');
    } finally {
      setBusy(false);
    }
  };

  if (currentProfile?.applicationStatus === 'pending') {
    return (
      <PageFrame onSignOut={onSignOut}>
        <View style={styles.statusCard}>
          <Text style={styles.eyebrow}>APPLICATION RECEIVED</Text>
          <Text style={styles.heading}>We’re reviewing your details</Text>
          <Text style={styles.bodyText}>
            Your {currentProfile.vehicleName} application is waiting for PICK approval. We’ll show your duty controls here when it is approved.
          </Text>
          <View style={styles.statusPill}><Text style={styles.statusPillText}>Pending review</Text></View>
        </View>
      </PageFrame>
    );
  }

  return (
    <PageFrame onSignOut={onSignOut}>
      <View style={styles.introBlock}>
        <Text style={styles.eyebrow}>DELIVER WITH PICK</Text>
        <Text style={styles.heading}>{currentProfile ? 'Update your vehicle details' : 'Set up your delivery profile'}</Text>
        <Text style={styles.bodyText}>Choose your vehicle and real carrying capacity. PICK reviews every application before duty can start.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Your delivery vehicle</Text>
        <View style={styles.vehicleGrid}>
          {options.map((policy) => {
            const selected = policy.vehicleType === vehicleType;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={policy.vehicleType}
                onPress={() => {
                  setVehicleType(policy.vehicleType);
                  setCapacity(String(Math.min(Number(capacity) || policy.maxCapacityKg, policy.maxCapacityKg)));
                }}
                style={[styles.vehicleOption, selected && styles.vehicleOptionSelected]}
              >
                <Text style={[styles.vehicleName, selected && styles.vehicleNameSelected]}>{policy.nameEn}</Text>
                <Text style={[styles.vehicleLimit, selected && styles.vehicleNameSelected]}>
                  Up to {policy.maxCapacityKg} kg
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedPolicy && (
          <Text style={styles.policyHint}>
            Pickup: within {formatDistance(selectedPolicy.pickupRangeMeters)} · delivery distance: up to {formatDistance(selectedPolicy.deliveryRangeMeters)}
          </Text>
        )}
        <Text style={[styles.fieldLabel, styles.topSpace]}>Your usable carrying capacity (kg)</Text>
        <TextInput
          accessibilityLabel="Vehicle carrying capacity in kilograms"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="decimal-pad"
          placeholder={`Maximum ${selectedPolicy?.maxCapacityKg ?? 0}`}
          style={styles.input}
        />
        {requiresRegistration && (
          <>
            <Text style={[styles.fieldLabel, styles.topSpace]}>Vehicle registration number</Text>
            <TextInput
              accessibilityLabel="Vehicle registration number"
              value={registration}
              onChangeText={setRegistration}
              autoCapitalize="characters"
              maxLength={80}
              placeholder="Registration number"
              style={styles.input}
            />
          </>
        )}
        {currentProfile?.applicationStatus === 'rejected' && (
          <Text style={styles.warningText}>
            {currentProfile.applicationNote || 'Your previous application was not approved. Update your details to apply again.'}
          </Text>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          title={busy ? 'Submitting…' : 'Submit for review'}
          onPress={() => void apply()}
          disabled={busy}
        />
      </View>
    </PageFrame>
  );
}

function DeliveryDashboard({
  userName,
  profile,
  offers,
  jobs,
  refreshing,
  error,
  pushWarning,
  onRefresh,
  onDutyChange,
  onJobUpdate,
  onAccept
}: {
  userName: string;
  profile: DeliveryProfile;
  offers: DeliveryOffer[];
  jobs: DeliveryJob[];
  refreshing: boolean;
  error: string;
  pushWarning: string;
  onRefresh: () => void;
  onDutyChange: (enabled: boolean) => void;
  onJobUpdate: (job: DeliveryJob, status: 'picked_up' | 'delivered' | 'cancelled') => void;
  onAccept: (offer: DeliveryOffer) => void;
}) {
  const activeJob = jobs[0];
  return (
    <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>PICK DELIVERY PARTNER</Text>
          <Text style={styles.heading}>Hi, {userName || 'Partner'}</Text>
        </View>
        <Pressable accessibilityLabel="Refresh jobs" onPress={onRefresh} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator color={GREEN} /> : <Text style={styles.refreshIcon}>↻</Text>}
        </Pressable>
      </View>

      <View style={[styles.dutyCard, profile.isOnDuty && styles.dutyCardOn]}>
        <View style={styles.dutyHeader}>
          <View style={[styles.dutyDot, profile.isOnDuty && styles.dutyDotOn]} />
          <Text style={styles.dutyTitle}>{profile.isOnDuty ? 'You’re on duty' : 'You’re off duty'}</Text>
        </View>
        <Text style={styles.dutyDescription}>
          {profile.isOnDuty
            ? 'PICK checks your live location and sends nearby parcel offers for your vehicle.'
            : 'Turn on duty when you’re ready to receive parcel offers.'}
        </Text>
        {pushWarning ? <Text style={styles.warningText}>{pushWarning}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          title={profile.isOnDuty ? 'End duty' : 'Go on duty'}
          onPress={() => onDutyChange(!profile.isOnDuty)}
          disabled={Boolean(activeJob) || refreshing}
          secondary={profile.isOnDuty}
        />
        {activeJob ? <Text style={styles.policyHint}>Finish your active parcel before ending duty.</Text> : null}
      </View>

      {activeJob ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your active parcel</Text>
          <Text style={styles.offerTitle}>{activeJob.parcelDetails.package?.categoryNameEn || 'Parcel'} · {activeJob.parcelDetails.package?.weight || '?'} kg</Text>
          <Text style={styles.detailLabel}>PICKUP</Text>
          <Text style={styles.detailText}>{activeJob.parcelDetails.sender?.address || 'Pickup address unavailable'}</Text>
          <Text style={styles.detailLabel}>DELIVER TO</Text>
          <Text style={styles.detailText}>{activeJob.parcelDetails.recipient?.address || activeJob.deliveryAddress}</Text>
          {activeJob.status === 'accepted' ? (
            <>
              <PrimaryButton title="Confirm parcel picked up" onPress={() => onJobUpdate(activeJob, 'picked_up')} disabled={refreshing} />
              <PrimaryButton title="Release parcel before pickup" onPress={() => onJobUpdate(activeJob, 'cancelled')} disabled={refreshing} secondary />
            </>
          ) : (
            <PrimaryButton title="Complete delivery" onPress={() => onJobUpdate(activeJob, 'delivered')} disabled={refreshing} />
          )}
        </View>
      ) : (
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Nearby parcel offers</Text>
            <Text style={styles.policyHint}>{profile.vehicleName} · up to {profile.vehicleCapacityKg} kg</Text>
          </View>
          <Text style={styles.offerCount}>{offers.length}</Text>
        </View>
      )}

      {!activeJob && (offers.length ? offers.map((offer) => (
        <View style={styles.card} key={offer.id}>
          <View style={styles.offerHeader}>
            <View>
              <Text style={styles.offerTitle}>{offer.category || 'Parcel'} · {offer.weightKg} kg</Text>
              <Text style={styles.offerSub}>{offer.vehicleName} · #{offer.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <Text style={styles.fare}>৳{Math.round(offer.total)}</Text>
          </View>
          <Text style={styles.detailLabel}>PICKUP</Text>
          <Text style={styles.detailText}>{offer.pickupAddress}</Text>
          <Text style={styles.detailLabel}>DELIVER TO</Text>
          <Text style={styles.detailText}>{offer.recipientAddress}</Text>
          <PrimaryButton title="Accept parcel" onPress={() => onAccept(offer)} disabled={refreshing} />
        </View>
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{profile.isOnDuty ? 'Looking for nearby parcels' : 'No active offers yet'}</Text>
          <Text style={styles.bodyText}>
            {profile.isOnDuty
              ? 'We’ll show new offers here when a parcel matches your vehicle, carrying capacity, distance, and PICK coverage.'
              : 'Go on duty to see parcels that match your vehicle and current PICK coverage.'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function PageFrame({
  children,
  onSignOut
}: {
  children: React.ReactNode;
  onSignOut: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <PickLogo variant="land-black" width={104} height={32} />
        <Pressable onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled = false,
  secondary = false
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, secondary && styles.secondaryButton, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.primaryButtonText, secondary && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

export function DeliveryApp({ user, onSignOut, onAccountDisabled }: DeliveryAppProps) {
  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [options, setOptions] = useState<DeliveryPolicy[]>([]);
  const [addressVerified, setAddressVerified] = useState(user.deliveryAddressVerified);
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pushWarningOverride, setPushWarningOverride] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const loadProfile = useCallback(async () => {
    const [profileResponse, optionsResponse] = await Promise.all([
      getDeliveryProfile(),
      getDeliveryOptions()
    ]);
    setProfile(profileResponse.profile);
    setAddressVerified(profileResponse.addressVerified && optionsResponse.addressVerified);
    setOptions(optionsResponse.vehicles);
    if (profileResponse.profile?.isOnDuty) {
      const [nextOffers, nextJobs] = await Promise.all([getDeliveryOffers(), getDeliveryJobs()]);
      setOffers(nextOffers);
      setJobs(nextJobs);
    } else {
      setOffers([]);
      setJobs(await getDeliveryJobs());
    }
  }, []);

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      await loadProfile();
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error
        ? refreshError.message
        : 'Could not refresh delivery information.');
    } finally {
      setLoading(false);
      if (showSpinner) setRefreshing(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => active ? refresh(false) : undefined);
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!profile || profile.applicationStatus !== 'approved' || !profile.isOnDuty) return undefined;
    const interval = setInterval(() => void refresh(false), 10_000);
    return () => clearInterval(interval);
  }, [profile, refresh]);

  useEffect(() => {
    if (!profile?.isOnDuty) return undefined;
    let active = true;
    restoreDeliveryTracking().catch((restoreError: unknown) => {
      if (active) setError(restoreError instanceof Error
        ? restoreError.message
        : 'Could not restore background location tracking.');
    });
    return () => { active = false; };
  }, [profile?.isOnDuty]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(false);
    });
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(() => {
      void refresh(false);
    });
    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    let checkingSession = false;
    const validateSession = async () => {
      if (!active || checkingSession || AppState.currentState !== 'active') return;
      checkingSession = true;
      try {
        const session = await getStoredPickSession();
        if (!session && active) await onSignOut();
      } catch (sessionError) {
        if (sessionError instanceof PickAccountDisabledError && active) {
          await stopDeliveryLocationTracking();
          onAccountDisabled(sessionError.user);
        } else if (sessionError instanceof PickAccountRestoredError && active) {
          await stopDeliveryLocationTracking();
          await clearStoredPickSession();
          await onSignOut();
        } else if (active) {
          setError(sessionError instanceof Error
            ? sessionError.message
            : 'Could not refresh your Tiwlo account status.');
        }
      } finally {
        checkingSession = false;
      }
    };
    void validateSession();
    const interval = setInterval(() => void validateSession(), 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void validateSession();
    });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [onAccountDisabled, onSignOut]);

  const pushWarning = profile?.isOnDuty && !Constants.expoConfig?.extra?.eas?.projectId
    ? 'Background push alerts are not configured for this build. Keep PICK Delivery open to see offers.'
    : pushWarningOverride;

  const changeDuty = async (enabled: boolean) => {
    setActionBusy(true);
    setError('');
    try {
      if (enabled) {
        const result = await goOnDeliveryDuty();
        setPushWarningOverride(result.pushConfigured
          ? ''
          : 'Background push alerts are not configured for this build. Keep PICK Delivery open to see offers.');
      } else {
        await goOffDeliveryDuty();
        setPushWarningOverride('');
      }
      await refresh(false);
    } catch (dutyError) {
      setError(dutyError instanceof Error ? dutyError.message : 'Could not change your duty status.');
    } finally {
      setActionBusy(false);
    }
  };

  const acceptOffer = async (offer: DeliveryOffer) => {
    setActionBusy(true);
    setError('');
    try {
      await acceptDeliveryOffer(offer.id);
      await refresh(false);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'This parcel could not be accepted.');
      await refresh(false);
    } finally {
      setActionBusy(false);
    }
  };

  const updateJob = async (job: DeliveryJob, status: 'picked_up' | 'delivered' | 'cancelled') => {
    setActionBusy(true);
    setError('');
    try {
      await updateDeliveryJob(job.assignmentId, status);
      await refresh(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update this delivery.');
    } finally {
      setActionBusy(false);
    }
  };

  const signOutSafely = async () => {
    setSignOutError('');
    try {
      if (profile?.isOnDuty && jobs.length === 0) await goOffDeliveryDuty();
      else if (profile?.isOnDuty && jobs.length > 0) {
        throw new Error('Complete your active parcel before signing out.');
      }
      await removeDeliveryPushToken();
      await stopDeliveryLocationTracking();
      await clearStoredPickSession();
      await onSignOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure instanceof Error
        ? signOutFailure.message
        : 'Could not safely sign out.');
    }
  };

  if (!addressVerified) {
    return (
      <View style={styles.verificationPage}>
        <AddressVerificationScreen onComplete={() => void refresh(false)} />
        <Pressable style={styles.verificationSignOut} onPress={() => void signOutSafely()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        {signOutError ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutError}</Text> : null}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.bodyText}>Loading your delivery profile…</Text>
      </View>
    );
  }

  if (!profile || profile.applicationStatus === 'rejected' || profile.applicationStatus === 'pending') {
    if (options.length === 0) {
      return (
        <PageFrame onSignOut={() => void signOutSafely()}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error || 'No delivery vehicle options are available. Refresh to try again.'}
          </Text>
          <PrimaryButton title="Refresh" onPress={() => void refresh()} />
        </PageFrame>
      );
    }
    return (
      <View style={styles.fullPage}>
        <DeliveryApplication
          options={options}
          currentProfile={profile}
          onSubmitted={(nextProfile) => {
            setProfile(nextProfile);
            setError('');
          }}
          onSignOut={() => void signOutSafely()}
        />
        {signOutError ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.fullPage}>
      <View style={styles.dashboardTopBar}>
        <PickLogo variant="land-black" width={104} height={32} />
        <Pressable onPress={() => void signOutSafely()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      {signOutError ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutError}</Text> : null}
      <DeliveryDashboard
        userName={user.name}
        profile={profile}
        offers={offers}
        jobs={jobs}
        refreshing={refreshing || actionBusy}
        error={error}
        pushWarning={pushWarning}
        onRefresh={() => void refresh()}
        onDutyChange={(enabled) => void changeDuty(enabled)}
        onAccept={(offer) => void acceptOffer(offer)}
        onJobUpdate={(job, status) => void updateJob(job, status)}
      />
    </View>
  );
}

const GREEN = '#17A56B';
const styles = StyleSheet.create({
  fullPage: { flex: 1, backgroundColor: '#F6F8F7' },
  pageContent: { flexGrow: 1, padding: 20, paddingBottom: 36, backgroundColor: '#F6F8F7' },
  dashboardContent: { flexGrow: 1, padding: 20, paddingTop: 8, paddingBottom: 36 },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  dashboardTopBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  signOutButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: '#E8EEEB' },
  signOutText: { color: '#35463E', fontSize: 13, fontWeight: '600' },
  introBlock: { marginBottom: 20 },
  eyebrow: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  heading: { color: '#17251F', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  bodyText: { color: '#6A7871', fontSize: 14, lineHeight: 21, marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E9EFEB' },
  fieldLabel: { color: '#26372F', fontSize: 13, fontWeight: '700', marginBottom: 9 },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  vehicleOption: { width: '48%', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E4EBE7', backgroundColor: '#FFFFFF' },
  vehicleOptionSelected: { backgroundColor: '#EAF7F1', borderColor: GREEN },
  vehicleName: { color: '#24352D', fontSize: 14, fontWeight: '700' },
  vehicleNameSelected: { color: '#08794A' },
  vehicleLimit: { color: '#78857E', fontSize: 12, marginTop: 4 },
  policyHint: { color: '#75827B', fontSize: 12, lineHeight: 18, marginTop: 10 },
  topSpace: { marginTop: 18 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#DEE7E2', backgroundColor: '#FFFFFF', paddingHorizontal: 13, color: '#1C2A24', fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 18 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryButton: { backgroundColor: '#E9F5EF', borderWidth: 1, borderColor: '#C8E8D8' },
  secondaryButtonText: { color: '#08794A' },
  buttonDisabled: { opacity: 0.55 },
  errorText: { color: '#B42318', fontSize: 13, lineHeight: 19, marginTop: 12 },
  warningText: { color: '#8B5C09', backgroundColor: '#FFF6E5', borderRadius: 11, padding: 11, fontSize: 12, lineHeight: 18, marginTop: 13 },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#E9EFEB', marginTop: 8 },
  statusPill: { alignSelf: 'flex-start', marginTop: 18, backgroundColor: '#FFF4D8', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 30 },
  statusPillText: { color: '#855D11', fontSize: 12, fontWeight: '700' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  refreshButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  refreshIcon: { color: GREEN, fontSize: 27 },
  dutyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E8EEEB', marginBottom: 20 },
  dutyCardOn: { backgroundColor: '#F0FAF5', borderColor: '#C8E8D8' },
  dutyHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dutyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#A3ADA8' },
  dutyDotOn: { backgroundColor: GREEN },
  dutyTitle: { color: '#1B2A23', fontSize: 16, fontWeight: '700' },
  dutyDescription: { color: '#6A7871', fontSize: 13, lineHeight: 19, marginTop: 9 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#1B2A23', fontSize: 16, fontWeight: '700' },
  offerCount: { color: GREEN, fontSize: 15, fontWeight: '800', backgroundColor: '#E9F5EF', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  offerTitle: { color: '#1B2A23', fontSize: 15, fontWeight: '700' },
  offerSub: { color: '#78857E', fontSize: 11, marginTop: 5 },
  fare: { color: GREEN, fontSize: 18, fontWeight: '800' },
  detailLabel: { color: '#87938C', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 },
  detailText: { color: '#405148', fontSize: 13, lineHeight: 19, marginTop: 4 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#E9EFEB' },
  emptyTitle: { color: '#26372F', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, backgroundColor: '#F6F8F7' },
  verificationPage: { flex: 1, backgroundColor: '#F6F8F7' },
  verificationSignOut: { alignSelf: 'center', position: 'absolute', bottom: 24, padding: 12, backgroundColor: '#E8EEEB', borderRadius: 12 }
});

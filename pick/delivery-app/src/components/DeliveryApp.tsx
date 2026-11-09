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
import { PickIcon } from '../../../mobile/src/components/common/PickIcon';
import { Colors } from '../../../mobile/src/theme/colors';
import { SYSTEM_INSETS } from '../../../mobile/src/components/common/ScreenContainer';
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

type DeliveryTab = 'home' | 'parcels' | 'profile';

const formatDistance = (meters: number) => meters >= 1000
  ? `${(meters / 1000).toFixed(meters % 1000 ? 1 : 0)} km`
  : `${meters} m`;

function DeliveryApplication({
  options,
  currentProfile,
  onSubmitted
}: {
  options: DeliveryPolicy[];
  currentProfile: DeliveryProfile | null;
  onSubmitted: (profile: DeliveryProfile) => void;
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
      <View style={styles.statusCard}>
          <Text style={styles.eyebrow}>APPLICATION RECEIVED</Text>
          <Text style={styles.heading}>We’re reviewing your details</Text>
          <Text style={styles.bodyText}>
            Your {currentProfile.vehicleName} application is waiting for PICK approval. We’ll show your duty controls here when it is approved.
          </Text>
          <View style={styles.statusPill}><Text style={styles.statusPillText}>Pending review</Text></View>
      </View>
    );
  }

  return (
    <View>
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
    </View>
  );
}

function DeliveryHome({
  userName,
  profile,
  activeTab,
  onOpenProfile,
  error,
  onRefresh
}: {
  userName: string;
  profile: DeliveryProfile | null;
  activeTab: DeliveryTab;
  onOpenProfile: () => void;
  error: string;
  onRefresh: () => void;
}) {
  const pending = profile?.applicationStatus === 'pending';
  const rejected = profile?.applicationStatus === 'rejected';

  return (
    <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>{activeTab === 'home' ? 'PICK DELIVERY' : 'YOUR PARCELS'}</Text>
          <Text style={styles.heading}>{activeTab === 'home' ? `Hi, ${userName || 'Partner'}` : 'Parcel requests'}</Text>
          <Text style={styles.bodyText}>{activeTab === 'home' ? 'Your delivery partner home' : 'Available after your delivery profile is approved'}</Text>
        </View>
        <Pressable accessibilityLabel="Refresh delivery information" onPress={onRefresh} style={styles.refreshButton}>
          <PickIcon name="refresh" size={19} color={Colors.primary} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.apiErrorCard}>
          <Text style={styles.apiErrorTitle}>Couldn’t load your delivery information</Text>
          <Text style={styles.bodyText}>{error}</Text>
          <PrimaryButton title="Try again" onPress={onRefresh} />
        </View>
      ) : null}

      <View style={styles.statusCard}>
        <View style={styles.homeStatusIcon}>
          <PickIcon
            name={activeTab === 'parcels' ? 'lock' : pending ? 'clock' : rejected ? 'info' : 'scooter'}
            size={24}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.cardEyebrow}>
          {activeTab === 'parcels' ? 'PARCEL REQUESTS' : pending ? 'APPLICATION STATUS' : rejected ? 'ACTION REQUIRED' : 'GET STARTED'}
        </Text>
        <Text style={styles.heading}>
          {activeTab === 'parcels'
            ? pending
              ? 'Your application is under review'
              : 'Complete your delivery profile first'
            : pending
              ? 'Your application is under review'
              : rejected
                ? 'Update your delivery details'
                : 'Deliver with PICK'}
        </Text>
        <Text style={styles.bodyText}>
          {activeTab === 'parcels'
            ? pending
              ? `We’re reviewing your ${profile?.vehicleName || 'vehicle'} details. Parcel requests will be available after approval.`
              : 'Add your vehicle and capacity, then wait for PICK to approve your application before viewing delivery requests.'
            : pending
              ? `We’re reviewing your ${profile?.vehicleName || 'vehicle'} details. We’ll enable delivery tools as soon as your application is approved.`
              : rejected
                ? profile?.applicationNote || 'Review your vehicle information and submit an updated application.'
                : 'Set up your vehicle and carrying capacity to start your delivery partner application.'}
        </Text>
        {pending && activeTab === 'home' ? (
          <View style={styles.statusPill}><Text style={styles.statusPillText}>Pending review</Text></View>
        ) : !pending || activeTab === 'parcels' ? (
          <PrimaryButton
            title={profile ? 'Review application' : 'Set up delivery profile'}
            onPress={onOpenProfile}
          />
        ) : null}
      </View>

      {activeTab === 'home' ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>How PICK Delivery works</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoNumber}>1</Text>
            <Text style={styles.infoText}>Add your vehicle and real carrying capacity.</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoNumber}>2</Text>
            <Text style={styles.infoText}>Wait for PICK to review and approve your application.</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoNumber}>3</Text>
            <Text style={styles.infoText}>Go on duty to receive suitable parcel requests nearby.</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DeliveryProfileScreen({
  userName,
  profile,
  options,
  error,
  signOutError,
  onSubmitted,
  onSignOut
}: {
  userName: string;
  profile: DeliveryProfile | null;
  options: DeliveryPolicy[];
  error: string;
  signOutError: string;
  onSubmitted: (profile: DeliveryProfile) => void;
  onSignOut: () => void;
}) {
  const needsApplication = !profile || profile.applicationStatus === 'rejected';

  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
          <Text style={styles.heading}>Profile</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>TIWLO ACCOUNT</Text>
        <Text style={styles.profileName}>{userName || 'Delivery partner'}</Text>
        <Text style={styles.bodyText}>Your PICK Delivery partner account</Text>
      </View>

      {needsApplication ? (
        <DeliveryApplication
          options={options}
          currentProfile={profile}
          onSubmitted={onSubmitted}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>DELIVERY PROFILE</Text>
          <Text style={styles.sectionTitle}>{profile.vehicleName}</Text>
          <Text style={styles.bodyText}>Carrying capacity · {profile.vehicleCapacityKg} kg</Text>
          {profile.vehicleRegistration ? (
            <Text style={styles.profileDetail}>Registration · {profile.vehicleRegistration}</Text>
          ) : null}
          <View style={styles.profileDivider} />
          <Text style={styles.detailLabel}>APPLICATION</Text>
          <Text style={styles.profileDetail}>
            {profile.applicationStatus === 'approved' ? 'Approved' : 'Pending review'}
          </Text>
          <Text style={styles.detailLabel}>PICKUP RANGE</Text>
          <Text style={styles.profileDetail}>{formatDistance(profile.policy.pickupRangeMeters)}</Text>
          <Text style={styles.detailLabel}>DELIVERY RANGE</Text>
          <Text style={styles.profileDetail}>{formatDistance(profile.policy.deliveryRangeMeters)}</Text>
          {profile.applicationNote ? <Text style={styles.warningText}>{profile.applicationNote}</Text> : null}
        </View>
      )}

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {signOutError ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutError}</Text> : null}
      <PrimaryButton title="Sign out" onPress={onSignOut} secondary />
    </ScrollView>
  );
}

function DeliveryBottomNav({
  activeTab,
  onTabPress
}: {
  activeTab: DeliveryTab;
  onTabPress: (tab: DeliveryTab) => void;
}) {
  const tabs: { key: DeliveryTab; label: string; icon: 'home' | 'home-active' | 'scooter' | 'profile' | 'profile-active' }[] = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'parcels', label: 'Parcels', icon: 'scooter' },
    { key: 'profile', label: 'Profile', icon: 'profile' }
  ];

  return (
    <View style={[styles.bottomNav, { height: 56 + SYSTEM_INSETS.bottomNavPadding, paddingBottom: SYSTEM_INSETS.bottomNavPadding }]}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.key;
        const icon = selected && tab.key === 'home'
          ? 'home-active'
          : selected && tab.key === 'profile'
            ? 'profile-active'
            : tab.icon;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={styles.bottomNavItem}
          >
            <PickIcon
              name={icon}
              size={21}
              color={selected ? Colors.foreground : Colors.mutedForeground}
            />
            <Text style={[styles.bottomNavLabel, selected && styles.bottomNavLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DeliveryDashboard({
  userName,
  profile,
  offers,
  jobs,
  activeTab,
  refreshing,
  error,
  pushWarning,
  onRefresh,
  onDutyChange,
  onJobUpdate,
  onAccept,
  onShowParcels
}: {
  userName: string;
  profile: DeliveryProfile;
  offers: DeliveryOffer[];
  jobs: DeliveryJob[];
  activeTab: DeliveryTab;
  refreshing: boolean;
  error: string;
  pushWarning: string;
  onRefresh: () => void;
  onDutyChange: (enabled: boolean) => void;
  onJobUpdate: (job: DeliveryJob, status: 'picked_up' | 'delivered' | 'cancelled') => void;
  onAccept: (offer: DeliveryOffer) => void;
  onShowParcels: () => void;
}) {
  const activeJob = jobs[0];
  return (
    <ScrollView
      contentContainerStyle={styles.dashboardContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.eyebrow}>{activeTab === 'home' ? 'PICK DELIVERY' : 'YOUR PARCELS'}</Text>
          <Text style={styles.heading}>Hi, {userName || 'Partner'}</Text>
        </View>
        <Pressable accessibilityLabel="Refresh jobs" onPress={onRefresh} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator color={Colors.primary} /> : <PickIcon name="refresh" size={19} color={Colors.primary} />}
        </Pressable>
      </View>

      {activeTab === 'home' ? (
        <>
          <View style={styles.dutyCard}>
            <View style={styles.dutyHeader}>
              <View style={[styles.dutyDot, profile.isOnDuty && styles.dutyDotOn]} />
              <Text style={styles.dutyTitle}>{profile.isOnDuty ? 'You’re on duty' : 'You’re off duty'}</Text>
            </View>
            <Text style={styles.dutyDescription}>
              {profile.isOnDuty
                ? 'Your location is being shared securely. New nearby parcel offers will appear in Parcels.'
                : 'Go on duty when you’re ready to accept delivery requests.'}
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

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <PickIcon name="scooter" size={21} color={Colors.primary} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.sectionTitle}>{activeJob ? 'Delivery in progress' : 'Parcel requests'}</Text>
              <Text style={styles.bodyText}>
                {activeJob
                  ? `${activeJob.parcelDetails.package?.categoryNameEn || 'Parcel'} · ${activeJob.status === 'accepted' ? 'Ready for pickup' : 'On the way'}`
                  : profile.isOnDuty
                    ? `${offers.length} matching ${offers.length === 1 ? 'request' : 'requests'} available`
                    : 'Turn on duty to receive nearby requests'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onShowParcels} style={styles.summaryAction}>
              <PickIcon name="chevron-right" size={21} color={Colors.primary} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <View style={styles.parcelIntro}>
            <View>
              <Text style={styles.sectionTitle}>Delivery requests</Text>
              <Text style={styles.policyHint}>{profile.vehicleName} · up to {profile.vehicleCapacityKg} kg</Text>
            </View>
            <Text style={styles.offerCount}>{offers.length}</Text>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

          {activeJob ? (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>ACTIVE DELIVERY</Text>
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
          ) : null}

          {offers.length ? offers.map((offer) => (
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
              <PrimaryButton title="Accept parcel" onPress={() => onAccept(offer)} disabled={refreshing || Boolean(activeJob)} />
            </View>
          )) : !activeJob ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <PickIcon name="scooter" size={27} color={Colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>{profile.isOnDuty ? 'Looking for nearby parcels' : 'You’re currently off duty'}</Text>
              <Text style={styles.bodyText}>
                {profile.isOnDuty
                  ? 'Matching requests will appear here based on your vehicle, capacity, distance, and PICK coverage.'
                  : 'Go on duty from Home to see requests that match your vehicle and location.'}
              </Text>
            </View>
          ) : null}
        </>
      )}
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
  const [activeTab, setActiveTab] = useState<DeliveryTab>('home');
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
          <Text style={styles.verificationSignOutText}>Sign out</Text>
        </Pressable>
        {signOutError ? <Text accessibilityRole="alert" style={styles.errorText}>{signOutError}</Text> : null}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.bodyText}>Loading your delivery profile…</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullPage}>
      <View style={styles.dashboardTopBar}>
        <PickLogo variant="land-black" width={92} height={28} />
        <Pressable accessibilityLabel="Refresh delivery information" onPress={() => void refresh()} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator color={Colors.primary} /> : <PickIcon name="refresh" size={19} color={Colors.primary} />}
        </Pressable>
      </View>
      <View style={styles.tabContent}>
        {activeTab === 'home' && profile?.applicationStatus === 'approved' ? (
          <DeliveryDashboard
            userName={user.name}
            profile={profile}
            offers={offers}
            jobs={jobs}
            activeTab="home"
            refreshing={refreshing || actionBusy}
            error={error}
            pushWarning={pushWarning}
            onRefresh={() => void refresh()}
            onDutyChange={(enabled) => void changeDuty(enabled)}
            onAccept={(offer) => void acceptOffer(offer)}
            onJobUpdate={(job, status) => void updateJob(job, status)}
            onShowParcels={() => setActiveTab('parcels')}
          />
        ) : activeTab === 'parcels' && profile?.applicationStatus === 'approved' ? (
          <DeliveryDashboard
            userName={user.name}
            profile={profile}
            offers={offers}
            jobs={jobs}
            activeTab="parcels"
            refreshing={refreshing || actionBusy}
            error={error}
            pushWarning={pushWarning}
            onRefresh={() => void refresh()}
            onDutyChange={(enabled) => void changeDuty(enabled)}
            onAccept={(offer) => void acceptOffer(offer)}
            onJobUpdate={(job, status) => void updateJob(job, status)}
            onShowParcels={() => setActiveTab('parcels')}
          />
        ) : activeTab === 'profile' ? (
          <DeliveryProfileScreen
            userName={user.name}
            profile={profile}
            options={options}
            error={error}
            signOutError={signOutError}
            onSubmitted={(nextProfile) => {
              setProfile(nextProfile);
              setError('');
              setActiveTab('home');
            }}
            onSignOut={() => void signOutSafely()}
          />
        ) : (
          <DeliveryHome
            userName={user.name}
            profile={profile}
            activeTab={activeTab}
            onOpenProfile={() => setActiveTab('profile')}
            error={error}
            onRefresh={() => void refresh()}
          />
        )}
      </View>
      <DeliveryBottomNav activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

const GREEN = Colors.success;
const styles = StyleSheet.create({
  fullPage: { flex: 1, backgroundColor: Colors.background },
  tabContent: { flex: 1 },
  dashboardContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, backgroundColor: Colors.background },
  dashboardTopBar: { height: 54 + SYSTEM_INSETS.top, paddingTop: SYSTEM_INSETS.top, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: Colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  introBlock: { marginBottom: 20 },
  eyebrow: { color: Colors.mutedForeground, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 7 },
  heading: { color: Colors.foreground, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  bodyText: { color: Colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 7 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  fieldLabel: { color: Colors.foreground, fontSize: 13, fontWeight: '700', marginBottom: 9 },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  vehicleOption: { width: '48%', borderRadius: 13, padding: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  vehicleOptionSelected: { backgroundColor: Colors.cardAlt, borderColor: Colors.primary },
  vehicleName: { color: Colors.foreground, fontSize: 14, fontWeight: '700' },
  vehicleNameSelected: { color: Colors.foreground },
  vehicleLimit: { color: Colors.mutedForeground, fontSize: 12, marginTop: 4 },
  policyHint: { color: Colors.mutedForeground, fontSize: 12, lineHeight: 18, marginTop: 8 },
  topSpace: { marginTop: 18 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, paddingHorizontal: 13, color: Colors.foreground, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 18 },
  primaryButtonText: { color: Colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  secondaryButton: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { color: Colors.foreground },
  buttonDisabled: { opacity: 0.55 },
  errorText: { color: Colors.destructive, fontSize: 13, lineHeight: 19, marginTop: 12 },
  warningText: { color: '#8B5C09', backgroundColor: '#FFF6E5', borderRadius: 11, padding: 11, fontSize: 12, lineHeight: 18, marginTop: 13 },
  statusCard: { backgroundColor: Colors.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  statusPill: { alignSelf: 'flex-start', marginTop: 16, backgroundColor: Colors.cardAlt, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 30 },
  statusPillText: { color: Colors.foreground, fontSize: 12, fontWeight: '700' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  refreshButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardAlt },
  dutyCard: { backgroundColor: Colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  dutyHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dutyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.mutedForeground },
  dutyDotOn: { backgroundColor: GREEN },
  dutyTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700' },
  dutyDescription: { color: Colors.mutedForeground, fontSize: 13, lineHeight: 19, marginTop: 9 },
  sectionTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700' },
  offerCount: { color: Colors.foreground, fontSize: 14, fontWeight: '700', backgroundColor: Colors.cardAlt, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, overflow: 'hidden' },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 13 },
  offerTitle: { color: Colors.foreground, fontSize: 15, fontWeight: '700' },
  offerSub: { color: Colors.mutedForeground, fontSize: 11, marginTop: 5 },
  fare: { color: Colors.foreground, fontSize: 18, fontWeight: '800' },
  detailLabel: { color: Colors.mutedForeground, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 12 },
  detailText: { color: Colors.foreground, fontSize: 13, lineHeight: 19, marginTop: 4 },
  emptyCard: { alignItems: 'center', backgroundColor: Colors.card, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { color: Colors.foreground, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, backgroundColor: Colors.background },
  verificationPage: { flex: 1, backgroundColor: Colors.background },
  verificationSignOut: { alignSelf: 'center', position: 'absolute', bottom: 24, padding: 12, backgroundColor: Colors.cardAlt, borderRadius: 12 },
  verificationSignOutText: { color: Colors.foreground, fontSize: 14, fontWeight: '600' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.border },
  summaryIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: Colors.cardAlt },
  summaryText: { flex: 1, paddingHorizontal: 12 },
  summaryAction: { padding: 4 },
  parcelIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardEyebrow: { color: Colors.mutedForeground, fontSize: 10, fontWeight: '700', letterSpacing: 0.9, marginBottom: 8 },
  emptyIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.cardAlt, marginBottom: 14 },
  homeStatusIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: Colors.cardAlt, marginBottom: 16 },
  infoCard: { backgroundColor: Colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 15 },
  infoNumber: { width: 26, height: 26, textAlign: 'center', textAlignVertical: 'center', borderRadius: 13, overflow: 'hidden', color: Colors.primaryForeground, backgroundColor: Colors.primary, fontSize: 12, fontWeight: '700' },
  infoText: { flex: 1, color: Colors.foreground, fontSize: 13, lineHeight: 19 },
  profileName: { color: Colors.foreground, fontSize: 18, fontWeight: '700' },
  profileDetail: { color: Colors.foreground, fontSize: 13, lineHeight: 19, marginTop: 4 },
  profileDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 16 },
  bottomNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: 8 },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomNavLabel: { color: Colors.mutedForeground, fontSize: 11, fontWeight: '500', marginTop: 4 },
  bottomNavLabelActive: { color: Colors.foreground, fontWeight: '700' },
  apiErrorCard: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FECACA', marginBottom: 14 },
  apiErrorTitle: { color: Colors.destructive, fontSize: 14, fontWeight: '700' }
});

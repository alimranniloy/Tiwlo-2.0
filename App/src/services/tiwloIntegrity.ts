import { Linking, NativeModules } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { TIWLO_API_BASE } from './tiwloAuth';

const BIOMETRIC_HW_CACHE_FILE = 'tiwlo_biometric_hw_cache.json';
const FINGERPRINT_PROMPT_CACHE_FILE = 'tiwlo_fingerprint_prompt_cache.json';
const NO_HARDWARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AVAILABLE_HARDWARE_TTL_MS = 6 * 60 * 60 * 1000;

interface CachedBiometricEntry {
  report: BiometricAvailabilityReport;
  checkedAt: number;
}

let inMemoryBiometricCache: CachedBiometricEntry | null = null;
let inFlightBiometricCheck: Promise<BiometricAvailabilityReport> | null = null;
let inMemoryPromptSuppressed: Record<string, { reason: string; cachedAt: number }> | null = null;

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');
export const PLAY_STORE_PACKAGE_ID = 'com.tiwlo.app';
export const PLAY_STORE_MARKET_URL = `market://details?id=${PLAY_STORE_PACKAGE_ID}`;
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`;

// Populate with your Play App Signing certificate SHA-256 hex digest before release build.
export const EXPECTED_RELEASE_CERT_SHA256: string = '';

export interface IntegrityReport {
  isDebugBuild: boolean;
  packageName: string;
  versionCode: number;
  versionName: string;
  signingSha256: string;
  dexCrc: string;
  installerPackage: string;
  isPlayStoreInstall: boolean;
  isRooted: boolean;
  isHooked: boolean;
  isDebuggerAttached: boolean;
  isEmulator: boolean;
  releaseCompromised: boolean;
  compromiseReasons: string[];
  updateRequired: boolean;
  lockReason?: string;
}

export interface NetworkStateReport {
  connected: boolean;
  hasInternet: boolean;
  hasWifi: boolean;
  hasCellular: boolean;
  hasEthernet?: boolean;
}

export interface BiometricAvailabilityReport {
  available: boolean;
  enrolled: boolean;
  hardwarePresent: boolean;
  statusCode: number;
  hasStoredKey: boolean;
  deviceName: string;
}

export interface BiometricEnrollResult {
  success: boolean;
  publicKeySpki: string;
  signatureBase64: string;
  deviceName: string;
}

export interface BiometricSignResult {
  success: boolean;
  signatureBase64: string;
  deviceName: string;
}

interface TiwloSecurityNativeBridge {
  verifyIntegrity?: () => Promise<Partial<IntegrityReport>>;
  getNetworkState?: () => Promise<NetworkStateReport>;
  postLocalNotification?: (title: string, body: string, channelId?: string) => Promise<boolean>;
  openInAppBrowser?: (url: string) => Promise<boolean>;
  terminateApp?: () => void;
  checkBiometricAvailable?: () => Promise<BiometricAvailabilityReport>;
  enrollHardwareBiometric?: (
    challengeNonce: string | null,
    title: string,
    subtitle: string
  ) => Promise<BiometricEnrollResult>;
  signBiometricChallenge?: (
    challengeNonce: string,
    title: string,
    subtitle: string
  ) => Promise<BiometricSignResult>;
  clearHardwareBiometricKey?: () => Promise<boolean>;
}

const nativeBridge = NativeModules.TiwloSecurity as TiwloSecurityNativeBridge | undefined;

export async function openPlayStoreUpdate(): Promise<void> {
  try {
    const canOpenMarket = await Linking.canOpenURL(PLAY_STORE_MARKET_URL);
    if (canOpenMarket) {
      await Linking.openURL(PLAY_STORE_MARKET_URL);
      return;
    }
  } catch {
    // Fallback to web Play Store URL
  }
  await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
}

export async function openInAppBrowserUrl(url: string): Promise<void> {
  if (nativeBridge?.openInAppBrowser) {
    try {
      await nativeBridge.openInAppBrowser(url);
      return;
    } catch {
      // Fallback to default Linking
    }
  }
  await Linking.openURL(url);
}

export async function postNativeLocalNotification(
  title: string,
  body: string,
  channelId = 'tiwlo_alerts'
): Promise<boolean> {
  if (!nativeBridge?.postLocalNotification) return false;
  try {
    return await nativeBridge.postLocalNotification(title, body, channelId);
  } catch {
    return false;
  }
}

export async function readDeviceNetworkState(): Promise<NetworkStateReport> {
  if (nativeBridge?.getNetworkState) {
    try {
      return await nativeBridge.getNetworkState();
    } catch {
      // fallback below
    }
  }
  return {
    connected: true,
    hasInternet: true,
    hasWifi: true,
    hasCellular: false,
  };
}

export function triggerHardSecurityTerminate(): void {
  if (nativeBridge?.terminateApp) {
    nativeBridge.terminateApp();
  }
}

export async function evaluateAppIntegrity(): Promise<IntegrityReport> {
  let nativeReport: Partial<IntegrityReport> = {
    isDebugBuild: __DEV__,
    packageName: PLAY_STORE_PACKAGE_ID,
    versionCode: 1,
    versionName: '1.0.0',
    signingSha256: '',
    dexCrc: '',
    installerPackage: '',
    isPlayStoreInstall: false,
    isRooted: false,
    isHooked: false,
    isDebuggerAttached: false,
    isEmulator: false,
    releaseCompromised: false,
    compromiseReasons: [],
  };

  if (nativeBridge?.verifyIntegrity) {
    try {
      nativeReport = await nativeBridge.verifyIntegrity();
    } catch {
      // Keep base diagnostics
    }
  }

  const reasons = [...(nativeReport.compromiseReasons || [])];
  const isDebug = nativeReport.isDebugBuild ?? __DEV__;

  if (
    !isDebug &&
    EXPECTED_RELEASE_CERT_SHA256 &&
    nativeReport.signingSha256 &&
    nativeReport.signingSha256.toUpperCase() !== EXPECTED_RELEASE_CERT_SHA256.toUpperCase()
  ) {
    reasons.push('signing_certificate_mismatch');
  }

  if (!isDebug && !nativeReport.isPlayStoreInstall && !nativeReport.isEmulator) {
    reasons.push('non_play_store_install');
  }

  let serverUpdateRequired = false;
  let serverLockReason: string | undefined;

  try {
    const res = await fetch(`${TIWLO_ORIGIN}/api/mobile/integrity-policy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageName: nativeReport.packageName || PLAY_STORE_PACKAGE_ID,
        versionCode: nativeReport.versionCode || 1,
        signingSha256: nativeReport.signingSha256 || '',
        installerPackage: nativeReport.installerPackage || '',
        isDebugBuild: isDebug,
      }),
    });
    if (res.ok) {
      const policy = (await res.json().catch(() => ({}))) as {
        forceUpdate?: boolean;
        compromised?: boolean;
        reason?: string;
      };
      if (policy.forceUpdate || policy.compromised) {
        serverUpdateRequired = true;
        serverLockReason = policy.reason;
      }
    }
  } catch {
    // Offline or policy endpoint optional
  }

  const releaseCompromised =
    Boolean(nativeReport.releaseCompromised) ||
    reasons.includes('signing_certificate_mismatch') ||
    reasons.includes('dynamic_instrumentation_detected');

  const updateRequired = releaseCompromised || serverUpdateRequired;

  // Enforce immediate termination if active runtime tampering/hooking occurs in release mode.
  if (!isDebug && (nativeReport.isHooked || reasons.includes('package_tampered'))) {
    triggerHardSecurityTerminate();
  }

  return {
    isDebugBuild: Boolean(isDebug),
    packageName: nativeReport.packageName || PLAY_STORE_PACKAGE_ID,
    versionCode: nativeReport.versionCode || 1,
    versionName: nativeReport.versionName || '1.0.0',
    signingSha256: nativeReport.signingSha256 || '',
    dexCrc: nativeReport.dexCrc || '',
    installerPackage: nativeReport.installerPackage || '',
    isPlayStoreInstall: Boolean(nativeReport.isPlayStoreInstall),
    isRooted: Boolean(nativeReport.isRooted),
    isHooked: Boolean(nativeReport.isHooked),
    isDebuggerAttached: Boolean(nativeReport.isDebuggerAttached),
    isEmulator: Boolean(nativeReport.isEmulator),
    releaseCompromised,
    compromiseReasons: reasons,
    updateRequired,
    lockReason:
      serverLockReason ||
      (reasons.length > 0 ? reasons.join(', ') : undefined),
  };
}

function getIntegrityCacheFile(fileName: string): File | null {
  try {
    return new File(Paths.document, fileName);
  } catch {
    return null;
  }
}

function isBiometricCacheValid(entry: CachedBiometricEntry | null): entry is CachedBiometricEntry {
  if (!entry || !entry.report || typeof entry.checkedAt !== 'number') return false;
  const ttl = entry.report.hardwarePresent ? AVAILABLE_HARDWARE_TTL_MS : NO_HARDWARE_TTL_MS;
  return Date.now() - entry.checkedAt < ttl;
}

async function readDiskBiometricCache(): Promise<CachedBiometricEntry | null> {
  try {
    const file = getIntegrityCacheFile(BIOMETRIC_HW_CACHE_FILE);
    if (!file || !file.exists) return null;
    const raw = await file.text();
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as CachedBiometricEntry;
    return isBiometricCacheValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeDiskBiometricCache(entry: CachedBiometricEntry): Promise<void> {
  try {
    inMemoryBiometricCache = entry;
    const file = getIntegrityCacheFile(BIOMETRIC_HW_CACHE_FILE);
    if (!file) return;
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    await file.write(JSON.stringify(entry));
  } catch {
    // Cache persistence failures must stay non-fatal.
  }
}

export async function checkBiometricAvailable(
  forceRefresh = false
): Promise<BiometricAvailabilityReport> {
  if (!forceRefresh && isBiometricCacheValid(inMemoryBiometricCache)) {
    return inMemoryBiometricCache.report;
  }

  if (inFlightBiometricCheck && !forceRefresh) {
    return inFlightBiometricCheck;
  }

  const runCheck = async (): Promise<BiometricAvailabilityReport> => {
    if (!forceRefresh) {
      const diskEntry = await readDiskBiometricCache();
      if (diskEntry) {
        inMemoryBiometricCache = diskEntry;
        return diskEntry.report;
      }
    }

    const fallback: BiometricAvailabilityReport = {
      available: false,
      enrolled: false,
      hardwarePresent: false,
      statusCode: -1,
      hasStoredKey: false,
      deviceName: '',
    };

    if (!nativeBridge?.checkBiometricAvailable) {
      await writeDiskBiometricCache({ report: fallback, checkedAt: Date.now() });
      return fallback;
    }

    try {
      const fresh = await nativeBridge.checkBiometricAvailable();
      await writeDiskBiometricCache({ report: fresh, checkedAt: Date.now() });
      return fresh;
    } catch {
      await writeDiskBiometricCache({ report: fallback, checkedAt: Date.now() });
      return fallback;
    }
  };

  inFlightBiometricCheck = runCheck().finally(() => {
    inFlightBiometricCheck = null;
  });

  return inFlightBiometricCheck;
}

export async function hasFingerprintPromptSuppressed(userKey: string): Promise<boolean> {
  const key = (userKey || 'anonymous').trim().toLowerCase();
  if (inMemoryPromptSuppressed && inMemoryPromptSuppressed[key]) {
    return true;
  }
  try {
    const file = getIntegrityCacheFile(FINGERPRINT_PROMPT_CACHE_FILE);
    if (!file || !file.exists) {
      inMemoryPromptSuppressed = {};
      return false;
    }
    const raw = await file.text();
    const parsed = raw?.trim()
      ? (JSON.parse(raw) as Record<string, { reason: string; cachedAt: number }>)
      : {};
    inMemoryPromptSuppressed = parsed && typeof parsed === 'object' ? parsed : {};
    return Boolean(inMemoryPromptSuppressed[key]);
  } catch {
    return false;
  }
}

export async function suppressFingerprintPrompt(
  userKey: string,
  reason: 'dismissed' | 'unavailable' | 'enrolled'
): Promise<void> {
  const key = (userKey || 'anonymous').trim().toLowerCase();
  try {
    if (!inMemoryPromptSuppressed) {
      await hasFingerprintPromptSuppressed(key);
    }
    const next = {
      ...(inMemoryPromptSuppressed || {}),
      [key]: { reason, cachedAt: Date.now() },
    };
    inMemoryPromptSuppressed = next;
    const file = getIntegrityCacheFile(FINGERPRINT_PROMPT_CACHE_FILE);
    if (!file) return;
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    await file.write(JSON.stringify(next));
  } catch {
    // Non-fatal cache write
  }
}

export async function clearFingerprintPromptSuppression(userKey: string): Promise<void> {
  const key = (userKey || 'anonymous').trim().toLowerCase();
  try {
    if (!inMemoryPromptSuppressed) {
      await hasFingerprintPromptSuppressed(key);
    }
    if (!inMemoryPromptSuppressed || !inMemoryPromptSuppressed[key]) return;
    const next = { ...inMemoryPromptSuppressed };
    delete next[key];
    inMemoryPromptSuppressed = next;
    const file = getIntegrityCacheFile(FINGERPRINT_PROMPT_CACHE_FILE);
    if (!file) return;
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    await file.write(JSON.stringify(next));
  } catch {
    // Non-fatal cache write
  }
}

export async function enrollHardwareBiometric(
  challengeNonce: string | null = null,
  title = 'Enable Biometric Sign-In',
  subtitle = 'Verify your fingerprint to bind this device'
): Promise<BiometricEnrollResult> {
  if (!nativeBridge?.enrollHardwareBiometric) {
    throw new Error('BIOMETRIC_UNAVAILABLE');
  }
  const result = await nativeBridge.enrollHardwareBiometric(challengeNonce, title, subtitle);
  if (inMemoryBiometricCache) {
    void writeDiskBiometricCache({
      report: { ...inMemoryBiometricCache.report, available: true, enrolled: true, hardwarePresent: true, hasStoredKey: true },
      checkedAt: Date.now(),
    });
  }
  return result;
}

export async function signBiometricChallenge(
  challengeNonce: string,
  title = 'Verify Identity',
  subtitle = 'Touch the fingerprint sensor to continue'
): Promise<BiometricSignResult> {
  if (!nativeBridge?.signBiometricChallenge) {
    throw new Error('BIOMETRIC_UNAVAILABLE');
  }
  return nativeBridge.signBiometricChallenge(challengeNonce, title, subtitle);
}

export async function clearHardwareBiometricKey(): Promise<boolean> {
  if (!nativeBridge?.clearHardwareBiometricKey) {
    return false;
  }
  try {
    const cleared = await nativeBridge.clearHardwareBiometricKey();
    if (inMemoryBiometricCache) {
      void writeDiskBiometricCache({
        report: { ...inMemoryBiometricCache.report, hasStoredKey: false },
        checkedAt: Date.now(),
      });
    }
    return cleared;
  } catch {
    return false;
  }
}

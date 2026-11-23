import { NativeModules } from 'react-native';
import type { TiwloUser } from './tiwloAuth';

export interface PersistedSessionState {
  user: TiwloUser | null;
  sessionToken?: string;
  route?: string;
  activeNav?: string;
  bottomTab?: 'dashboard' | 'products' | 'create-store' | 'cloud' | 'menu';
}

interface SecurityVaultBridge {
  saveSecureSession?: (jsonPayload: string) => Promise<boolean>;
  loadSecureSession?: () => Promise<string | null>;
  clearSecureSession?: () => Promise<boolean>;
}

const vaultBridge = NativeModules.TiwloSecurity as SecurityVaultBridge | undefined;

export async function loadPersistedSession(): Promise<PersistedSessionState | null> {
  if (vaultBridge?.loadSecureSession) {
    const raw = await vaultBridge.loadSecureSession();
    if (!raw || !raw.trim()) return null;
    const parsed = JSON.parse(raw) as PersistedSessionState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  }
  return null;
}

export async function savePersistedSession(state: PersistedSessionState): Promise<void> {
  if (!vaultBridge?.saveSecureSession) return;
  await vaultBridge.saveSecureSession(JSON.stringify(state));
}

export async function clearPersistedSession(): Promise<void> {
  if (!vaultBridge?.clearSecureSession) return;
  await vaultBridge.clearSecureSession();
}

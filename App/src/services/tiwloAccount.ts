import { TIWLO_API_BASE, TiwloUser } from './tiwloAuth';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

let sessionExpiredHandler: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

async function requestJson<T = Record<string, unknown>>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const url = path.startsWith('http')
    ? path
    : `${TIWLO_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && options.token && sessionExpiredHandler) {
    sessionExpiredHandler();
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ==========================================
// 1. User Account & Settings
// ==========================================

export interface AccountProfilePayload {
  id?: string;
  tiwiId?: string;
  name?: string;
  email?: string;
  phone?: string;
  storeName?: string;
  avatar?: string;
  role?: string;
  timezone?: string;
  language?: string;
  identityVerified?: boolean;
  twoFactorEnabled?: boolean;
  totpEnabled?: boolean;
  hasSecurityPin?: boolean;
  createdAt?: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  details?: string;
  ip?: string;
  createdAt?: string;
}

export async function fetchAccountDetails(token?: string) {
  return requestJson<{ user?: AccountProfilePayload; account?: AccountProfilePayload }>(
    '/api/user/account',
    { token }
  );
}

export async function fetchAccountActivityLog(token?: string) {
  return requestJson<{ logs?: ActivityLogItem[]; activities?: ActivityLogItem[] }>(
    '/api/user/account/activity-log',
    { token }
  );
}

export async function updateAccountProfile(
  payload: Partial<AccountProfilePayload>,
  token?: string
) {
  return requestJson('/api/user/account/profile', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateAccountPassword(
  payload: { currentPassword: string; newPassword: string },
  token?: string
) {
  return requestJson('/api/user/account/password', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function updateSecurityPin(pin: string, currentPassword: string, token?: string) {
  return requestJson('/api/user/account/security-pin', {
    method: 'PUT',
    token,
    body: { pin, currentPassword },
  });
}

export async function removeSecurityPin(currentPassword: string, token?: string) {
  return requestJson('/api/user/account/security-pin', {
    method: 'DELETE',
    token,
    body: { currentPassword },
  });
}

// ==========================================
// 2. Active Sessions
// ==========================================

export interface SessionRecord {
  id: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  current?: boolean;
  isCurrent?: boolean;
  trusted?: boolean;
  lastActiveAt?: string;
  createdAt?: string;
}

export async function fetchActiveSessions(token?: string) {
  return requestJson<{ sessions?: SessionRecord[] }>('/api/user/account/sessions', { token });
}

export async function revokeSessionById(sessionId: string, token?: string) {
  return requestJson(`/api/user/account/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function revokeAllOtherSessions(token?: string) {
  return requestJson('/api/user/account/sessions', {
    method: 'DELETE',
    token,
  });
}

// ==========================================
// 3. Two-Factor Auth (2FA)
// ==========================================

export interface TwoFactorStatus {
  activeMethod?: 'totp' | 'email' | 'off';
  totpEnabled?: boolean;
  emailTwoFactorEnabled?: boolean;
  twoFactorEnabled?: boolean;
  recoveryCodesRemaining?: number;
}

export async function fetchTwoFactorStatus(token?: string) {
  return requestJson<TwoFactorStatus>('/api/user/account/two-factor/status', { token });
}

export async function updateTwoFactorMethod(
  method: 'totp' | 'email' | 'off',
  token?: string
) {
  return requestJson<TwoFactorStatus>('/api/user/account/two-factor', {
    method: 'PUT',
    token,
    body: { method },
  });
}

export async function setupTotpAuthenticator(token?: string) {
  return requestJson<{ secret?: string; otpauthUrl?: string; manualKey?: string }>(
    '/api/user/account/two-factor/totp/setup',
    { method: 'POST', token }
  );
}

export async function verifyTotpAuthenticator(code: string, token?: string) {
  return requestJson<{ success?: boolean; recoveryCodes?: string[] }>(
    '/api/user/account/two-factor/totp/verify',
    { method: 'POST', token, body: { code } }
  );
}

export async function regenerateRecoveryCodes(token?: string) {
  return requestJson<{ recoveryCodes?: string[] }>(
    '/api/user/account/two-factor/recovery-codes/regenerate',
    { method: 'POST', token }
  );
}

export async function disableTotpAuthenticator(codeOrPassword: string, token?: string) {
  return requestJson('/api/user/account/two-factor/totp/disable', {
    method: 'POST',
    token,
    body: { code: codeOrPassword, password: codeOrPassword },
  });
}

// ==========================================
// 4. Team Management
// ==========================================

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  permissions?: string[];
  lastLoginAt?: string;
}

export async function fetchTeamMembers(token?: string) {
  return requestJson<{ members?: TeamMemberRecord[]; staff?: TeamMemberRecord[] }>(
    '/api/user/account/team-staff',
    { token }
  );
}

export async function createTeamMember(
  payload: { name: string; email: string; role: string; permissions: string[] },
  token?: string
) {
  return requestJson<{ member?: TeamMemberRecord }>('/api/user/account/team-staff', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateTeamMember(
  id: string,
  payload: Partial<TeamMemberRecord>,
  token?: string
) {
  return requestJson<{ member?: TeamMemberRecord }>(
    `/api/user/account/team-staff/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      token,
      body: payload,
    }
  );
}

export async function deleteTeamMember(id: string, token?: string) {
  return requestJson(`/api/user/account/team-staff/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

// ==========================================
// 5. Help & Support
// ==========================================

export interface SupportChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  time: string;
}

export async function fetchSupportConfig(token?: string) {
  return requestJson<{ online?: boolean; averageWaitMinutes?: number; email?: string }>(
    '/api/support/config',
    { token }
  );
}

export async function initiateSupportConversation(
  payload: { subject: string; category: string; message: string },
  token?: string
) {
  return requestJson<{ sessionId?: string; conversationId?: string; reply?: string }>(
    '/api/support/initiate',
    { method: 'POST', token, body: payload }
  );
}

export async function sendSupportMessage(
  payload: { sessionId: string; message: string },
  token?: string
) {
  return requestJson<{ reply?: string; message?: SupportChatMessage }>(
    '/api/support/message',
    { method: 'POST', token, body: payload }
  );
}

export async function convertSupportToTicket(
  sessionId: string,
  payload: { subject: string; priority: string },
  token?: string
) {
  return requestJson<{ ticketId?: string }>(
    `/api/support/conversations/${encodeURIComponent(sessionId)}/convert-to-ticket`,
    { method: 'POST', token, body: payload }
  );
}

// ==========================================
// 6. Cloud Wallet & Plans
// ==========================================

export interface CloudBillingGateway {
  id: string;
  name: string;
  enabled?: boolean;
  mode?: string;
  currencies?: string[];
}

export interface CloudInvoice {
  id: string;
  orderNumber?: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  createdAt?: string;
  paidAt?: string;
  expiresAt?: string;
  orderType?: string;
  planId?: string;
  planName?: string;
  isFreeTrial?: boolean;
  cashCreditUsed?: number;
  promoCreditUsed?: number;
}

export interface CloudBillingAccount {
  billingAccountId?: string;
  billingAccountName?: string;
  accountType?: string;
  companyName?: string;
  currency: string;
  credits: number;
  promotionalCredits: number;
  monthToDateSpent: number;
  projectedCost: number;
  status?: string;
  hasConfiguredGateway?: boolean;
  paymentGatewayStatusMessage?: string;
  billingEnabled?: boolean;
  configuredGateways?: CloudBillingGateway[];
  creditCheckoutGateways?: CloudBillingGateway[];
  billingAddress?: {
    address?: string;
    city?: string;
    country?: string;
    phone?: string;
    postalCode?: string;
  };
  invoices: CloudInvoice[];
  costBreakdown: { service: string; amount: number; percentage: number }[];
}

export interface BillingPromoConfig {
  enabled?: boolean;
  title?: string;
  headline?: string;
  description?: string;
  badgeText?: string;
  minDepositUsd?: number;
  bonusAmountUsd?: number;
  validityDays?: number;
  newAccountsOnly?: boolean;
  onePerDevice?: boolean;
}

export interface BillingClaimedCoupon {
  id: string;
  claimType?: string;
  promoCode: string;
  rewardType?: string;
  amountUsd: number;
  validityDays?: number;
  expiresAt?: string | null;
  createdAt?: string | null;
}

export interface BillingPromotionsStatus {
  success?: boolean;
  config?: BillingPromoConfig;
  eligible?: boolean;
  ineligibleReason?: string | null;
  alreadyClaimed?: boolean;
  hasPriorTopup?: boolean;
  promotionalCredits?: number;
  promotionalExpiresAt?: string | null;
  claimedCoupons?: BillingClaimedCoupon[];
  bonusPercent?: number;
  maxBonusUsd?: number;
  minDepositUsd?: number;
}

export interface CreditQuoteResponse {
  creditAmount: number;
  creditCurrency: string;
  paymentAmount: number;
  paymentCurrency: string;
  exchangeRate: number;
  rateDate?: string | null;
  rateSource?: string | null;
}

export interface StartCreditCheckoutResponse {
  success?: boolean;
  checkoutUrl: string;
  invoiceId?: string;
  topupId?: string;
  creditAmount?: number;
  creditCurrency?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  exchangeRate?: number;
  rateDate?: string | null;
  rateSource?: string | null;
  expiresAt?: string;
  notificationSent?: boolean;
}

export async function fetchCloudBillingAccount(token?: string): Promise<CloudBillingAccount> {
  const query = `
    query GetBillingAccount {
      cloudBillingAccount {
        billingAccountId
        billingAccountName
        accountType
        companyName
        currency
        credits
        promotionalCredits
        monthToDateSpent
        projectedCost
        status
        hasConfiguredGateway
        paymentGatewayStatusMessage
        billingEnabled
        configuredGateways { id name enabled mode currencies }
        creditCheckoutGateways { id name enabled mode currencies }
        billingAddress { address city country phone postalCode }
        invoices {
          id
          orderNumber
          amount
          currency
          status
          description
          createdAt
          paidAt
          expiresAt
          orderType
          planId
          planName
          isFreeTrial
          cashCreditUsed
          promoCreditUsed
        }
        costBreakdown { service amount percentage }
      }
    }
  `;

  try {
    const gqlRes = await requestJson<{ data?: { cloudBillingAccount?: CloudBillingAccount } }>(
      '/graphql',
      { method: 'POST', token, body: { query } }
    );
    if (gqlRes.data?.cloudBillingAccount) {
      return gqlRes.data.cloudBillingAccount;
    }
  } catch {
    // Fallback to REST billing endpoint
  }

  const rest = await requestJson<{ account?: CloudBillingAccount }>('/api/cloud/billing', {
    token,
  });
  if (rest.account) return rest.account;
  return {
    currency: 'USD',
    credits: 0,
    promotionalCredits: 0,
    monthToDateSpent: 0,
    projectedCost: 0,
    status: 'Active',
    hasConfiguredGateway: false,
    configuredGateways: [],
    creditCheckoutGateways: [],
    invoices: [],
    costBreakdown: [],
  };
}

export async function fetchBillingPromotionsStatus(
  token?: string
): Promise<BillingPromotionsStatus> {
  const data = await requestJson<BillingPromotionsStatus>(
    '/api/cloud/billing/promotions/status',
    { token }
  );
  return {
    ...data,
    minDepositUsd: data.minDepositUsd ?? data.config?.minDepositUsd,
    maxBonusUsd: data.maxBonusUsd ?? data.config?.bonusAmountUsd,
  };
}

export async function fetchCreditQuote(
  amountUsd: number,
  provider: string,
  token?: string
): Promise<CreditQuoteResponse> {
  const res = await requestJson<{
    success?: boolean;
    quote?: CreditQuoteResponse;
  } & Partial<CreditQuoteResponse>>('/api/cloud/billing/credits/quote', {
    method: 'POST',
    token,
    body: { amount: amountUsd, provider },
  });
  const quote = res.quote;
  return {
    creditAmount: Number(quote?.creditAmount ?? res.creditAmount ?? amountUsd),
    creditCurrency: quote?.creditCurrency ?? res.creditCurrency ?? 'USD',
    paymentAmount: Number(quote?.paymentAmount ?? res.paymentAmount ?? amountUsd),
    paymentCurrency: quote?.paymentCurrency ?? res.paymentCurrency ?? 'USD',
    exchangeRate: Number(quote?.exchangeRate ?? res.exchangeRate ?? 1),
    rateDate: quote?.rateDate ?? res.rateDate ?? null,
    rateSource: quote?.rateSource ?? res.rateSource ?? null,
  };
}

export async function startCreditCheckout(
  payload: {
    amount: number;
    provider?: string;
    expectedPaymentAmount?: number;
    expectedRateDate?: string;
  },
  token?: string
): Promise<StartCreditCheckoutResponse> {
  const res = await requestJson<StartCreditCheckoutResponse>('/api/cloud/billing/credits/add', {
    method: 'POST',
    token,
    body: payload,
  });
  if (!res.checkoutUrl) {
    throw new Error('Checkout URL was not returned by the server.');
  }
  return {
    ...res,
    invoiceId: res.invoiceId || res.topupId,
  };
}

export function getInvoiceViewUrl(invoiceId: string): string {
  return `${TIWLO_ORIGIN}/billing/invoices/${encodeURIComponent(invoiceId)}`;
}

export async function redeemCloudVoucher(code: string, token?: string) {
  return requestJson<{ success?: boolean; amount?: number; message?: string }>(
    '/api/cloud/billing/vouchers/redeem',
    { method: 'POST', token, body: { code } }
  );
}

export async function updateCloudBillingProfile(
  payload: {
    billingAccountName?: string;
    companyName?: string;
    address?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    phone?: string;
  },
  token?: string
) {
  return requestJson('/api/cloud/billing/address', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function cancelCloudInvoice(invoiceId: string, token?: string) {
  return requestJson(`/api/cloud/billing/credits/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST',
    token,
  });
}

// ==========================================
// 7. Workspace Plugins, Store Controls & Biometric Auth
// ==========================================

export interface WorkspacePluginService {
  id: string;
  serviceId?: string;
  name: string;
  productName?: string;
  category?: string;
  status: string;
  plan?: string;
  serverName?: string;
  iconType?: string;
  navId?: string;
}

export function resolvePluginNavId(item: Partial<WorkspacePluginService>): string {
  const raw = `${item.navId || ''} ${item.serviceId || ''} ${item.iconType || ''} ${item.productName || ''} ${item.name || ''}`.toLowerCase();
  if (raw.includes('whatsapp')) return 'whatsapp-automation';
  if (raw.includes('discord')) return 'discord';
  if (raw.includes('store')) return 'my-online-store';
  if (raw.includes('mail')) return 'email';
  if (raw.includes('oneprofile')) return 'oneprofile';
  return item.navId || item.serviceId || item.id || 'workspace-hub';
}

export async function fetchWorkspaceServices(token?: string): Promise<WorkspacePluginService[]> {
  if (!token) return [];
  try {
    const res = await requestJson<{
      workspace?: { services?: WorkspacePluginService[] };
      services?: WorkspacePluginService[];
    }>('/api/discord/workspace', { token });
    const list = res.workspace?.services ?? res.services ?? [];
    return Array.isArray(list)
      ? list.map((svc) => ({
          ...svc,
          id: String(svc.id),
          name: String(svc.name || svc.productName || 'Workspace Service'),
          status: String(svc.status || 'Active'),
          navId: resolvePluginNavId(svc),
        }))
      : [];
  } catch {
    return [];
  }
}

export async function setWorkspaceServiceStatus(
  id: string,
  status: 'active' | 'paused',
  token?: string
) {
  return requestJson(`/api/discord/workspace/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    token,
    body: { status },
  });
}

export async function deleteWorkspaceService(id: string, token?: string) {
  return requestJson(`/api/discord/workspace/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  });
}

export async function setStoreStatus(
  tiwiId: string,
  status: 'active' | 'paused' | 'offline' | 'suspended',
  token?: string
) {
  return requestJson(`/api/stores/${encodeURIComponent(tiwiId)}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function deleteStoreRecord(tiwiId: string, token?: string) {
  return requestJson(`/api/stores/${encodeURIComponent(tiwiId)}`, {
    method: 'DELETE',
    token,
    body: { confirm: true },
  });
}

export interface BiometricStatusResponse {
  enrolled: boolean;
  enrolledOnMobileOnly?: boolean;
  deviceName?: string | null;
  keyFingerprint?: string | null;
  enrolledAt?: string | null;
  updatedAt?: string | null;
}

export async function fetchBiometricStatus(token?: string): Promise<BiometricStatusResponse> {
  return requestJson<BiometricStatusResponse>('/api/user/account/biometric/status', { token });
}

export async function requestBiometricChallenge(identifier?: string, token?: string) {
  return requestJson<{
    success: boolean;
    challengeId: string;
    challenge: string;
    keyFingerprint?: string;
  }>('/api/user/account/biometric/challenge', {
    method: 'POST',
    token,
    body: identifier ? { identifier } : {},
  });
}

export async function loginWithBiometricChallenge(
  challengeId: string,
  signatureBase64: string
) {
  return requestJson<{
    success: boolean;
    token?: string;
    sessionToken?: string;
    user?: TiwloUser;
  }>('/api/user/account/biometric/login', {
    method: 'POST',
    body: { challengeId, signatureBase64 },
  });
}

export async function removeBiometricCredential(token?: string) {
  return requestJson('/api/user/account/biometric', {
    method: 'DELETE',
    token,
  });
}

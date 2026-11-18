export type SupportTabKey = 'home' | 'tickets' | 'livechat' | 'tools' | 'settings';

export interface AuthUser {
  id: string;
  tiwiId?: string | null;
  storeId?: string | null;
  storeName?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  role: string;
  authMethod?: string;
  identityVerified?: boolean;
  identityVerificationRequired?: boolean;
  addressVerified?: boolean;
  identityReviewStatus?: string | null;
  identityReviewId?: string | null;
  identityReviewReason?: string | null;
  permissions?: string[];
}

export interface AuthChallenge {
  success: boolean;
  requiresEmailVerification?: boolean;
  requires2FA?: boolean;
  requires2FASetup?: boolean;
  twoFactorMethod?: 'totp' | 'email' | string;
  totpEnabled?: boolean;
  isBanned?: boolean;
  banReason?: string;
  tempToken?: string;
  newTempToken?: string;
  email?: string;
  emailMasked?: string;
  delivered?: boolean;
  message?: string;
  sessionToken?: string;
  user?: AuthUser;
}

export interface StaffRolePreset {
  key: string;
  label: string;
  title?: string;
  description?: string;
  badgeTone?: string;
  permissions: string[];
}

export interface StaffPermissionItem {
  key: string;
  label: string;
  description?: string;
  category?: string;
}

export interface StaffProfileMe {
  userId: string;
  email: string;
  name: string;
  roleKey: string;
  permissions: string[];
  hasPin: boolean;
  requiresPinSetup: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  allowedIpsConfigured?: boolean;
  allowedIpsCount?: number;
  lockedUntil?: string | null;
  failedAttempts?: number;
  rolePresets?: Record<string, StaffRolePreset>;
  permissionCatalog?: StaffPermissionItem[];
}

export interface SupportOverview {
  totalTickets: number;
  openCount: number;
  myActiveCount?: number;
  slaRatePct?: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  slaBreachedCount: number;
  unassignedCount: number;
  unacceptedCount?: number;
  pendingAcceptanceCount?: number;
  latestUnacceptedTicket?: {
    id: string;
    serialNumber: string;
    subject: string;
    customerName: string;
    userAvatar?: string | null;
    priority: string;
    createdAt: string;
    updatedAt: string;
    reminderCycle?: number;
    alertKey?: string;
  } | null;
  csatAverage: number | null;
  csatResponses: number;
  assignableAgentsCount: number;
  macrosCount: number;
  recentTickets: SupportTicket[];
}

export interface PulseAlertsResponse {
  unacceptedTicketsCount: number;
  waitingChatsCount: number;
  myUnreadRepliesCount: number;
  reminderIntervalMs?: number;
  latestUnacceptedTicket?: {
    id: string;
    serialNumber: string;
    subject: string;
    customerName: string;
    userAvatar?: string | null;
    priority: string;
    createdAt: string;
    updatedAt: string;
    reminderCycle?: number;
    alertKey?: string;
  } | null;
  latestWaitingChat?: {
    id: string;
    chatNumber: string;
    guestName: string;
    userAvatar?: string | null;
    topic: string;
    createdAt: string;
    reminderCycle?: number;
    alertKey?: string;
  } | null;
  latestUnreadTicket?: {
    id: string;
    serialNumber: string;
    subject: string;
    customerName: string;
    userAvatar?: string | null;
    updatedAt: string;
    reminderCycle?: number;
    alertKey?: string;
  } | null;
  serverTime?: string;
}

export interface SupportAttachment {
  id?: string;
  url?: string;
  filename?: string;
  contentType?: string;
  size?: number;
}

export interface TicketReply {
  id: string;
  message?: string;
  body?: string;
  senderType?: 'customer' | 'agent' | 'system' | 'ai' | string;
  senderName?: string;
  senderAvatar?: string | null;
  senderRole?: string | null;
  isInternal?: boolean;
  visibility?: string;
  attachments?: SupportAttachment[];
  editHistory?: { editedAt: string; previousBody?: string; editedByName?: string }[];
  createdAt: string;
  updatedAt?: string;
}

export interface TicketEvent {
  id: string;
  eventType: string;
  description?: string;
  actorName?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketId?: string;
  serialNumber?: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  department?: string;
  requesterType?: 'guest' | 'registered' | string;
  isGuest?: boolean;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userAvatar?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  pendingAssigneeId?: string | null;
  pendingAssigneeName?: string | null;
  assignmentStatus?: string | null;
  escalationTier?: number;
  tags?: string[];
  slaBreached?: boolean;
  slaDueAt?: string | null;
  slaLabel?: string | null;
  csatRating?: number | null;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
  replies?: TicketReply[];
  messages?: TicketReply[];
}

export interface SupportTicketDetailResponse {
  ticket: SupportTicket;
  messages: TicketReply[];
  events: TicketEvent[];
  subTickets?: SupportTicket[];
  parentTicket?: SupportTicket | null;
  viewers?: { userId: string; name: string; lastSeenAt: string }[];
}

export interface SupportAgent {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  role?: string;
  roleKey?: string;
  roleLabel?: string;
  isOnline?: boolean;
}

export interface SupportMacro {
  id: string;
  title: string;
  category?: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveChatSession {
  id: string;
  chatNumber?: string;
  topic?: string;
  department?: string;
  status: 'waiting' | 'active' | 'on_hold' | 'closed' | 'cancelled' | string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  userId?: string | null;
  userAvatar?: string | null;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  convertedTicketId?: string | null;
  convertedTicketNumber?: string | null;
  collusionScore?: number;
  coBrowseConsent?: boolean;
  coBrowse?: { consent?: boolean; currentUrl?: string; pageTitle?: string } | null;
  coBrowseTelemetry?: { consent?: boolean; currentUrl?: string; pageTitle?: string } | null;
  lastMessage?: string;
  lastMessageAt?: string;
  joinedAt?: string;
  createdAt?: string;
}

export interface LiveChatMessage {
  id: string;
  senderType: 'visitor' | 'customer' | 'agent' | 'staff' | 'system' | 'ai' | string;
  senderName?: string;
  senderAvatar?: string | null;
  body: string;
  createdAt: string;
}

export interface LiveChatCounts {
  all: number;
  waiting: number;
  active: number;
  on_hold: number;
  closed: number;
  myActive: number;
  flagged: number;
}

export interface LiveChatPresence {
  onlineAgentsCount: number;
  freeAgentsCount: number;
  busyAgentsCount: number;
}

export interface SupportFeatureSwitches {
  liveChatWidget: boolean;
  guestTicketsEnabled: boolean;
  requireGuestContact: boolean;
  allowNewTickets: boolean;
  lockClosedReplies: boolean;
  allowCustomerReopen: boolean;
  fileAttachmentsEnabled: boolean;
  aiAutoReply: boolean;
  aiAgentDraftAssist: boolean;
  restrictStaffToAssignedQueue: boolean;
}

export interface CustomerContextData {
  billingId?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    tiwiId?: string;
    planName?: string;
    identityVerified?: boolean;
    addressVerified?: boolean;
    isBanned?: boolean;
    createdAt?: string;
  };
  orders?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  stores?: Record<string, unknown>[];
  services?: Record<string, unknown>[];
  activeSessions?: Record<string, unknown>[];
  communicationHistory?: Record<string, unknown>[];
  activityLogs?: Record<string, unknown>[];
  multiAccountRisk?: { riskLevel?: string; score?: number; signals?: string[] };
}

export interface StaffMetricRow {
  staffId: string;
  staffName: string;
  isOnline?: boolean;
  chatsAccepted?: number;
  activeChats?: number;
  closedChats?: number;
  firstResponseAvgMs?: number;
  avgResponseMs?: number;
  p95ResponseMs?: number;
  csatAverage?: number | null;
  category?: string;
  flaggedSamplesCount?: number;
}

export interface PickAppealRecord {
  id: string;
  ticketId?: string;
  subject: string;
  description?: string;
  status: string;
  resolutionNotes?: string;
  requesterName?: string;
  requesterEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

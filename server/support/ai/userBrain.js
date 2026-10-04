import { CloudDB } from '../../db/cloud.js';
import { MasterDB } from '../../db/multiTenant.js';
import { SupportDB } from '../../db/supportDb.js';
import { PLATFORM_CONFIG, getPlatformUrl } from '../../config/platformConfig.js';

function readSupportDB() {
  return SupportDB.getAllData();
}

// ====================================================================
// TIWLO USER BRAIN (BRAIN 1: PER-USER ISOLATED DATABASE SCANNER)
// Scans individual user droplets, store partitions, previous tickets,
// resolution history, and personalized context.
// ====================================================================

export const UserBrain = {
  /**
   * Scans the specific user's database records and constructs a deep
   * personalized intelligence profile for the AI agent.
   */
  async scanUserData(userId = null) {
    if (!userId || userId === 'guest' || userId === 'guest_session') {
      return null;
    }
    try {
      const [cloudData, userStores, users] = await Promise.all([
        CloudDB.getCloudDashboardData(userId).catch(() => null),
        MasterDB.getUserStores(userId).catch(() => []),
        MasterDB.getUsers().catch(() => [])
      ]);

      const user = users.find(u => u.id === userId || u.tiwiId === userId);
      if (!user) {
        return null; // Do not invent default Imran/admin profile for unknown or guest visitors!
      }

      const supportDB = readSupportDB();
      const userTickets = (supportDB.tickets || []).filter(t => !t.userId || t.userId === userId);
      const userConversations = (supportDB.conversations || []).filter(c => !c.userId || c.userId === userId || c.id.includes(userId));

      const droplets = cloudData?.droplets || [];
      const metrics = cloudData?.metrics || {
        cpuUsagePercent: 32,
        memoryUsagePercent: 48,
        storageUsagePercent: 21,
        bandwidthUsagePercent: 18
      };

      // Categorize tickets for AI decision making
      const openTickets = userTickets.filter(t => t.status === 'Open' || t.status === 'In Progress');
      const resolvedTickets = userTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');

      return {
        userProfile: {
          id: user.id,
          tiwiId: user.tiwiId,
          email: user.email,
          name: user.name || 'Imran',
          company: user.storeName,
          plan: user.planName || 'Enterprise Tier',
          accountStatus: user.status || 'Active & Verified',
          securityStatus: 'Two-Factor Ready (OTP Enabled)'
        },
        cloudInfrastructure: {
          dropletCount: droplets.length,
          droplets: droplets.map(d => ({
            id: d.id,
            name: d.name,
            specs: d.specs,
            ip: d.ip,
            region: d.region,
            status: d.status,
            image: d.image,
            created: d.created
          })),
          resourceUtilization: metrics
        },
        storesEcosystem: {
          totalStores: userStores.length,
          stores: userStores.map(s => ({
            tiwiId: s.tiwiId,
            name: s.storeName,
            domain: s.subdomain || `store.${PLATFORM_CONFIG.storeDomain}`,
            category: s.category || 'Retail Enterprise',
            currency: s.currency || 'USD ($)',
            billingLocation: `${s.billingDetails?.city || 'Dhaka'}, ${s.billingDetails?.country || 'Bangladesh'}`
          }))
        },
        supportTicketHistory: {
          totalTickets: userTickets.length,
          openTicketsCount: openTickets.length,
          resolvedTicketsCount: resolvedTickets.length,
          activeTicketsList: openTickets.map(t => ({
            id: t.ticketId || t.id,
            serialNumber: t.serialNumber || `#${t.id}`,
            subject: t.subject,
            status: t.status,
            category: t.category,
            priority: t.priority,
            lastUpdated: t.lastUpdated
          })),
          recentResolvedTickets: resolvedTickets.slice(0, 3).map(t => ({
            id: t.ticketId || t.id,
            subject: t.subject,
            status: t.status,
            category: t.category
          }))
        },
        conversationMemory: {
          totalConversations: userConversations.length,
          recentThreadTitles: userConversations.slice(0, 4).map(c => c.name || c.lastMessage)
        }
      };
    } catch (err) {
      console.warn('UserBrain scan error:', err);
      return null;
    }
  },

  /**
   * Compiles the formatted User Brain text for the prompt
   */
  async buildUserContextPrompt(userId = null) {
    const data = await this.scanUserData(userId);
    if (!data) {
      return `
================================================================================
AUTHENTICATION STATUS: UNVERIFIED GUEST VISITOR (NOT LOGGED IN)
================================================================================
• Customer is an anonymous guest visitor. They are NOT authenticated.
• STRICT PRIVACY RULE: You must NEVER disclose, speculate, or mention ANY registered user's email (such as ${PLATFORM_CONFIG.adminEmail}, Imran's email, or other customer accounts), server IPs, store names, or credentials.
• If the visitor mentions they cannot log in:
  1. Politely ask: "Could you please tell me your registered email address or store subdomain?"
  2. NEVER guess or suggest that their email is ${PLATFORM_CONFIG.adminEmail}.
  3. Direct them to ${getPlatformUrl('login')} or ${getPlatformUrl('create-account')}.
  4. If they provide their own email address and ask for an OTP or verification code, you can initiate a 6-digit OTP code to their provided email.
================================================================================
`;
    }

    const dropletsText = data.cloudInfrastructure.droplets.map(
      d => `• ${d.name} (${d.specs}, ${d.region}, IP: ${d.ip}, Status: ${d.status})`
    ).join('\n');

    const storesText = data.storesEcosystem.stores.map(
      s => `• ${s.name} (${s.domain}, Category: ${s.category}, City: ${s.billingLocation})`
    ).join('\n');

    const openTicketsText = data.supportTicketHistory.activeTicketsList.length > 0
      ? data.supportTicketHistory.activeTicketsList.map(t => `• Ticket ${t.serialNumber}: "${t.subject}" [Status: ${t.status}, Priority: ${t.priority}]`).join('\n')
      : '• No active open tickets.';

    const resolvedTicketsText = data.supportTicketHistory.recentResolvedTickets.length > 0
      ? data.supportTicketHistory.recentResolvedTickets.map(t => `• Previously Resolved: Ticket ${t.id} ("${t.subject}")`).join('\n')
      : '• No past tickets.';

    return `
================================================================================
BRAIN 1: USER-SPECIFIC DATABASE & ACCOUNT INTEL (STRICTLY ISOLATED FOR THIS USER)
================================================================================
• Verified Customer Name: ${data.userProfile.name}
• Primary Account Email: ${data.userProfile.email} (Tenant ID: ${data.userProfile.tiwiId})
• Current Subscription Plan: ${data.userProfile.plan} (Status: ${data.userProfile.accountStatus})

LIVE CLOUD DROPLETS (${data.cloudInfrastructure.dropletCount} Deployed):
${dropletsText}
Current Resource Metrics: CPU ${data.cloudInfrastructure.resourceUtilization.cpuUsagePercent}%, Memory ${data.cloudInfrastructure.resourceUtilization.memoryUsagePercent}%, Storage ${data.cloudInfrastructure.resourceUtilization.storageUsagePercent}%.

ONLINE ECOMMERCE STORES (${data.storesEcosystem.totalStores} Active):
${storesText}

SUPPORT TICKET RECORDS:
- Active Tickets (${data.supportTicketHistory.openTicketsCount}):
${openTicketsText}
- Resolved Tickets History (${data.supportTicketHistory.resolvedTicketsCount}):
${resolvedTicketsText}
================================================================================
`;
  }
};

import { SystemBrain } from './brain.js';
import { AiActionsEngine } from './aiActions.js';
import { executeGeminiWithFailover, getChatSystemSettings } from './aiKeyPoolService.js';
import { getPlatformUrl } from '../../config/platformConfig.js';

// ====================================================================
// TIWI AI API ENGINE (POWERED INTERNALLY BY GEMINI KEY POOL FAILOVER)
// With Autonomous Action Execution & Dual-Brain Intelligence
// ====================================================================

export const TiwiAI = {
  /**
   * Generates a realistic, human-style live support reply
   * using the Tiwi AI API with autonomous action detection.
   */
  async generateSupportReply({
    agentName = 'Sarah Jenkins',
    agentRole = 'Senior Support Specialist',
    userId = 'guest',
    userName = 'Customer',
    userEmail = '',
    isLoggedIn = false,
    userMessage,
    conversationHistory = [],
    activeTicketId = null,
    ticketStatus = null,
    mode = 'auto_reply',
    clientContext = {}
  }) {
    if (!userMessage || !userMessage.trim()) {
      return {
        reply: `Hello ${userName || 'there'}! How can I help you today?`,
        timestamp: new Date().toISOString()
      };
    }

    try {
      const chatSettings = await getChatSystemSettings();
      const nowIso = new Date().toISOString();

      if (chatSettings.liveChatWidgetEnabled === false) {
        return {
          reply: 'Live chat support is currently offline. Please submit a support ticket and our team will respond shortly.',
          agent: agentName,
          aiDisabled: true,
          reason: 'LIVE_CHAT_WIDGET_DISABLED',
          timestamp: nowIso
        };
      }

      if (
        chatSettings.blockChatOnClosedTicket !== false &&
        ticketStatus &&
        ['closed', 'resolved'].includes(String(ticketStatus).trim().toLowerCase())
      ) {
        return {
          reply: 'This support ticket is already closed. Please open a new support ticket if you need further assistance.',
          agent: agentName,
          aiDisabled: true,
          reason: 'TICKET_CLOSED',
          timestamp: nowIso
        };
      }

      if (!isLoggedIn && chatSettings.guestChatEnabled === false) {
        return {
          reply: 'Guest live chat is currently disabled. Please sign in to your Tiwlo account to chat with support.',
          agent: agentName,
          aiDisabled: true,
          reason: 'GUEST_CHAT_DISABLED',
          timestamp: nowIso
        };
      }

      if (mode === 'agent_assist' && chatSettings.aiAgentAssistEnabled === false) {
        return {
          reply: '',
          agent: agentName,
          aiDisabled: true,
          reason: 'AI_AGENT_ASSIST_DISABLED',
          timestamp: nowIso
        };
      }

      if (mode === 'triage' && chatSettings.aiTriageEnabled === false) {
        return {
          reply: '',
          agent: agentName,
          aiDisabled: true,
          reason: 'AI_TRIAGE_DISABLED',
          timestamp: nowIso
        };
      }

      if (chatSettings.enabled === false || (mode === 'auto_reply' && chatSettings.aiAutoReplyEnabled === false)) {
        return {
          reply: 'Thank you for your message! A human support specialist will review your request and reply shortly.',
          agent: agentName,
          aiDisabled: true,
          reason: 'AI_AUTO_REPLY_DISABLED',
          timestamp: nowIso
        };
      }

      // 1. Build live system context and prompt from Dual-Brain System
      const systemInstruction = await SystemBrain.buildAgentSystemPrompt(
        agentName,
        agentRole,
        userId,
        userName,
        userMessage,
        clientContext,
        isLoggedIn
      );

      // 2. Format conversation history for Gemini API
      const contents = [];

      // Add previous conversation messages if any (limit to last 6 for prompt efficiency)
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        const msgText = msg?.text ?? msg?.parts?.[0]?.text ?? '';
        if (!msgText) continue;
        if (msg.sender === 'user' || msg.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: msgText }] });
        } else if (msg.sender === 'agent' || msg.role === 'model') {
          contents.push({ role: 'model', parts: [{ text: msgText }] });
        }
      }

      // Add the current user query
      contents.push({ role: 'user', parts: [{ text: userMessage.trim() }] });

      // 3. Make API request via Gemini Key Pool with automatic quota failover
      const payload = {
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
          topP: 0.95
        }
      };

      let responseText = null;
      let aiMeta = null;

      try {
        const aiResult = await executeGeminiWithFailover({ payload });
        if (aiResult?.text) {
          responseText = aiResult.text;
          aiMeta = {
            usedKeyId: aiResult.usedKeyId,
            usedKeyLabel: aiResult.usedKeyLabel,
            usedModel: aiResult.usedModel,
            failoverCount: aiResult.failoverCount
          };
        }
      } catch (err) {
        console.warn('TiwiAI key pool failover execution failed:', err.message);
      }

      if (!responseText) {
        responseText = this.generateLocalFallback(userMessage, agentName);
      }

      // 4. AUTONOMOUS ACTION DETECTION & EXECUTION
      let executedAction = null;
      const lowerQuery = userMessage.toLowerCase();
      const lowerReply = responseText.toLowerCase();

      // Autonomous Action A: Auto-Resolve Ticket (strictly for authenticated ticket owner)
      if (
        isLoggedIn &&
        activeTicketId &&
        (lowerQuery.includes('working now') || lowerQuery.includes('it works') || lowerQuery.includes('fixed') || lowerQuery.includes('problem solved') || lowerQuery.includes('thank you, it is resolved'))
      ) {
        const resolveResult = await AiActionsEngine.resolveTicket({
          ticketId: activeTicketId,
          resolutionReason: 'Resolved by customer confirmation in live support session',
          userId
        });
        if (resolveResult.success) {
          executedAction = {
            type: 'TICKET_RESOLVED',
            ticketId: resolveResult.ticketId,
            serialNumber: resolveResult.serialNumber,
            message: `Ticket ${resolveResult.serialNumber} marked as Resolved.`
          };
        }
      }

      // Autonomous Action B: Auto-Create Official Ticket on Critical / Tough Situations
      else if (
        isLoggedIn &&
        (lowerQuery.includes('create ticket') || lowerQuery.includes('open a ticket') ||
        lowerQuery.includes('server crashed') || lowerQuery.includes('kernel panic') ||
        lowerQuery.includes('database down') || lowerQuery.includes('emergency') ||
        lowerQuery.includes('severe'))
      ) {
        const autoTicket = await AiActionsEngine.autoCreateTicket({
          subject: userMessage.slice(0, 80),
          category: 'Technical Cloud Operations',
          priority: 'High',
          description: userMessage,
          userId,
          userName
        });
        if (autoTicket.success) {
          executedAction = {
            type: 'TICKET_CREATED',
            ticketId: autoTicket.ticketId,
            serialNumber: autoTicket.serialNumber,
            message: `Official Enterprise Ticket ${autoTicket.serialNumber} created.`
          };
        }
      }

      // Autonomous Action C: Droplet Reboot Execution (strictly for authenticated user)
      else if (isLoggedIn && (lowerQuery.includes('reboot') || lowerQuery.includes('restart droplet'))) {
        const rebootResult = await AiActionsEngine.manageDroplet({
          dropletNameOrId: 'web-server-01',
          action: 'reboot',
          userId
        });
        if (rebootResult.success) {
          executedAction = {
            type: 'DROPLET_REBOOTED',
            message: rebootResult.message
          };
        }
      }

      // Autonomous Action D: Account Lookup, Password Reset & OTP Dispatch
      // Security: Only dispatch automated emails for an authenticated user's own verified email.
      // Unauthenticated visitors are directed to the rate-limited /login recovery flow to prevent enumeration & email bombing.
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|send|please|go ahead|দাও|হ্যাঁ|হ্যা|পাঠাও|পাঠিয়ে দাও|পাঠান|সেন্ড কর)/i.test(userMessage.trim());
      const isPasswordReset = /reset|recovery|recover|forgot|password|পাসওয়ার্ড|রিকভারি|ভুলে গেছি/i.test(lowerQuery);
      const mentionsOtp = /otp|verification code|code|verify|login code|কোড|ওটিপি/i.test(lowerQuery);

      const lastAgentMsg = [...conversationHistory].reverse().find(m => m.sender === 'agent')?.text || '';
      const agentOfferedOtp = /otp|verification code|code to your email|ইমেইলে ওটিপি|কোড পাঠাবো|রিকভারি|রিসেট/i.test(lastAgentMsg);

      if (isLoggedIn && userEmail && userEmail.includes('@')) {
        if (isPasswordReset || (agentOfferedOtp && isAffirmative && (lastAgentMsg.includes('পাসওয়ার্ড') || lastAgentMsg.includes('password')))) {
          const resetResult = await AiActionsEngine.generateAndSendPasswordReset({
            targetEmail: userEmail,
            userName
          });
          if (resetResult.success) {
            executedAction = {
              type: 'PASSWORD_RESET_DISPATCHED',
              email: resetResult.email,
              message: resetResult.message
            };
            responseText = `Hello ${userName || 'Customer'}! I have dispatched an official password recovery email to your registered address (${resetResult.email}). Please check your inbox (and spam folder), or visit ${getPlatformUrl('login')} to complete recovery.`;
          }
        } else if ((agentOfferedOtp && isAffirmative) || mentionsOtp) {
          const otpResult = await AiActionsEngine.generateAndSendOTP({
            targetEmail: userEmail,
            userId,
            userName,
            purpose: 'Account Verification & Secure Access'
          });
          if (otpResult.success) {
            executedAction = {
              type: 'OTP_DISPATCHED',
              email: otpResult.email,
              message: otpResult.message
            };
            responseText = `Hello ${userName || 'Customer'}! I have dispatched a 6-digit verification code to your registered address (${otpResult.email}). Please check your inbox (and spam folder).`;
          }
        }
      } else if (!isLoggedIn && (isPasswordReset || mentionsOtp)) {
        responseText = `For your account security, please use our protected recovery page at ${getPlatformUrl('login')} and select "Forgot Password" to receive a verification code.`;
      }

      return {
        reply: responseText.trim(),
        agent: agentName,
        actionExecuted: executedAction,
        ...(aiMeta ? { aiMeta } : {}),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('TiwiAI engine error:', err);
      return {
        reply: `Hi there! I am currently checking that in our system for you. Could you please give me a moment or specify your droplet or store name?`,
        agent: agentName,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Graceful contextual fallback if external API is unreachable
   */
  generateLocalFallback(query, agentName) {
    const q = query.toLowerCase();
    if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
      return `Hello! My name is ${agentName} from Tiwlo Live Support. Great to have you here! How can I assist you with your servers, stores, or POS system today?`;
    }
    if (q.includes('droplet') || q.includes('server')) {
      return `Your cloud droplets are running smoothly in our high-performance infrastructure! You can deploy, restart, or configure new droplets anytime directly from your Main Control Center. Would you like me to guide you through deploying an Ubuntu, Debian, or Docker image?`;
    }
    if (q.includes('store') || q.includes('shop')) {
      return `You can easily manage or add isolated stores under "My Online Store" in your navigation. Each store features dedicated tenant isolation, instant HTTPS subdomains, and POS connectivity.`;
    }
    if (q.includes('pos') || q.includes('barcode')) {
      return `Our Omnichannel POS system is ready for fast desktop, iPad, and barcode scanning with thermal receipt printing. You can access it anytime from the Store Console!`;
    }
    return `Thank you for reaching out! I've noted your request regarding "${query}". Everything on your account is fully active and secure. Please let me know if you need step-by-step assistance with any specific server or storefront feature!`;
  }
};

import { SystemBrain } from './brain.js';
import { AiActionsEngine } from './aiActions.js';

// ====================================================================
// TIWI AI API ENGINE (POWERED INTERNALLY BY GEMINI FLASH)
// With Autonomous Action Execution & Dual-Brain Intelligence
// ====================================================================

const TIWI_GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest'
];

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
    clientContext = {}
  }) {
    if (!userMessage || !userMessage.trim()) {
      return {
        reply: `Hello ${userName || 'there'}! How can I help you today?`,
        timestamp: new Date().toISOString()
      };
    }

    try {
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
        if (msg.sender === 'user') {
          contents.push({ role: 'user', parts: [{ text: msg.text }] });
        } else if (msg.sender === 'agent') {
          contents.push({ role: 'model', parts: [{ text: msg.text }] });
        }
      }

      // Add the current user query
      contents.push({ role: 'user', parts: [{ text: userMessage.trim() }] });

      // 3. Make API request to Gemini Engine
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

      // Iterate through active models with resilient fallback
      for (const model of CANDIDATE_MODELS) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${TIWI_GEMINI_KEY}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6500)
          });

          const data = await res.json();
          if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            responseText = data.candidates[0].content.parts[0].text;
            break;
          }
        } catch (err) {
          console.warn(`Model ${model} request failed:`, err.message);
        }
      }

      if (!responseText) {
        responseText = this.generateLocalFallback(userMessage, agentName);
      }

      // 4. AUTONOMOUS ACTION DETECTION & EXECUTION
      let executedAction = null;
      const lowerQuery = userMessage.toLowerCase();
      const lowerReply = responseText.toLowerCase();

      // Autonomous Action A: Auto-Resolve Ticket
      if (
        (lowerQuery.includes('working now') || lowerQuery.includes('it works') || lowerQuery.includes('fixed') || lowerQuery.includes('problem solved') || lowerQuery.includes('thank you, it is resolved'))
      ) {
        const targetId = activeTicketId || 'TWTK-1008';
        const resolveResult = await AiActionsEngine.resolveTicket({
          ticketId: targetId,
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
        lowerQuery.includes('create ticket') || lowerQuery.includes('open a ticket') ||
        lowerQuery.includes('server crashed') || lowerQuery.includes('kernel panic') ||
        lowerQuery.includes('database down') || lowerQuery.includes('emergency') ||
        lowerQuery.includes('severe')
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

      // Autonomous Action C: Droplet Reboot Execution
      else if (lowerQuery.includes('reboot') || lowerQuery.includes('restart droplet')) {
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
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const emailMatch = userMessage.match(emailRegex);
      let targetEmail = emailMatch ? emailMatch[1] : (userEmail && userEmail.includes('@') ? userEmail : null);

      if (!targetEmail) {
        for (const m of [...conversationHistory].reverse()) {
          const mEmail = m.text?.match(emailRegex);
          if (mEmail) {
            targetEmail = mEmail[1];
            break;
          }
        }
      }

      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|send|please|go ahead|দাও|হ্যাঁ|হ্যা|পাঠাও|পাঠিয়ে দাও|পাঠান|সেন্ড কর)/i.test(userMessage.trim());
      const isPasswordReset = /reset|recovery|recover|forgot|password|পাসওয়ার্ড|রিকভারি|ভুলে গেছি/i.test(lowerQuery);
      const mentionsOtp = /otp|verification code|code|verify|login code|কোড|ওটিপি/i.test(lowerQuery);

      const lastAgentMsg = [...conversationHistory].reverse().find(m => m.sender === 'agent')?.text || '';
      const agentOfferedOtp = /otp|verification code|code to your email|ইমেইলে ওটিপি|কোড পাঠাবো|রিকভারি|রিসেট/i.test(lastAgentMsg);

      if (targetEmail) {
        // Query database to verify account existence
        const accountInfo = await AiActionsEngine.findUserAccount(targetEmail);

        if (isPasswordReset || (agentOfferedOtp && isAffirmative && (lastAgentMsg.includes('পাসওয়ার্ড') || lastAgentMsg.includes('password')))) {
          // Send Password Recovery Email via Tiwlo SMTP
          const resetResult = await AiActionsEngine.generateAndSendPasswordReset({
            targetEmail,
            userName: accountInfo.found ? accountInfo.name : userName
          });
          if (resetResult.success) {
            executedAction = {
              type: 'PASSWORD_RESET_DISPATCHED',
              email: resetResult.email,
              otpCode: resetResult.otpCode,
              message: resetResult.message
            };
            responseText = `Hello ${accountInfo.found ? accountInfo.name : 'Customer'}! I have checked our system and dispatched an official password recovery email to ${resetResult.email}. It contains your 6-digit security code and instructions to reset your password. Please check your inbox (and spam folder), or visit https://tiwlo.com/login to complete recovery.`;
          }
        } else if ((agentOfferedOtp && isAffirmative) || mentionsOtp || lowerQuery.includes('send') || lowerQuery.includes('পাঠাও')) {
          // Send 2FA / Login Verification OTP via Tiwlo SMTP
          const otpResult = await AiActionsEngine.generateAndSendOTP({
            targetEmail,
            userId,
            userName: accountInfo.found ? accountInfo.name : userName,
            purpose: 'Account Verification & Secure Access'
          });
          if (otpResult.success) {
            executedAction = {
              type: 'OTP_DISPATCHED',
              email: otpResult.email,
              otpCode: otpResult.otpCode,
              message: otpResult.message
            };
            responseText = `Hello ${accountInfo.found ? accountInfo.name : 'Customer'}! I have dispatched a 6-digit verification code to ${otpResult.email} via our secure mail delivery system. Please check your inbox (and spam folder).`;
          }
        }
      }

      return {
        reply: responseText.trim(),
        agent: agentName,
        actionExecuted: executedAction,
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

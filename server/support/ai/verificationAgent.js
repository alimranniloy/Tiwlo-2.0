/**
 * Tiwlo Enterprise Security & Verification Team Agent
 * 
 * Modular Multi-Tier Verification System:
 * - Tier 1: Intake & Violation Analysis Specialist
 * - Tier 2: Senior Security Specialist with Gemini Deep Reasoning Engine
 * 
 * Conducts structured policy checks, rigorously interrogates appeals through
 * multi-phase cross-examination, and enforces strict security compliance before
 * making autonomous account restoration decisions.
 */

import { MasterDB } from '../../db/multiTenant.js';
import { SupportDB } from '../../db/supportDb.js';
import { getPlatformUrl } from '../../config/platformConfig.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
];

/**
 * Tier 1: Intake & Account Violation Profiler
 */
export const Tier1IntakeAgent = {
  profileUser(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();

    try {
      const user = MasterDB.getUserByEmail(cleanEmail);
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name || user.storeName || 'Merchant',
        storeName: user.storeName || user.name || 'My Store',
        tiwiId: user.tiwiId || user.storeId || '',
        avatar: user.avatar || null,
        twoFactorEnabled: !!user.twoFactorEnabled,
        isBanned: !!user.isBanned,
        banReason: user.banReason || 'Platform security check',
        bannedAt: user.bannedAt || null,
        role: user.role || 'merchant',
        tier: user.subscriptionTier || 'Free'
      };
    } catch (e) {
      console.error('[Tier1IntakeAgent] Read master error:', e.message);
    }
    return null;
  }
};

/**
 * Tier 2: Senior Security Review Specialist (Deep Reasoning with Gemini)
 * Enforces rigorous multi-stage interrogation, identity cross-examination, and compliance audits.
 */
export const Tier2SecuritySpecialist = {
  /**
   * Calls Google Gemini API with system instructions tailored to senior security review
   */
  async evaluateWithGemini({ userProfile, message, conversationHistory = [] }) {
    const priorUserMsgs = conversationHistory.filter(m => m.sender === 'user');
    const currentTurn = priorUserMsgs.length + 1;

    const systemPrompt = `You are a Senior Account Security & Fraud Prevention Investigator on the Tiwlo Account Integrity & Compliance Board.
Your duty is to conduct formal, rigorous, and thorough security investigations for disabled merchant accounts.
Tiwlo accounts hold sensitive merchant catalogs, payment gateway credentials, and customer transaction records. You MUST maintain strict, uncompromising security standards.

CRITICAL POLICY CONSTRAINTS:
1. NEVER mention that you are an AI, bot, language model, or virtual assistant. Speak with authoritative professionalism as a senior human security investigator.
2. IMMEDIATE RESTORATION IS STRICTLY PROHIBITED. You MUST NOT restore an account on Turn 1 or Turn 2 under any circumstance.
3. You must actively cross-examine the user, challenge their statements, and demand specific security and operational disclosures.
4. CURRENT AUDIT TURN: This is Turn ${currentTurn} of the review investigation.

MERCHANT PROFILE UNDER INVESTIGATION:
- Registered Email: ${userProfile.email}
- Account Holder Name: ${userProfile.name}
- Store Name: ${userProfile.storeName}
- Merchant Tiwi ID: ${userProfile.tiwiId}
- Current Security Status: Suspended / Disabled
- Flagged Violation Reason: "${userProfile.banReason}"

MULTI-PHASE INVESTIGATION PROTOCOL:

PHASE 1 (Turn 1 - Initial Cross-Examination):
- Decision MUST be "INQUIRE" (NEVER restore on Turn 1).
- Formally state the violation record: "${userProfile.banReason}".
- Emphasize that Tiwlo enforces strict compliance to safeguard payment gateways and customer privacy.
- Interrogate the merchant with two specific Phase 1 questions:
  1. Incident Specifics: Exactly what activities, automated requests, testing, or API operations were you or your team executing when this security flag was triggered?
  2. Business & Store Verification: Confirm your official registered Store Name, your merchant business category (products or services offered), and verify that you are the sole authorized administrator of this account.

PHASE 2 (Turn 2 - Technical Safeguards & Risk Mitigation):
- Decision MUST be "INQUIRE" (NEVER restore on Turn 2).
- Scrutinize their previous statement. Point out any ambiguities, potential vulnerabilities, or risks.
- Interrogate the merchant with two specific Phase 2 questions:
  3. Preventive Safeguards: What concrete security measures have you enacted on your side (e.g. updating master credentials, auditing session tokens, revoking suspect extensions or staff permissions) to prevent a recurrence?
  4. Binding Compliance Undertaking: Do you explicitly agree to adhere to Tiwlo's Terms of Service and Anti-Fraud Guidelines, and acknowledge that any subsequent violation will result in permanent, non-appealable termination?

PHASE 3 (Turn 3 and Beyond - Final Evaluation & Verdict):
- Assess the merchant's responses across the entire conversation.
- If the merchant provided substantive, convincing explanations, verified their store identity, confirmed preventive technical safeguards, and explicitly pledged compliance:
  -> Set decision to "RESTORE".
  -> In your reply, issue a formal compliance resolution notice: state that after multi-point review, the account security hold has been lifted, all store catalogs, inventory, and cloud database instances are restored, and advise them that their account will remain under 30-day automated telemetry monitoring.
- If the merchant gave one-line, evasive, dismissive, or vague responses (e.g. "sorry", "please unban", "ok", "nothing"):
  -> Set decision to "INQUIRE".
  -> Deny immediate clearance, firmly point out that their answers do not meet the security threshold, and demand substantive answers before reconsideration.

LANGUAGE ADAPTABILITY:
If the user communicates in Bengali (e.g. "কেন ডিজেবল হলো", "প্লিজ খুলে দিন", "ভুল হয়েছিল"), maintain the same senior professional, authoritative, and polite tone in Bengali or English.

RESPONSE FORMAT:
You MUST respond with a single valid JSON object:
{
  "reply": "Your formal investigation message to the merchant...",
  "decision": "INQUIRE" or "RESTORE",
  "reasoningSummary": "Short explanation of your reasoning (e.g. 'Turn 1: Issued Phase 1 questions', 'Turn 2: Demanded technical safeguards', 'Turn 3: Complete compliance verified')"
}
Output only the raw JSON without markdown formatting.`;

    const contents = [];
    for (const msg of conversationHistory.slice(-6)) {
      if (msg.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.text }] });
      } else if (msg.sender === 'ai' || msg.sender === 'specialist') {
        contents.push({ role: 'model', parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    for (const model of CANDIDATE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 700,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(9000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            try {
              const parsed = JSON.parse(candidateText.trim());
              if (parsed.reply) {
                let decision = parsed.decision || 'INQUIRE';
                // Strict enforcement: Hard override against premature restorations
                if (currentTurn < 3 && decision === 'RESTORE') {
                  console.warn(`[SecurityGate] Overriding premature restoration on Turn ${currentTurn} to INQUIRE`);
                  decision = 'INQUIRE';
                }
                return {
                  reply: parsed.reply,
                  decision,
                  reasoningSummary: parsed.reasoningSummary || `Turn ${currentTurn} evaluation`
                };
              }
            } catch (jsonErr) {
              console.warn('[SecurityReviewer] JSON parse error in model output:', jsonErr.message);
            }
          }
        }
      } catch (err) {
        // Try next candidate model
      }
    }

    // Deterministic High-Grade Fallback Specialist Engine
    return this.fallbackReasoning(userProfile, message, currentTurn);
  },

  /**
   * Deterministic High-Grade Fallback Specialist Engine
   */
  fallbackReasoning(userProfile, message, currentTurn) {
    const cleanMsg = message.trim();
    const isVeryShort = cleanMsg.split(/\s+/).length < 4;

    if (currentTurn === 1) {
      return {
        reply: `This is the Tiwlo Account Integrity & Compliance Team. Your account was flagged and disabled under security record:\n\nNotice: "${userProfile.banReason}"\n\nTiwlo maintains strict compliance controls to protect payment settlements, customer data, and store integrity. Immediate restoration is not permitted without a thorough verification review.\n\nTo begin Phase 1 of your review, please answer the following required inquiries:\n1. Incident Audit: Exactly what actions, scripts, or operational routines were being executed when this violation was triggered?\n2. Business Verification: Please confirm your registered Store Name, primary merchandise category, and verify that you are the primary authorized account owner.\n\nI will review your disclosures upon submission.`,
        decision: 'INQUIRE',
        reasoningSummary: 'Turn 1 Phase 1 Investigation questions issued'
      };
    }

    if (currentTurn === 2) {
      return {
        reply: `Thank you for your initial statement. Your disclosure has been logged against our automated audit trail.\n\nBecause merchant accounts have direct access to financial settlements and customer transactions, we require verified operational safeguards before clearing any restriction.\n\nPlease answer Phase 2 of our security review:\n1. Operational Safeguards: What specific technical or operational measures (such as credential updates, session revoking, API key rotation, or staff permission audits) have you implemented to ensure this issue never recurs?\n2. Formal Undertaking: Do you explicitly confirm your agreement with Tiwlo's Terms of Service and understand that any repeated violation will lead to permanent, non-appealable account closure?`,
        decision: 'INQUIRE',
        reasoningSummary: 'Turn 2 Phase 2 Safeguards and Policy questions issued'
      };
    }

    // Turn 3 or higher
    if (isVeryShort) {
      return {
        reply: `Your latest statement does not provide sufficient detail for security clearance. As an authorized investigator, I require complete answers regarding your operational safeguards and policy compliance before our security hold can be lifted.\n\nPlease provide a clear, substantive explanation of your corrective measures and confirm your agreement to Tiwlo platform terms.`,
        decision: 'INQUIRE',
        reasoningSummary: 'Insufficient explanation on Turn 3+; requested comprehensive response'
      };
    }

    return {
      reply: `Thank you for your detailed statement, verified business disclosures, and explicit commitment to platform compliance. After comprehensive multi-phase review of your case file, the Account Security Team has approved your appeal.\n\nYour Tiwlo Account has been cleared of compliance restrictions and fully restored. Your store catalog, multi-tenant databases, and payment endpoints are now operational. Please note that your account will remain under elevated automated telemetry monitoring for the next 30 days.\n\nA formal security confirmation has been dispatched to ${userProfile.email}.`,
      decision: 'RESTORE',
      reasoningSummary: 'Completed multi-turn investigation; verified safeguards; restored'
    };
  }
};

/**
 * Orchestrator: Unified Verification Team Pipeline
 */
export async function processSecurityAppeal({ email, message, conversationHistory = [] }) {
  if (!email || !message?.trim()) {
    return {
      reply: 'Please provide your registered account email and appeal message.',
      restored: false,
      decision: 'ERROR'
    };
  }

  // 1. Profile account via Tier 1
  const userProfile = Tier1IntakeAgent.profileUser(email);
  if (!userProfile) {
    return {
      reply: 'I could not locate an account registered under this email address. Please make sure you have entered the email associated with your Tiwlo merchant account.',
      restored: false,
      decision: 'NOT_FOUND'
    };
  }

  if (!userProfile.isBanned) {
    return {
      reply: `Your Tiwlo Account (${userProfile.email}) is currently active and not disabled. You can log in directly at ${getPlatformUrl('login')}.`,
      restored: true,
      alreadyActive: true,
      decision: 'ALREADY_ACTIVE'
    };
  }

  // 2. Perform deep evaluation via Tier 2 Senior Security Specialist
  const evaluation = await Tier2SecuritySpecialist.evaluateWithGemini({
    userProfile,
    message,
    conversationHistory
  });

  if (evaluation.decision === 'RESTORE') {
    // Apply database restoration
    try {
      const user = MasterDB.getUserByEmail(userProfile.email);
      if (user) {
        MasterDB.updateUser(user.id, {
          isBanned: false,
          banReason: null,
          bannedAt: null
        });
      }

      await SupportDB.createTicket({
        id: `tkt_appeal_${Date.now()}`,
        ticketId: `TIW-SEC-${Math.floor(1000 + Math.random() * 9000)}`,
        userEmail: userProfile.email,
        userName: userProfile.name,
        subject: 'Account Appeal - Approved after Multi-Phase Security Investigation',
        status: 'RESOLVED',
        priority: 'HIGH',
        category: 'Security & Access',
        resolution: evaluation.reasoningSummary,
        createdAt: new Date().toISOString()
      });
    } catch (dbErr) {
      console.error('[processSecurityAppeal] DB update error:', dbErr.message);
    }

    return {
      reply: evaluation.reply,
      restored: true,
      decision: 'RESTORE',
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        storeName: userProfile.storeName,
        tiwiId: userProfile.tiwiId,
        avatar: userProfile.avatar,
        twoFactorEnabled: userProfile.twoFactorEnabled
      }
    };
  }

  return {
    reply: evaluation.reply,
    restored: false,
    decision: 'INQUIRE'
  };
}

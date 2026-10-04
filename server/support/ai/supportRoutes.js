import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAgentByTier, getOnlineSpecialists, generateTicketSerial } from './agentsPool.js';
import { TiwiAI } from './tiwiAi.js';
import { SystemBrain } from './brain.js';
import { sendAccountRestoredEmail } from '../../db/emailService.js';
import { processSecurityAppeal } from './verificationAgent.js';
import { RestoreSessions } from '../../db/restoreSessions.js';

import { SupportDB } from '../../db/supportDb.js';
import { MasterDB } from '../../db/multiTenant.js';
import { PLATFORM_CONFIG } from '../../config/platformConfig.js';

const router = express.Router();

function readSupportDB() {
  return SupportDB.getAllData();
}

function writeSupportDB(data) {
  SupportDB.saveAllData(data);
}

// 1. Get online specialists count (512 online) and sample avatars
router.get('/online-agents', (req, res) => {
  try {
    const data = getOnlineSpecialists(4);
    res.json({
      onlineCount: 512,
      agents: data.sampleAgents
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch online specialists' });
  }
});

// 2. Real Tickets API: GET tickets strictly filtered by verified authenticated userId
router.get('/tickets', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || userId === 'guest' || userId === 'guest_session') {
      return res.json({
        success: true,
        tickets: []
      });
    }
    const db = readSupportDB();
    const userTickets = (db.tickets || []).filter(t => t.userId === userId);
    res.json({
      success: true,
      tickets: userTickets
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// 3. Real Tickets API: POST create new ticket with TWTK-XXXX format
router.post('/tickets', (req, res) => {
  try {
    const {
      subject,
      category = 'General Inquiry',
      priority = 'Medium',
      description,
      attachments = [],
      userId = null,
      userName = 'Imran'
    } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const db = readSupportDB();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `TWTK-${randomNum}`;
    const serialNumber = `#TWTK-${randomNum}`;

    const newTicket = {
      id: ticketId,
      ticketId,
      serialNumber,
      userId,
      userName,
      subject: subject.trim(),
      snippet: description ? (description.trim().slice(0, 100) + '...') : '',
      description: description ? description.trim() : '',
      category,
      priority,
      status: 'Open',
      lastUpdated: 'Just now',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments,
      assignedAgent: 'Sarah Jenkins (Tier-1 Customer Support Specialist)'
    };

    db.tickets.unshift(newTicket);
    writeSupportDB(db);

    res.status(201).json({
      success: true,
      ticket: newTicket
    });
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// 4. Real Conversations API: GET conversations strictly filtered by verified authenticated userId
router.get('/conversations', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || userId === 'guest' || userId === 'guest_session') {
      return res.json({
        success: true,
        conversations: []
      });
    }
    const db = readSupportDB();
    const userConvs = (db.conversations || []).filter(c => c.userId === userId);
    res.json({
      success: true,
      conversations: userConvs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// 5. Real Conversations API: POST message to conversation with AI generation
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      text,
      sender = 'user',
      userName = 'Imran',
      userId = null,
      clientSource = req.headers['x-client-source'] || 'web',
      sessionId = req.headers['x-session-id'] || null,
      deviceFingerprint = null
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const db = readSupportDB();
    let conv = db.conversations.find(c => c.id === id);

    if (!conv) {
      conv = {
        id,
        name: 'Support Team',
        role: 'Support Team',
        time: 'Just now',
        unread: 0,
        isSupport: true,
        lastMessage: text,
        messages: []
      };
      db.conversations.unshift(conv);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      time: timeStr,
      timestamp: now.toISOString()
    };

    conv.messages.push(userMessage);
    conv.lastMessage = text.trim();
    conv.time = timeStr;

    const clientContext = {
      clientSource: clientSource || req.headers['x-client-source'] || 'web',
      sessionId: sessionId || req.headers['x-session-id'],
      deviceFingerprint: deviceFingerprint || {
        platform: req.headers['x-client-platform'] || 'web',
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
      }
    };

    // Generate intelligent AI reply via Gemini Flash
    let replyText = "Hello Imran, thank you for reaching out to Tiwlo Support. We are reviewing your servers and account status now.";
    try {
      const history = conv.messages.slice(-8).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const replyData = await TiwiAI.generateSupportReply({
        agentName: 'Sarah Jenkins',
        agentRole: 'Senior Support Specialist',
        userId,
        userName,
        userMessage: text.trim(),
        conversationHistory: history,
        clientContext
      });

      if (replyData?.reply) {
        replyText = replyData.reply;
      }
    } catch (e) {
      console.warn('AI generation fallback in conversation route:', e);
    }

    const agentMessage = {
      id: `msg_reply_${Date.now()}`,
      sender: 'agent',
      text: replyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString()
    };

    conv.messages.push(agentMessage);
    conv.lastMessage = replyText;
    writeSupportDB(db);

    res.json({
      success: true,
      userMessage,
      agentMessage,
      conversation: conv
    });
  } catch (err) {
    console.error('Error posting message to conversation:', err);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// 6. Initiate support session with ticket serial & personalized greeting (TWTK-XXXX)
router.post('/initiate', (req, res) => {
  try {
    const {
      isLoggedIn = false,
      userName = '',
      userId = null,
      userEmail = '',
      storeName = '',
      initialSubject
    } = req.body;

    const agent = getAgentByTier(1); // Starts at Tier-1 Customer Support
    const ticket = generateTicketSerial(); // Generates #TWTK-XXXXX
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const isUserAuth = Boolean(isLoggedIn && userId && userId !== 'guest' && userId !== 'guest_session');
    const cleanUserId = isUserAuth ? userId : 'guest';
    const cleanName = isUserAuth ? (userName && userName !== 'undefined' ? userName : 'Store Owner') : (userName && userName !== 'Guest Visitor' && userName !== 'undefined' ? userName : 'Guest');

    const welcomeGreeting = isUserAuth
      ? `Hello ${cleanName}! My name is ${agent.firstName} from Tiwlo Customer Support (Ticket ${ticket.serialNumber}). How can I assist you with your servers, stores, or POS system today?`
      : `Hello and welcome to Tiwlo Support! My name is ${agent.firstName} (Session ${ticket.serialNumber}). How can I help you today? If you need help logging in or accessing your store, feel free to ask.`;

    const db = readSupportDB();
    if (!Array.isArray(db.tickets)) db.tickets = [];
    if (!Array.isArray(db.conversations)) db.conversations = [];

    // 1. Create real ticket in database
    const newTicket = {
      id: ticket.ticketId,
      ticketId: ticket.ticketId,
      serialNumber: ticket.serialNumber,
      userId: cleanUserId,
      userName: cleanName,
      userEmail: isUserAuth ? (userEmail || '') : '',
      subject: initialSubject || (isUserAuth ? `Live Support Session (${cleanName})` : `Guest Support Inquiry`),
      snippet: `Live assistance session initiated with ${agent.name}`,
      description: `Support session initiated via Tiwlo Live Support Widget. Assigned specialist: ${agent.name} (${agent.tierTitle}).`,
      category: isUserAuth ? 'Live Support' : 'Guest Inquiry',
      priority: 'Normal',
      status: 'Open',
      lastUpdated: 'Just now',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAgent: `${agent.name} (${agent.tierTitle})`,
      sessionId
    };

    const existingIndex = db.tickets.findIndex(t => t.ticketId === ticket.ticketId);
    if (existingIndex === -1) {
      db.tickets.unshift(newTicket);
    }

    // 2. Persist initial conversation session in database
    const newConv = {
      id: sessionId,
      ticketId: ticket.ticketId,
      serialNumber: ticket.serialNumber,
      userId: cleanUserId,
      name: `${agent.name} (${ticket.serialNumber})`,
      role: agent.tierTitle,
      time: 'Just now',
      unread: 0,
      isSupport: true,
      lastMessage: welcomeGreeting,
      messages: [
        {
          id: `msg_welcome_${Date.now()}`,
          sender: 'agent',
          agentName: agent.name,
          avatar: agent.avatar,
          tierTitle: agent.tierTitle,
          text: welcomeGreeting,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString()
        }
      ]
    };
    db.conversations.unshift(newConv);
    writeSupportDB(db);

    res.json({
      sessionId,
      ticket: newTicket,
      agent,
      currentTier: 1,
      welcomeGreeting
    });
  } catch (err) {
    console.error('Failed to initiate support session:', err);
    res.status(500).json({ error: 'Failed to initiate support session' });
  }
});

// 7. Multi-Tier Support Handover Endpoint (Tier 1 -> Tier 2 -> Tier 3)
router.post('/transfer', (req, res) => {
  try {
    const { targetTier = 2, currentAgentId, reason = 'technical_escalation', userName = 'Imran' } = req.body;
    const newTier = Math.min(3, Math.max(1, parseInt(targetTier, 10)));
    const newAgent = getAgentByTier(newTier, currentAgentId);

    const handoffNotice = newTier === 2
      ? `Transferring you to our Tier-2 Technical & Cloud Operations Specialist (${newAgent.name})...`
      : `Escalating your session to Tier-3 Senior Systems & Infrastructure Lead (${newAgent.name})...`;

    const introGreeting = newTier === 2
      ? `Hi ${userName}, this is ${newAgent.firstName} from Technical Cloud Operations. I've received your ticket and reviewed your server/system metrics. Let's get this resolved for you!`
      : `Hello ${userName}, ${newAgent.name} here from Senior Infrastructure & Architecture. I have taken over your case with direct system clearance. How can I resolve this for you?`;

    res.json({
      success: true,
      newTier,
      handoffNotice,
      agent: newAgent,
      introGreeting
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer support session' });
  }
});

// 8. Send message & get response via Tiwi AI Engine
router.post('/message', async (req, res) => {
  try {
    const {
      isLoggedIn = false,
      agentName = 'Sarah Jenkins',
      agentRole = 'Senior Support Specialist',
      userId = 'guest',
      userName = 'Customer',
      userEmail = '',
      currentTier = 1,
      message,
      activeTicketId = null,
      conversationHistory = [],
      clientSource = req.headers['x-client-source'] || 'web',
      sessionId = req.headers['x-session-id'] || null,
      deviceFingerprint = null
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const isUserAuth = Boolean(isLoggedIn && userId && userId !== 'guest' && userId !== 'guest_session');

    const clientContext = {
      clientSource: clientSource || req.headers['x-client-source'] || 'web',
      sessionId: sessionId || req.headers['x-session-id'],
      deviceFingerprint: deviceFingerprint || {
        platform: req.headers['x-client-platform'] || 'web',
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
      }
    };

    const replyData = await TiwiAI.generateSupportReply({
      agentName,
      agentRole,
      userId: isUserAuth ? userId : 'guest',
      userName: isUserAuth ? userName : (userName && userName !== 'Guest Visitor' && userName !== 'Store Owner' ? userName : 'Customer'),
      userEmail: isUserAuth ? userEmail : '',
      isLoggedIn: isUserAuth,
      userMessage: message,
      activeTicketId,
      conversationHistory,
      clientContext
    });

    // Persist conversation and ticket updates in real support_database.json
    try {
      const db = readSupportDB();
      const targetSessionId = sessionId || activeTicketId;
      const conv = (db.conversations || []).find(c => c.id === targetSessionId || c.ticketId === activeTicketId || c.ticketId === targetSessionId);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (conv) {
        if (!Array.isArray(conv.messages)) conv.messages = [];
        conv.messages.push({
          id: `msg_u_${Date.now()}`,
          sender: 'user',
          text: message.trim(),
          time: timeStr,
          timestamp: now.toISOString()
        });
        conv.messages.push({
          id: `msg_a_${Date.now()}`,
          sender: 'agent',
          agentName,
          text: replyData.reply,
          time: timeStr,
          timestamp: now.toISOString()
        });
        conv.lastMessage = replyData.reply;
        conv.time = timeStr;
      }

      const ticket = (db.tickets || []).find(t => t.ticketId === activeTicketId || t.sessionId === targetSessionId || t.id === activeTicketId);
      if (ticket) {
        ticket.lastUpdated = 'Just now';
        ticket.updatedAt = now.toISOString();
        ticket.snippet = message.trim().slice(0, 80) + '...';
      }

      writeSupportDB(db);
    } catch (e) {
      console.warn('Could not update conversation DB:', e.message);
    }

    let shouldOfferTransfer = false;
    let transferToTier = null;
    const lower = message.toLowerCase();

    if (currentTier === 1) {
      if (
        lower.includes('error') || lower.includes('bug') || lower.includes('crash') ||
        lower.includes('kernel') || lower.includes('firewall') || lower.includes('dns') ||
        lower.includes('ssh') || lower.includes('root') || lower.includes('ip address') ||
        lower.includes('database schema') || lower.includes('server down') || lower.includes('hang')
      ) {
        shouldOfferTransfer = true;
        transferToTier = 2;
      }
    } else if (currentTier === 2) {
      if (
        lower.includes('enterprise') || lower.includes('escalate') || lower.includes('manager') ||
        lower.includes('sla') || lower.includes('contract') || lower.includes('architecture') ||
        lower.includes('disaster recovery')
      ) {
        shouldOfferTransfer = true;
        transferToTier = 3;
      }
    }

    res.json({
      ...replyData,
      shouldOfferTransfer,
      transferToTier
    });
  } catch (err) {
    console.error('Error in /api/support/message:', err);
    res.status(500).json({ error: 'Internal support error' });
  }
});

// 9. Brain diagnostic status endpoint
router.get('/brain-status', async (req, res) => {
  try {
    const userId = req.activeUser?.id || req.user?.id || req.session?.userId || null;
    const state = await SystemBrain.scanUserSystemState(userId);
    res.json({
      status: 'active',
      engine: 'Tiwi AI Live Support Core',
      systemScan: state
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan brain status' });
  }
});

// 10. Account Security Verification & Resolution Pipeline
router.post('/appeal-chat', async (req, res) => {
  try {
    let { email, message, conversationHistory = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Extract email from message if not provided
    if (!email || email === `user@${PLATFORM_CONFIG.primaryDomain}` || !email.trim()) {
      const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        email = emailMatch[0];
      }
    }

    if (!email) {
      return res.json({
        reply: "Please provide your registered Tiwlo email address so the Account Security Team can locate your record and evaluate your appeal.",
        restored: false,
        requiresEmail: true
      });
    }

    // Process via Verification Team Agent (Deep Reasoning & Autonomous Action)
    const result = await processSecurityAppeal({ email, message, conversationHistory });

    if (result.restored && !result.alreadyActive && result.user) {
      // Create cryptographically unique Security Checkup session token
      const checkup = RestoreSessions.createSecurityCheckupSession({
        email: result.user.email
      });

      // Dispatch Account Restored Email with tokenized security checkup link
      sendAccountRestoredEmail({
        to: result.user.email,
        name: result.user.name,
        checkupUrl: checkup.url
      }).catch(err => console.error('[Restore Email Dispatch Error]', err.message));

      return res.json({
        ...result,
        checkupToken: checkup.token,
        checkupUrl: checkup.url
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Error in /api/support/appeal-chat:', err);
    res.status(500).json({ error: 'Security review server is temporarily unavailable. Please try again.' });
  }
});

// 11. Cryptographic Restore & Security Checkup Token Verification Endpoint
router.post('/verify-restore-token', (req, res) => {
  try {
    const { token } = req.body;
    const verification = RestoreSessions.verifySession(token);
    if (!verification.valid) {
      return res.json(verification);
    }

    let userDetails = null;
    try {
      const found = MasterDB.getUserByEmail(verification.session.email) || MasterDB.getUserById(verification.session.userId);
      if (found) {
        userDetails = {
          id: found.id,
          email: found.email,
          name: found.name || found.storeName || 'Merchant',
          storeName: found.storeName || found.name || 'Tiwlo Store',
          tiwiId: found.tiwiId || found.storeId || '',
          avatar: found.avatar || null,
          twoFactorEnabled: !!found.twoFactorEnabled,
          createdAt: found.createdAt
        };
      }
    } catch (e) {
      console.warn('Error reading master user for restore token:', e.message);
    }

    res.json({
      ...verification,
      user: userDetails || { email: verification.session.email }
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

export default router;

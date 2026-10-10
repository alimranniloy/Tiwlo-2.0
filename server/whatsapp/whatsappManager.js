import crypto from 'crypto';
import { default as makeWASocket, DisconnectReason, initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { TenantDB } from '../db/multiTenant.js';
import { getPlatformUrl } from '../config/platformConfig.js';
import { queryPg } from '../db/postgres.js';
import { readState, saveState } from '../db/stateDocuments.js';
// In-memory active sockets Map: sessionId -> { sock, qr, qrDataUrl, status, ... }
const activeSockets = new Map();

const readMeta = () => readState('whatsapp', 'sessions', { sessions: [] });
const writeMeta = data => saveState('whatsapp', 'sessions', data);

export async function createPostgresAuthState(sessionId) {
  const keyPrefix = `${sessionId}:`;
  const load = async key => {
    const { rows } = await queryPg('SELECT data FROM whatsapp_auth_state WHERE state_key = $1', [`${keyPrefix}${key}`]);
    return rows[0] ? JSON.parse(JSON.stringify(rows[0].data), BufferJSON.reviver) : null;
  };
  const save = async (key, value) => {
    if (value === null || value === undefined) {
      await queryPg('DELETE FROM whatsapp_auth_state WHERE state_key = $1', [`${keyPrefix}${key}`]);
      return;
    }
    const data = JSON.stringify(value, BufferJSON.replacer);
    await queryPg(`INSERT INTO whatsapp_auth_state(state_key, data) VALUES ($1, $2::jsonb)
      ON CONFLICT (state_key) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`, [`${keyPrefix}${key}`, data]);
  };
  const creds = await load('creds') || initAuthCreds();
  return {
    state: {
      creds,
      keys: {
        async get(type, ids) {
          const entries = await Promise.all(ids.map(async id => [id, await load(`${type}:${id}`)]));
          return Object.fromEntries(entries.filter(([, value]) => value !== null).map(([id, value]) => [
            id, type === 'app-state-sync-key' ? proto.Message.AppStateSyncKeyData.fromObject(value) : value
          ]));
        },
        async set(data) {
          const writes = [];
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, value] of Object.entries(entries)) writes.push(save(`${type}:${id}`, value));
          }
          await Promise.all(writes);
        }
      }
    },
    saveCreds: () => save('creds', creds)
  };
}

// Gemini AI Call for WhatsApp Auto-Replies
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-lite-latest'
];

async function callGeminiAi({ systemInstruction, userMessage, conversationHistory = [] }) {
  const contents = [];
  
  // Append recent history if any
  for (const h of conversationHistory.slice(-6)) {
    if (h.direction === 'inbound') {
      contents.push({ role: 'user', parts: [{ text: h.text }] });
    } else if (h.direction === 'outbound') {
      contents.push({ role: 'model', parts: [{ text: h.text }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
      topP: 0.95
    }
  };

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    } catch (err) {
      // Try next model
    }
  }

  // Fallback if AI call failed
  return null;
}

// WhatsApp Manager Class
export const WhatsAppManager = {
  // Initialize and auto-resume existing sessions on server boot
  async init() {
    console.log('[WhatsAppManager] Initializing WhatsApp session engine...');
    const meta = await readMeta();
    for (const sess of meta.sessions) {
      if (sess.status === 'CONNECTED' || sess.status === 'CONNECTING') {
        const credentials = await queryPg('SELECT 1 FROM whatsapp_auth_state WHERE state_key = $1', [`${sess.sessionId}:creds`]);
        if (credentials.rowCount) {
          console.log(`[WhatsAppManager] Auto-resuming session ${sess.sessionId} (${sess.sessionName || 'Default'})...`);
          this.startSocket(sess.sessionId).catch(e => console.warn(`Failed to auto-resume ${sess.sessionId}:`, e.message));
        } else {
          sess.status = 'DISCONNECTED';
        }
      }
    }
    await writeMeta(meta);
  },

  // Create new session
  async createSession({ userId, storeId = '', sessionName = 'Primary WhatsApp Store' }) {
    if (!userId) throw new Error('Authenticated user ID is required');
    const sessionId = `wa_sess_${crypto.randomBytes(6).toString('hex')}`;
    // Try to auto-populate store knowledge from TenantDB
    let initialKnowledge = null;
    try {
      const storeDb = (await TenantDB.getStoreDb(storeId));
      if (storeDb) {
        initialKnowledge = {
          storeName: storeDb.store_settings?.storeName || sessionName,
          tiwiId: storeId,
          currency: storeDb.store_settings?.currency || 'BDT',
          productCount: (storeDb.products || []).length,
          products: (storeDb.products || []).slice(0, 50).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock ?? p.quantity ?? 10,
            category: p.category || 'General',
            description: p.description || ''
          })),
          syncedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('[WhatsAppManager] Initial store db lookup error:', err.message);
    }

    const sessionObj = {
      sessionId,
      userId,
      storeId,
      sessionName,
      phoneNumber: null,
      pushName: null,
      status: 'INITIALIZING',
      qrCodeDataUrl: null,
      createdAt: new Date().toISOString(),
      connectedAt: null,
      lastActive: new Date().toISOString(),
      automationConfig: {
        enabled: true,
        preset: 'sales', // 'sales' | 'support' | 'leads' | 'custom'
        storeUrl: '',
        customPrompt: '',
        responseDelayMs: 1500,
        enableBengali: true,
        businessHours: '24/7'
      },
      storeKnowledge: null,
      stats: {
        messagesReceived: 0,
        messagesSent: 0,
        aiRepliesSent: 0
      },
      messageLogs: []
    };

    const meta = await readMeta();
    meta.sessions.unshift(sessionObj);
    await writeMeta(meta);

    // Start Baileys socket for this session
    await this.startSocket(sessionId);

    // Await first QR code so client gets the image instantly upon response (~1 sec)
    const startT = Date.now();
    while (Date.now() - startT < 3500) {
      const active = activeSockets.get(sessionId);
      if (active?.qrDataUrl) {
        sessionObj.qrCodeDataUrl = active.qrDataUrl;
        sessionObj.status = 'SCAN_QR';
        break;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return sessionObj;
  },

  // Regenerate / Refresh QR Code for an existing session
  async regenerateQr(sessionId) {
    const meta = await readMeta();
    const session = meta.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error('Session not found');

    const active = activeSockets.get(sessionId);
    if (active?.sock) {
      try { active.sock.end(); } catch (_) {}
      activeSockets.delete(sessionId);
    }

    await queryPg('DELETE FROM whatsapp_auth_state WHERE state_key LIKE $1', [`${sessionId}:%`]);

    session.status = 'INITIALIZING';
    session.qrCodeDataUrl = null;
    session.phoneNumber = null;
    await writeMeta(meta);

    await this.startSocket(sessionId);

    const startT = Date.now();
    while (Date.now() - startT < 4000) {
      const act = activeSockets.get(sessionId);
      if (act?.qrDataUrl) {
        session.qrCodeDataUrl = act.qrDataUrl;
        session.status = 'SCAN_QR';
        await writeMeta(meta);
        break;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return session;
  },

  // Start or restart a Baileys socket
  async startSocket(sessionId) {
    const { state, saveCreds } = await createPostgresAuthState(sessionId);

    const sock = makeWASocket({
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      browser: ['Tiwlo Cloud', 'Chrome', '124.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    const activeObj = {
      sock,
      sessionId,
      qrRaw: null,
      qrDataUrl: null
    };
    activeSockets.set(sessionId, activeObj);

    // Event: credentials update
    sock.ev.on('creds.update', saveCreds);

    // Event: connection update (QR generation & connection state)
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const meta = (await readMeta());
      const session = meta.sessions.find(s => s.sessionId === sessionId);
      if (!session) return;

      if (qr) {
        activeObj.qrRaw = qr;
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 8,
            color: { dark: '#1f1f1f', light: '#ffffff' }
          });
          activeObj.qrDataUrl = qrDataUrl;
          session.qrCodeDataUrl = qrDataUrl;
          session.status = 'SCAN_QR';
          session.lastActive = new Date().toISOString();
          (await writeMeta(meta));
          console.log(`[WhatsAppManager] New QR Code generated for session: ${sessionId}`);
        } catch (err) {
          console.error('[WhatsAppManager] QRCode generation error:', err);
        }
      }

      if (connection === 'open') {
        activeObj.qrRaw = null;
        activeObj.qrDataUrl = null;
        session.qrCodeDataUrl = null;
        session.status = 'CONNECTED';
        session.connectedAt = new Date().toISOString();
        session.lastActive = new Date().toISOString();
        
        const rawPhone = sock.user?.id || '';
        session.phoneNumber = rawPhone.split(':')[0] || rawPhone.split('@')[0] || '';
        session.pushName = sock.user?.name || 'Tiwlo WhatsApp Business';
        
        (await writeMeta(meta));
        console.log(`[WhatsAppManager] Session ${sessionId} connected successfully! Phone: ${session.phoneNumber}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`[WhatsAppManager] Connection closed for ${sessionId}. Code: ${statusCode}, LoggedOut: ${isLoggedOut}`);

        if (isLoggedOut) {
          session.status = 'DISCONNECTED';
          session.qrCodeDataUrl = null;
          (await writeMeta(meta));
          activeSockets.delete(sessionId);
          // Clean up auth directory upon explicit logout
          try {
            await queryPg('DELETE FROM whatsapp_auth_state WHERE state_key LIKE $1', [`${sessionId}:%`]);
          } catch (e) {}
        } else {
          session.status = 'RECONNECTING';
          (await writeMeta(meta));
          // Reconnect automatically if network dropped
          setTimeout(async () => {
            const currentSession = (await readMeta()).sessions.find(s => s.sessionId === sessionId);
            if (currentSession && currentSession.status !== 'DISCONNECTED') {
              this.startSocket(sessionId).catch(e => console.warn(`Reconnect failed for ${sessionId}:`, e.message));
            }
          }, 3000);
        }
      }
    });

    // Event: incoming messages (Trigger AI auto-reply)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const remoteJid = msg.key.remoteJid;
        // Ignore WhatsApp status broadcasts and group messages by default
        if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

        const text = msg.message.conversation ||
                     msg.message.extendedTextMessage?.text ||
                     msg.message.imageMessage?.caption ||
                     '';
        if (!text.trim()) continue;

        const meta = (await readMeta());
        const session = meta.sessions.find(s => s.sessionId === sessionId);
        if (!session) continue;

        const customerPhone = remoteJid.replace('@s.whatsapp.net', '');
        const customerName = msg.pushName || 'Customer';

        // 1. Record inbound message in session logs
        session.stats.messagesReceived = (session.stats.messagesReceived || 0) + 1;
        session.lastActive = new Date().toISOString();
        session.messageLogs = session.messageLogs || [];
        session.messageLogs.push({
          id: msg.key.id || `in_${Date.now()}`,
          direction: 'inbound',
          from: customerPhone,
          senderName: customerName,
          text: text.trim(),
          timestamp: new Date().toISOString()
        });
        if (session.messageLogs.length > 50) session.messageLogs.shift();
        (await writeMeta(meta));

        // 2. Check if AI auto-reply is enabled
        if (!session.automationConfig?.enabled) continue;

        try {
          // Build system prompt based on persona and synced store knowledge
          const systemInstruction = this.buildPrompt({
            preset: session.automationConfig.preset,
            customPrompt: session.automationConfig.customPrompt,
            storeKnowledge: session.storeKnowledge,
            sessionName: session.sessionName
          });

          // Generate AI reply using Gemini
          const aiReply = await callGeminiAi({
            systemInstruction,
            userMessage: text.trim(),
            conversationHistory: session.messageLogs
          });

          if (aiReply) {
            const delay = session.automationConfig.responseDelayMs || 1500;
            await new Promise(r => setTimeout(r, delay));

            // Send reply via Baileys socket
            await sock.sendMessage(remoteJid, { text: aiReply });

            // Record outbound AI reply in logs
            const updatedMeta = (await readMeta());
            const currentSess = updatedMeta.sessions.find(s => s.sessionId === sessionId);
            if (currentSess) {
              currentSess.stats.messagesSent = (currentSess.stats.messagesSent || 0) + 1;
              currentSess.stats.aiRepliesSent = (currentSess.stats.aiRepliesSent || 0) + 1;
              currentSess.messageLogs.push({
                id: `ai_${Date.now()}`,
                direction: 'outbound',
                to: customerPhone,
                text: aiReply,
                isAiReply: true,
                timestamp: new Date().toISOString()
              });
              if (currentSess.messageLogs.length > 50) currentSess.messageLogs.shift();
              (await writeMeta(updatedMeta));
            }
          }
        } catch (aiErr) {
          console.error(`[WhatsAppManager] Error executing AI reply for ${sessionId}:`, aiErr.message);
        }
      }
    });

    return sock;
  },

  // Build high-converting system prompt for AI auto-reply
  buildPrompt({ preset = 'sales', customPrompt = '', storeKnowledge = null, sessionName = 'Store' }) {
    const storeName = storeKnowledge?.storeName || sessionName;
    const currency = storeKnowledge?.currency || 'BDT';
    const productsList = (storeKnowledge?.products || [])
      .slice(0, 30)
      .map(p => `• ${p.name} — ${p.price} ${currency} (Stock: ${p.stock > 0 ? 'In Stock' : 'Out of Stock'}) ${p.description ? `[${p.description}]` : ''}`)
      .join('\n');

    let basePersona = '';
    switch (preset) {
      case 'sales':
        basePersona = `You are the lead AI Sales & Order Specialist for "${storeName}". Your goal is to guide customers politely, recommend the best products, answer price and stock questions, calculate order totals, and encourage smooth checkout.`;
        break;
      case 'support':
        basePersona = `You are the Customer Support Concierge for "${storeName}". You help customers track orders, answer questions about delivery timelines, returns, warranty, and store policies with maximum empathy and clarity.`;
        break;
      case 'leads':
        basePersona = `You are the Business Development & Inquiry Specialist for "${storeName}". You warmly greet prospective clients, understand their project or purchase requirements, answer preliminary questions, and collect their contact details.`;
        break;
      case 'custom':
        basePersona = customPrompt || `You are an AI assistant representing "${storeName}".`;
        break;
      default:
        basePersona = `You are the AI assistant for "${storeName}". Help customers enthusiastically and accurately.`;
    }

    return `
${basePersona}

CRITICAL RULES:
1. Speak naturally, warmly, and politely. Never say you are an LLM or ChatGPT. You are an official representative of ${storeName}.
2. Language: If the user messages in Bengali, reply naturally and respectfully in Bengali (e.g., "ধন্যবাদ! আমাদের স্টোরে আপনাকে স্বাগতম..."). If in English, reply in English.
3. Keep WhatsApp messages concise, clear, and formatted nicely (use emojis naturally, bullet points, bold key terms like *Price*).
4. Store merchandise & inventory knowledge:
${productsList ? `CURRENT STORE CATALOG:\n${productsList}` : 'Standard store catalog available.'}
${storeKnowledge?.storeUrl ? `STOREFRONT URL / DOMAIN:\n${storeKnowledge.storeUrl}` : ''}
${storeKnowledge?.customPages?.length > 0 ? `ADDITIONAL STORE PAGES & POLICIES:\n${storeKnowledge.customPages.map(p => `• ${p.title || 'Page'}: ${p.url || ''} ${p.content ? `— ${p.content}` : ''}`).join('\n')}` : ''}
${storeKnowledge?.customKnowledge ? `STORE KNOWLEDGE BASE & FAQS:\n${storeKnowledge.customKnowledge}` : ''}

5. When a customer decides to buy or asks how to order, provide their total and invite them to confirm their delivery address and phone number or visit the online store.
`.trim();
  },

  // List all sessions for a user
  async listSessions(userId = null) {
    const meta = (await readMeta());
    let list = meta.sessions || [];
    if (userId && userId !== 'all') {
      list = list.filter(s => s.userId === userId);
    }

    // Attach runtime live QR data if active
    return list.map(sess => {
      const active = activeSockets.get(sess.sessionId);
      return {
        ...sess,
        qrCodeDataUrl: active?.qrDataUrl || sess.qrCodeDataUrl,
        isSocketLive: Boolean(active?.sock)
      };
    });
  },

  // Get single session details
  async getSession(sessionId) {
    const meta = (await readMeta());
    const sess = meta.sessions.find(s => s.sessionId === sessionId);
    if (!sess) return null;
    const active = activeSockets.get(sessionId);
    return {
      ...sess,
      qrCodeDataUrl: active?.qrDataUrl || sess.qrCodeDataUrl,
      isSocketLive: Boolean(active?.sock)
    };
  },

  // Update automation configuration
  async updateAutomationConfig(sessionId, newConfig) {
    const meta = (await readMeta());
    const session = meta.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error('Session not found');

    session.automationConfig = {
      ...session.automationConfig,
      ...newConfig
    };
    session.lastActive = new Date().toISOString();
    (await writeMeta(meta));
    return session;
  },

  // Sync store catalog & domain pages into session knowledge
  async syncStoreData(sessionId, options = {}) {
    const meta = (await readMeta());
    const session = meta.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error('Session not found');

    const opts = typeof options === 'string'
      ? { storeId: options, storeType: options.startsWith('http') ? 'custom_domain' : 'registered', storeUrl: options.startsWith('http') ? options : '' }
      : options;

    const {
      storeType = 'registered',
      storeId = session.storeId || '',
      storeUrl = '',
      customPages = [],
      customKnowledge = ''
    } = opts;

    let storeName = session.sessionName;
    let currency = 'BDT';
    let products = [];

    if (storeType === 'registered' || (storeId && storeId.startsWith('TIW-'))) {
      const storeDb = (await TenantDB.getStoreDb(storeId));
      const storeSettings = storeDb?.store_settings || {};
      storeName = storeSettings.storeName || session.sessionName;
      currency = storeSettings.currency || 'BDT';
      products = (storeDb?.products || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock ?? p.quantity ?? 10,
        category: p.category || 'General',
        description: p.description || ''
      }));
    }

    session.storeKnowledge = {
      storeType,
      storeName,
      tiwiId: storeId,
      storeUrl: storeUrl || (storeType === 'registered' ? getPlatformUrl(`store/${storeId}`) : ''),
      currency,
      productCount: products.length,
      products,
      customPages: Array.isArray(customPages) ? customPages : [],
      customKnowledge: typeof customKnowledge === 'string' ? customKnowledge : '',
      syncedAt: new Date().toISOString()
    };

    session.lastActive = new Date().toISOString();
    (await writeMeta(meta));
    return session.storeKnowledge;
  },

  // Test AI auto-reply simulation without sending actual WhatsApp message
  async testAiResponse(sessionId, testMessage) {
    const session = (await this.getSession(sessionId));
    if (!session) throw new Error('Session not found');

    const systemInstruction = this.buildPrompt({
      preset: session.automationConfig?.preset || 'sales',
      customPrompt: session.automationConfig?.customPrompt || '',
      storeKnowledge: session.storeKnowledge,
      sessionName: session.sessionName
    });

    const reply = await callGeminiAi({
      systemInstruction,
      userMessage: testMessage,
      conversationHistory: []
    });

    return {
      testMessage,
      reply: reply || `Hello! Thank you for contacting ${session.sessionName}. How can I assist you with your purchase today?`,
      timestamp: new Date().toISOString(),
      presetUsed: session.automationConfig?.preset || 'sales',
      productsInContext: session.storeKnowledge?.productCount || 0
    };
  },

  // Disconnect / Logout session
  async disconnectSession(sessionId) {
    const meta = await readMeta();
    const session = meta.sessions.find(s => s.sessionId === sessionId);
    if (!session) throw new Error('Session not found');

    const active = activeSockets.get(sessionId);
    if (active?.sock) {
      try {
        await active.sock.logout();
      } catch (e) {
        try { active.sock.end(); } catch (_) {}
      }
      activeSockets.delete(sessionId);
    }

    session.status = 'DISCONNECTED';
    session.qrCodeDataUrl = null;
    session.phoneNumber = null;
    session.lastActive = new Date().toISOString();
    await writeMeta(meta);
    await queryPg('DELETE FROM whatsapp_auth_state WHERE state_key LIKE $1', [`${sessionId}:%`]);

    return session;
  },

  // Delete session entirely
  async deleteSession(sessionId) {
    await this.disconnectSession(sessionId);
    const meta = await readMeta();
    meta.sessions = meta.sessions.filter(s => s.sessionId !== sessionId);
    await writeMeta(meta);

    return { success: true, sessionId };
  }
};

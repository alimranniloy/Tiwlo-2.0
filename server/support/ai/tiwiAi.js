import { SystemBrain } from './brain.js';
import { AiActionsEngine } from './aiActions.js';
import { executeGeminiWithFailover, getChatSystemSettings } from './aiKeyPoolService.js';
import { getPlatformUrl } from '../../config/platformConfig.js';

// ====================================================================
// TIWI AI API ENGINE (POWERED INTERNALLY BY GEMINI KEY POOL FAILOVER)
// With Autonomous Action Execution & Dual-Brain Intelligence
// ====================================================================

function sanitizeAiPromptInput(rawText, maxLen = 2500) {
  return String(rawText ?? '')
    .replace(/\u0000/g, '')
    .replace(/<\|[^|]{1,40}\|>/g, ' ')
    .replace(/<\/?(?:system|assistant|developer|tool_call|tool_response)>/gi, ' ')
    .replace(/(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+instructions?/gi, '[filtered-instruction]')
    .trim()
    .slice(0, maxLen);
}

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
        reply: `Hello ${userName || 'there'}! How can I help you with Tiwlo Cloud, Droplets, Domains, or Billing today?`,
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
      const cleanUserMessage = sanitizeAiPromptInput(userMessage, 2500);
      const systemInstruction = await SystemBrain.buildAgentSystemPrompt(
        agentName,
        agentRole,
        userId,
        userName,
        cleanUserMessage,
        clientContext,
        isLoggedIn
      );

      // 2. Format conversation history for Gemini API
      const contents = [];

      // Add previous conversation messages if any (limit to last 6 for prompt efficiency)
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        const msgText = sanitizeAiPromptInput(msg?.text ?? msg?.parts?.[0]?.text ?? '', 1800);
        if (!msgText) continue;
        if (msg.sender === 'user' || msg.role === 'user') {
          contents.push({ role: 'user', parts: [{ text: msgText }] });
        } else if (msg.sender === 'agent' || msg.role === 'model') {
          contents.push({ role: 'model', parts: [{ text: msgText }] });
        }
      }

      // Add the current user query
      contents.push({ role: 'user', parts: [{ text: cleanUserMessage }] });

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
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('TiwiAI engine error:', err);
      return {
        reply: this.generateLocalFallback(userMessage, agentName),
        agent: agentName,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Detect if a user query is written in Bengali (Unicode Bangla or common Banglish)
   */
  isBengaliQuery(query = '') {
    const raw = String(query || '');
    if (/[\u0980-\u09FF]/.test(raw)) return true;
    const lower = raw.toLowerCase();
    return /\b(bangla|bengali|kivabe|kibhabe|korbo|korte|chai|sahajjo|taka|kemne|kothay|amar|amader|notun|server\s*banabo|droplet\s*banabo)\b/i.test(lower);
  },

  /**
   * Graceful bilingual (Bengali + English) contextual fallback with clickable routing links
   */
  generateLocalFallback(query, agentName = 'Tiwi Support AI') {
    const raw = String(query || '');
    const q = raw.toLowerCase();
    const isBn = this.isBengaliQuery(raw);

    const asksDeployDroplet =
      /(create|deploy|launch|new|custom|customize|setup|install|make|build|spin up).*(droplet|vps|server|ubuntu|linux)|(droplet|vps|server).*(create|deploy|launch|custom|customize|setup|install|banabo|tairi|তৈরি|ডিপ্লয়|ডিপ্লয়|কাস্টমাইজ|নতুন|চালু)|নতুন\s*(ড্রপলেট|ভিপিএস|সার্ভার)|(ড্রপলেট|ভিপিএস|সার্ভার)\s*(তৈরি|ডিপ্লয়|ডিপ্লয়|কাস্টমাইজ)/.test(q) ||
      q.includes('/cloud/create-droplet');

    const asksManageVps =
      /(manage|ipv6|ssh|browser ssh|terminal|console|firewall|port|cpu|chart|graph|metric|reboot|restart|power|lifetime|তদারকি|ম্যানেজ|আইপিভি৬|এসএসএইচ|টার্মিনাল|কনসোল|ফায়ারওয়াল|ফায়ারওয়াল|সিপইউ|চার্ট|গ্রাফ|রিবুট|পাওয়ার|পাওয়ার|রিস্টার্ট)/.test(q) ||
      q.includes('/cloud/droplets');

    const asksDomainSsl =
      /(domain|dns|nameserver|name server|dns1|dns2|ssl|https|tls|certbot|let'?s encrypt|cname|a record|aaaa|connect.*vps|ডোমেইন|ডিএনএস|নেমসার্ভার|এসএসএল|সার্টিফিকেট|যুক্ত|কানেক্ট)/.test(q) ||
      q.includes('/domains');

    const asksBilling =
      /(billing|bill|invoice|wallet|top-?up|topup|credit|payment|monthly|charge|pay|রিচার্জ|বিল|বিলিং|ইনভয়েস|ইনভয়েস|ওয়ালেট|ওয়ালেট|টপ-?আপ|টপআপ|ক্রেডিট|পেমেন্ট|মাসিক)/.test(q) ||
      q.includes('/billing');

    const asksInfraFeatures =
      /(image|images|snapshot|snapshots|backup|backups|volume|volumes|kubernetes|k8s|cluster|storage|ইমেজ|স্ন্যাপশট|ব্যাকআপ|ভলিউম|কুবারনেটিস)/.test(q);

    const asksTpanel =
      /(tpanel|file manager|ফাইল ম্যানেজার|টিপ্যানেল)/.test(q);

    if (asksTpanel) {
      return isBn
        ? [
            `**TPanel Control Panel** এবং **File Manager** বর্তমানে নিরাপত্তার কারণে নিষ্ক্রিয় (disabled / unavailable) রয়েছে।`,
            `- আপনার VPS সার্ভার পরিচালনা ও ফাইল অ্যাক্সেসের জন্য [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) পেজ থেকে সরাসরি **Browser SSH** ও **Cloud Firewall** ব্যবহার করুন।`,
          ].join('\n')
        : [
            `**TPanel Control Panel** and **File Manager** are currently disabled / unavailable.`,
            `- Please manage your VPS instances, **Browser SSH** terminal, IPv6, and **Cloud Firewall** directly from [My Droplets](/cloud/droplets) (\`/cloud/droplets\`).`,
          ].join('\n');
    }

    if (asksDeployDroplet) {
      return isBn
        ? [
            `**নতুন Droplet VPS তৈরি ও কাস্টমাইজ করার ধাপসমূহ:**`,
            `- ১. [Create Droplet](/cloud/create-droplet) (\`/cloud/create-droplet\`) পেজে যান।`,
            `- ২. আপনার পছন্দের **OS Image** (যেমন \`Ubuntu 24.04 LTS\`) ও **Region** নির্বাচন করুন।`,
            `- ৩. প্রয়োজন অনুযায়ী **vCPU, RAM এবং NVMe Storage** প্ল্যান বেছে নিন বা কাস্টমাইজ করুন।`,
            `- ৪. **Hostname**, **SSH Key / রুট পাসওয়ার্ড** এবং প্রয়োজনে **IPv6** সেট করুন।`,
            `- ৫. **Create Droplet** বাটনে ক্লিক করুন — কয়েক সেকেন্ডেই আপনার VPS তৈরি হয়ে যাবে! পরবর্তীতে [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) থেকে সার্ভারটি ম্যানেজ করতে পারবেন।`,
          ].join('\n')
        : [
            `**Step-by-Step Guide to Deploy & Customize a Droplet VPS:**`,
            `- 1. Open [Create Droplet](/cloud/create-droplet) (\`/cloud/create-droplet\`).`,
            `- 2. Choose your **OS Image** (such as \`Ubuntu 24.04 LTS\`) and nearest **Datacenter Region**.`,
            `- 3. Pick or customize your **vCPU, RAM, and NVMe SSD** tier.`,
            `- 4. Configure your **Hostname**, **SSH Key / root password**, and optional **IPv6** networking.`,
            `- 5. Click **Create Droplet** to provision your VPS in seconds, then manage it from [My Droplets](/cloud/droplets) (\`/cloud/droplets\`).`,
          ].join('\n');
    }

    if (asksDomainSsl) {
      return isBn
        ? [
            `**কাস্টম ডোমেইন, Nameserver, VPS কানেকশন ও Self-Managed SSL সেটআপ:**`,
            `- ১. [Domains & DNS](/domains) (\`/domains\`) পেজে গিয়ে আপনার কাস্টম ডোমেইন যোগ করুন।`,
            `- ২. আপনার ডোমেইন রেজিস্ট্রারের প্যানেলে Nameserver হিসেবে **\`dns1.tiwlo.com\`** ও **\`dns2.tiwlo.com\`** সেট করুন।`,
            `- ৩. ডোমেইনটি VPS-এর সাথে যুক্ত করতে \`A\` রেকর্ডে আপনার Droplet-এর **IPv4** (এবং IPv6 থাকলে \`AAAA\` রেকর্ডে **IPv6**) বসান।`,
            `- ৪. **Self-Managed VPS SSL** সেটআপ করতে DNS প্রোপাগেট হওয়ার পর [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) থেকে **Browser SSH** ওপেন করে \`sudo certbot --nginx -d yourdomain.com\` (Let's Encrypt) রান করুন।`,
          ].join('\n')
        : [
            `**Custom Domain, Tiwlo Nameservers, VPS Connection & Self-Managed SSL Guide:**`,
            `- 1. Open [Domains & DNS](/domains) (\`/domains\`) and add your custom domain.`,
            `- 2. Update your domain registrar nameservers to **\`dns1.tiwlo.com\`** and **\`dns2.tiwlo.com\`**.`,
            `- 3. Point an \`A\` record to your Droplet's public **IPv4** (and an \`AAAA\` record for **IPv6** if enabled) to connect your domain to your VPS.`,
            `- 4. For **self-managed VPS SSL**, once DNS propagates, open **Browser SSH** in [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) and run \`sudo certbot --nginx -d yourdomain.com\` (Let's Encrypt).`,
          ].join('\n');
    }

    if (asksManageVps) {
      return isBn
        ? [
            `**VPS ম্যানেজমেন্ট (IPv6, Browser SSH, Firewall ও Lifetime CPU Charts):**`,
            `- ১. [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) পেজে যান এবং আপনার Droplet-এ ক্লিক করুন।`,
            `- ২. **Overview** ট্যাবে **Lifetime CPU, Memory ও Network Charts** এবং পাওয়ার কন্ট্রোল (Reboot/Power Off/On) পাবেন।`,
            `- ৩. সরাসরি টার্মিনাল অ্যাক্সেসের জন্য **Browser SSH** চালু করুন।`,
            `- ৪. **Network & Firewall** সেকশনে **IPv4 / IPv6** এবং ইনবাউন্ড/আউটবাউন্ড **Cloud Firewall** রুলস (Port 22, 80, 443) কনফিগার করতে পারবেন।`,
          ].join('\n')
        : [
            `**Managing Your VPS (IPv6, Browser SSH, Firewall & Lifetime CPU Charts):**`,
            `- 1. Open [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) and select your VPS instance.`,
            `- 2. Inspect **Lifetime CPU, RAM & Network Charts** and power controls (Power On/Off, Reboot, Rename).`,
            `- 3. Launch **Browser SSH** directly in your browser without external SSH clients.`,
            `- 4. Configure **IPv4 / IPv6** addresses and **Cloud Firewall** port rules (SSH 22, HTTP 80, HTTPS 443) under the Network tab.`,
          ].join('\n');
    }

    if (asksBilling) {
      return isBn
        ? [
            `**মাসিক VPS বিলিং, Cloud Wallet Top-Up ও ইনভয়েস:**`,
            `- আপনার সকল মাসিক VPS চার্জ, ওয়ালেট ব্যালেন্স এবং ইনভয়েস দেখতে [Cloud Billing & Wallet](/billing) (\`/billing\`) পেজে যান।`,
            `- এখান থেকে আপনি **Wallet Top-Up (ক্রেডিট যোগ)** করতে, অটো-রিনিউয়াল দেখতে এবং প্রতিটি বিলিং সাইকেলের **Invoice** ডাউনলোড করতে পারবেন।`,
          ].join('\n')
        : [
            `**Monthly VPS Billing, Cloud Wallet Top-Up & Invoices:**`,
            `- Open [Cloud Billing & Wallet](/billing) (\`/billing\`) to review monthly VPS billing, top up your Cloud Wallet credits, manage payment methods, and download invoices.`,
          ].join('\n');
    }

    if (asksInfraFeatures) {
      return isBn
        ? [
            `**Tiwlo Cloud স্টোরেজ ও ইনফ্রাস্ট্রাকচার ফিচারসমূহ:**`,
            `- **Images** ([/cloud/images](/cloud/images)): নতুন ড্রপলেট ডিপ্লয় করার জন্য প্রস্তুত Linux OS (যেমন Ubuntu 24.04 LTS) ও টেমপ্লেট।`,
            `- **Snapshots** ([/cloud/snapshots](/cloud/snapshots)): যেকোনো সময় আপনার VPS ডিস্কের তাৎক্ষণিক পয়েন্ট-ইন-টাইম কপি নেওয়ার সুবিধা (আপডেট বা মাইগ্রেশনের আগে দারুণ উপযোগী)।`,
            `- **Backups** ([/cloud/backups](/cloud/backups)): নির্ধারিত সময় পরপর স্বয়ংক্রিয় ডিস্ক ব্যাকআপ, যা দ্রুত রিস্টোর করতে সাহায্য করে।`,
            `- **Volumes** ([/cloud/volumes](/cloud/volumes)): অতিরিক্ত হাই-স্পিড NVMe ব্লক স্টোরেজ ডিস্ক, যা Droplet-এ যুক্ত ও রিসাইজ করা যায়।`,
            `- **Kubernetes** ([/cloud/kubernetes](/cloud/kubernetes)): কন্টেইনারাইজড অ্যাপ অটো-স্কেলিং ও অর্কেস্ট্রেশনের জন্য ম্যানেজড ক্লাস্টার।`,
          ].join('\n')
        : [
            `**Tiwlo Cloud Storage & Infrastructure Features:**`,
            `- **Images** ([/cloud/images](/cloud/images)): Curated OS distributions (like Ubuntu 24.04 LTS) used as base templates when deploying Droplets.`,
            `- **Snapshots** ([/cloud/snapshots](/cloud/snapshots)): On-demand point-in-time disk captures of a Droplet before upgrades or cloning.`,
            `- **Backups** ([/cloud/backups](/cloud/backups)): Scheduled automated backups for disaster recovery and quick rollback.`,
            `- **Volumes** ([/cloud/volumes](/cloud/volumes)): Attachable, resizable NVMe block storage disks independent of your Droplet's boot disk.`,
            `- **Kubernetes** ([/cloud/kubernetes](/cloud/kubernetes)): Managed container orchestration clusters for scaling containerized workloads.`,
          ].join('\n');
    }

    if (/\b(hi|hello|hey)\b|হ্যালো|হাই|সালাম|কেমন/.test(q)) {
      return isBn
        ? `হ্যালো! আমি ${agentName}, Tiwlo সাপোর্ট টিম থেকে বলছি। Droplet তৈরি ([/cloud/create-droplet](/cloud/create-droplet)), VPS ম্যানেজমেন্ট ([/cloud/droplets](/cloud/droplets)), কাস্টম ডোমেইন ([/domains](/domains)), বা বিলিং ([/billing](/billing)) — কোন বিষয়ে সাহায্য করতে পারি?`
        : `Hello! I'm ${agentName} from Tiwlo Live Support. How can I help you today with deploying Droplets ([/cloud/create-droplet](/cloud/create-droplet)), managing VPS ([/cloud/droplets](/cloud/droplets)), custom Domains ([/domains](/domains)), or Billing ([/billing](/billing))?`;
    }

    if (q.includes('droplet') || q.includes('server') || q.includes('ড্রপলেট') || q.includes('সার্ভার')) {
      return isBn
        ? `আপনি [Create Droplet](/cloud/create-droplet) (\`/cloud/create-droplet\`) থেকে নতুন VPS তৈরি করতে পারেন এবং [My Droplets](/cloud/droplets) (\`/cloud/droplets\`) থেকে Browser SSH, IPv6, Firewall ও Lifetime CPU চার্ট পরিচালনা করতে পারেন।`
        : `You can deploy a new VPS at [Create Droplet](/cloud/create-droplet) (\`/cloud/create-droplet\`) and manage Browser SSH, IPv6, Cloud Firewall, and Lifetime CPU charts in [My Droplets](/cloud/droplets) (\`/cloud/droplets\`).`;
    }

    if (q.includes('store') || q.includes('shop') || q.includes('স্টোর') || q.includes('দোকান')) {
      return isBn
        ? `আপনার অনলাইন স্টোরগুলো [Online Store](/cloud/online-store) (\`/cloud/online-store\`) অথবা নতুন স্টোর [Create Store](/cloud/create-store) (\`/cloud/create-store\`) থেকে পরিচালনা করতে পারবেন।`
        : `You can manage your storefronts under [Online Store](/cloud/online-store) (\`/cloud/online-store\`) or launch a new store at [Create Store](/cloud/create-store) (\`/cloud/create-store\`).`;
    }

    if (q.includes('pos') || q.includes('barcode')) {
      return `Our Omnichannel POS system is ready for fast desktop, iPad, and barcode scanning with thermal receipt printing. You can access it anytime from your Store Console under [Online Store](/cloud/online-store) (\`/cloud/online-store\`).`;
    }

    return isBn
      ? `ধন্যবাদ! আপনার "${raw}" সম্পর্কিত প্রশ্নের জন্য নিচের সরাসরি লিংকগুলো ব্যবহার করতে পারেন:\n- VPS তৈরি: [Create Droplet](/cloud/create-droplet)\n- VPS ও SSH ম্যানেজমেন্ট: [My Droplets](/cloud/droplets)\n- ডোমেইন ও DNS (\`dns1.tiwlo.com\`, \`dns2.tiwlo.com\`): [Domains](/domains)\n- বিলিং ও ওয়ালেট: [Billing](/billing)\nবিস্তারিত জানালে আমি ধাপে ধাপে গাইড করে দিচ্ছি!`
      : `Thank you for reaching out! Here are quick links for your request regarding "${raw}":\n- Deploy a VPS: [Create Droplet](/cloud/create-droplet)\n- Manage VPS, Browser SSH, IPv6 & Firewall: [My Droplets](/cloud/droplets)\n- Custom Domains & DNS (\`dns1.tiwlo.com\`, \`dns2.tiwlo.com\`): [Domains](/domains)\n- Monthly Billing & Wallet: [Billing](/billing)\nLet me know which topic you'd like step-by-step help with!`;
  }
};

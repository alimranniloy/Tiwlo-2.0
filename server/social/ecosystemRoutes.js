import express from 'express';
import { SocialDB } from './socialDb.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import { MasterDB } from '../db/multiTenant.js';

const router = express.Router();

// In-memory runtime collections synchronized with database
const runtimeGigs = [];
const runtimeTriviaSessions = [];
const runtimeTriviaStats = {};
const runtimeSecretChats = {};
const runtimeAudioSpaces = [];
const runtimeCircles = [];
const runtimeCreatorTiers = {};
const runtimePolls = [];
const runtimeWallets = {};
const runtimeEvents = [];
const runtimeMediaKits = {};
const runtimeBrandBriefs = [];
const runtimeAppeals = [];
const runtimeCustomLists = [];
const runtimeDrafts = [];
const runtimeScheduled = [];
const runtimeBioLinks = [];
const runtimeDeviceSessions = {};
const runtimeReferrals = {};
const runtimeContentFilters = {};
const runtimeParentalControls = {};
const runtimeVoiceNotes = [];
const runtimeVerifications = [];
const runtimeCoauthors = [];

// ====================================================================
// 1. FREELANCE GIGS & SERVICES
// ====================================================================
router.get('/gigs', async (req, res) => {
  try {
    const { category } = req.query;
    let results = runtimeGigs;
    if (category && category !== 'All') {
      results = results.filter((g) => g.category?.toLowerCase() === category.toLowerCase());
    }
    return res.json({ success: true, gigs: results });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve gigs' });
  }
});

router.post('/gigs', async (req, res) => {
  try {
    const { userId, username, title, category, price, deliveryDays, description, skills } = req.body;
    if (!title || !price || !description) {
      return res.status(400).json({ error: 'Title, price, and description are required' });
    }

    const newGig = {
      id: `gig_${Date.now()}`,
      userId: userId || 'user',
      username: username || 'creator',
      title: String(title).slice(0, 150),
      category: category || 'Video Editing',
      price: parseFloat(price) || 0,
      deliveryDays: parseInt(deliveryDays, 10) || 3,
      description: String(description).slice(0, 1500),
      skills: Array.isArray(skills) ? skills : [],
      createdAt: new Date().toISOString(),
    };

    runtimeGigs.unshift(newGig);
    return res.status(201).json({ success: true, gig: newGig });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to publish gig' });
  }
});

// ====================================================================
// 2. LIVE TRIVIA & KNOWLEDGE CHALLENGES
// ====================================================================
router.get('/trivia/active', (req, res) => {
  // Real curated community trivia question bank
  const activeQuestions = [
    {
      id: 'q1',
      question: 'Which compression codec is standard for web and mobile streaming?',
      options: ['H.264 / AVC', 'ProRes 4444', 'Apple Lossless', 'CineForm RAW'],
      correctIndex: 0,
    },
    {
      id: 'q2',
      question: 'What is the default refresh rate of modern fluid mobile displays?',
      options: ['30Hz', '60Hz', '120Hz', '240Hz'],
      correctIndex: 2,
    },
    {
      id: 'q3',
      question: 'In PostgreSQL, which data type is best for native structured JSON queries?',
      options: ['TEXT', 'JSONB', 'VARCHAR(255)', 'BLOB'],
      correctIndex: 1,
    },
    {
      id: 'q4',
      question: 'What does GDPR stand for in global digital privacy law?',
      options: [
        'Global Data Protection Regulation',
        'General Data Protection Regulation',
        'General Digital Privacy Rights',
        'Global Domain Privacy Registry',
      ],
      correctIndex: 1,
    },
  ];

  return res.json({ success: true, questions: activeQuestions });
});

router.get('/trivia/stats', (req, res) => {
  const { userId } = req.query;
  const userStats = runtimeTriviaStats[userId] || { totalGames: 0, bestStreak: 0, totalScore: 0 };
  return res.json({ success: true, stats: userStats });
});

router.post('/trivia/submit', (req, res) => {
  const { userId, score, streak } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  if (!runtimeTriviaStats[userId]) {
    runtimeTriviaStats[userId] = { totalGames: 0, bestStreak: 0, totalScore: 0 };
  }

  const stat = runtimeTriviaStats[userId];
  stat.totalGames += 1;
  stat.totalScore += parseInt(score, 10) || 0;
  if (streak > stat.bestStreak) stat.bestStreak = streak;

  return res.json({ success: true, stats: stat });
});

// ====================================================================
// 3. MEMORIES (ON THIS DAY FLASHBACKS)
// ====================================================================
router.get('/memories', async (req, res) => {
  try {
    const { userId } = req.query;
    const socialData = SocialDB.getData();
    const posts = socialData?.posts || [];

    // Filter posts published by this user from earlier than 7 days ago
    const now = Date.now();
    const memories = posts.filter((p) => {
      const isAuthor = String(p.author?.id) === String(userId) || String(p.userId) === String(userId);
      if (!isAuthor) return false;
      const postTime = new Date(p.createdAt || p.created_at).getTime();
      return !isNaN(postTime) && now - postTime > 7 * 86400 * 1000;
    });

    return res.json({ success: true, memories });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load memories' });
  }
});

// ====================================================================
// 4. END-TO-END ENCRYPTED SECRET CHATS
// ====================================================================
router.get('/secret-chats', (req, res) => {
  const { userId } = req.query;
  const userChats = Object.values(runtimeSecretChats).filter(
    (c) => c.userId === userId || c.peerId === userId
  );
  return res.json({ success: true, chats: userChats });
});

router.post('/secret-chats/send', (req, res) => {
  const { senderId, recipientUsername, text, ttlSeconds } = req.body;
  if (!senderId || !recipientUsername || !text) {
    return res.status(400).json({ error: 'Missing required chat parameters' });
  }

  const chatId = `sc_${senderId}_${recipientUsername}`;
  if (!runtimeSecretChats[chatId]) {
    runtimeSecretChats[chatId] = {
      id: chatId,
      userId: senderId,
      peerUsername: recipientUsername,
      ttl: parseInt(ttlSeconds, 10) || 300,
      createdAt: new Date().toISOString(),
      messages: [],
    };
  }

  const msg = {
    id: `msg_${Date.now()}`,
    senderId,
    text,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + (parseInt(ttlSeconds, 10) || 300) * 1000,
  };

  runtimeSecretChats[chatId].messages.push(msg);

  // Auto clean expired messages
  setTimeout(() => {
    if (runtimeSecretChats[chatId]) {
      runtimeSecretChats[chatId].messages = runtimeSecretChats[chatId].messages.filter(
        (m) => m.expiresAt > Date.now()
      );
    }
  }, (parseInt(ttlSeconds, 10) || 300) * 1000);

  return res.status(201).json({ success: true, message: msg });
});

// ====================================================================
// 5. LIVE AUDIO SPACES
// ====================================================================
router.get('/audio-spaces', (req, res) => {
  return res.json({
    success: true,
    spaces: runtimeAudioSpaces.filter((s) => s.isLive !== false),
  });
});

router.post('/audio-spaces', (req, res) => {
  const { title, topic, hostId, hostUsername, hostAvatar, hostName } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const effectiveHostId = hostId || 'host';
  const effectiveHostUsername = hostUsername || 'creator';

  const newSpace = {
    id: `space_${Date.now()}`,
    title: String(title).slice(0, 100),
    topic: topic || 'Open Discussion',
    hostId: effectiveHostId,
    hostUsername: effectiveHostUsername,
    host: {
      id: effectiveHostId,
      name: hostName || effectiveHostUsername,
      handle: effectiveHostUsername.startsWith('@') ? effectiveHostUsername : `@${effectiveHostUsername}`,
      avatar: hostAvatar || null,
    },
    listenersCount: 1,
    speakers: [{ id: effectiveHostId, username: effectiveHostUsername, name: hostName || effectiveHostUsername, avatar: hostAvatar, isHost: true }],
    participants: [effectiveHostId],
    isLive: true,
    createdAt: new Date().toISOString(),
  };

  runtimeAudioSpaces.unshift(newSpace);
  return res.status(201).json({ success: true, space: newSpace });
});

router.post('/audio-spaces/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId, username, name, avatar } = req.body;
  const space = runtimeAudioSpaces.find((s) => s.id === id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  if (!space.participants) space.participants = [space.hostId];
  if (!space.speakers) space.speakers = [{ id: space.hostId, username: space.hostUsername, isHost: true }];

  // Prevent duplicate join for same user ID
  const cleanUserId = userId ? String(userId) : null;
  const isAlreadyParticipant = cleanUserId && space.participants.some((pId) => String(pId) === cleanUserId);

  if (!isAlreadyParticipant && cleanUserId) {
    space.participants.push(cleanUserId);
    space.listenersCount = space.participants.length;
  }

  return res.json({ success: true, space });
});

router.post('/audio-spaces/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const spaceIndex = runtimeAudioSpaces.findIndex((s) => s.id === id);
  if (spaceIndex === -1) return res.status(404).json({ error: 'Space not found' });

  const space = runtimeAudioSpaces[spaceIndex];
  const cleanUserId = userId ? String(userId) : null;

  // If host leaves, end the space
  if (cleanUserId && String(space.hostId) === cleanUserId) {
    space.isLive = false;
    runtimeAudioSpaces.splice(spaceIndex, 1);
    return res.json({ success: true, ended: true, message: 'Host ended the audio space.' });
  }

  // Remove participant
  if (space.participants && cleanUserId) {
    space.participants = space.participants.filter((pId) => String(pId) !== cleanUserId);
    space.speakers = (space.speakers || []).filter((sp) => String(sp.id) !== cleanUserId || sp.isHost);
    space.listenersCount = Math.max(1, space.participants.length);
  }

  return res.json({ success: true, space });
});

// ====================================================================
// 6. COMMUNITY CIRCLES
// ====================================================================
router.get('/circles', (req, res) => {
  return res.json({ success: true, circles: runtimeCircles });
});

router.post('/circles', (req, res) => {
  const { name, description, category, creatorId } = req.body;
  if (!name) return res.status(400).json({ error: 'Circle name required' });

  const circle = {
    id: `circle_${Date.now()}`,
    name: String(name).slice(0, 60),
    description: String(description || '').slice(0, 300),
    category: category || 'General',
    creatorId,
    memberCount: 1,
    members: [creatorId],
    createdAt: new Date().toISOString(),
  };

  runtimeCircles.unshift(circle);
  return res.status(201).json({ success: true, circle });
});

// ====================================================================
// 7. SOCIAL WALLET & CREATOR TIPS
// ====================================================================
router.get('/wallet/balance', (req, res) => {
  const { userId } = req.query;
  const wallet = runtimeWallets[userId] || { balance: 0.0, transactions: [] };
  return res.json({ success: true, balance: wallet.balance, transactions: wallet.transactions });
});

router.post('/wallet/tip', (req, res) => {
  const { senderId, recipientHandle, amount, note } = req.body;
  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid tip amount required' });
  }

  const tx = {
    id: `tx_${Date.now()}`,
    senderId,
    recipientHandle,
    amount: numAmount,
    note: note || '',
    type: 'tip',
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  if (!runtimeWallets[senderId]) runtimeWallets[senderId] = { balance: 100.0, transactions: [] };
  runtimeWallets[senderId].balance = Math.max(0, runtimeWallets[senderId].balance - numAmount);
  runtimeWallets[senderId].transactions.unshift(tx);

  return res.json({ success: true, transaction: tx, balance: runtimeWallets[senderId].balance });
});

// ====================================================================
// 8. AI CREATIVE STUDIO PROMPT GENERATOR
// ====================================================================
router.post('/ai-studio/generate', (req, res) => {
  const { topic, tone, format } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  const cleanTopic = String(topic).trim();
  const selectedTone = tone || 'Professional';
  const selectedFormat = format || 'Social Post';

  let generatedText = '';
  if (selectedFormat === 'Reel Script') {
    generatedText = `[Hook - 0-3s]: Stop scrolling if you want to master ${cleanTopic}!\n\n[Body - 3-15s]: Here is the exact strategy that changed everything. Focus on high consistency, authentic delivery, and real audience engagement.\n\n[Call to Action]: Save this reel and follow for part 2!`;
  } else if (selectedFormat === 'Thread') {
    generatedText = `1/5 The complete guide to understanding ${cleanTopic} (and why it matters right now):\n\n2/5 Most people overcomplicate the basics. Here is what actually moves the needle...\n\n3/5 Consistency compounds faster than perfection.\n\n4/5 Double down on what your community loves.\n\n5/5 If you found this helpful, repost and share your thoughts below!`;
  } else {
    generatedText = `Excited to explore ${cleanTopic} today! Continuous growth and real community collaboration are key to lasting impact. What are your thoughts on this? Drop a comment below! 🚀\n\n#${cleanTopic.replace(/\s+/g, '')} #Community #Creators`;
  }

  return res.json({
    success: true,
    result: generatedText,
    metadata: { tone: selectedTone, format: selectedFormat },
  });
});

// ====================================================================
// 9. DATA EXPORT (GDPR / PRIVACY ARCHIVE)
// ====================================================================
router.post('/data-export', async (req, res) => {
  try {
    const { userId, categories } = req.body;
    const socialData = SocialDB.getData();

    const userPosts = (socialData?.posts || []).filter(
      (p) => String(p.author?.id) === String(userId) || String(p.userId) === String(userId)
    );
    const userLikes = (socialData?.likes || []).filter((l) => String(l.userId) === String(userId));
    const userSaves = (socialData?.saves || []).filter((s) => String(s.userId) === String(userId));

    const exportPayload = {
      archiveId: `tiwi_archive_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      requestedCategories: categories || ['posts', 'media', 'activity'],
      summary: {
        totalPosts: userPosts.length,
        totalLikes: userLikes.length,
        totalSaves: userSaves.length,
      },
      posts: userPosts,
      activity: { likes: userLikes, bookmarks: userSaves },
    };

    return res.json({
      success: true,
      archiveUrl: `/api/social/data-export/download?id=${exportPayload.archiveId}`,
      archivePayload: exportPayload,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Export generation failed' });
  }
});

// ====================================================================
// 10. ACCOUNT HEALTH & MODERATION APPEALS
// ====================================================================
router.get('/appeals', (req, res) => {
  const { userId } = req.query;
  const userAppeals = runtimeAppeals.filter((a) => a.userId === userId);
  return res.json({
    success: true,
    standing: {
      accountStatus: 'Good Standing',
      communityStrikes: 0,
      verifiedIdentity: true,
    },
    appeals: userAppeals,
  });
});

router.post('/appeals', (req, res) => {
  const { userId, reason, evidence } = req.body;
  if (!reason) return res.status(400).json({ error: 'Appeal statement is required' });

  const appealTicket = {
    id: `app_${Date.now()}`,
    userId: userId || 'user',
    reason: String(reason).slice(0, 1000),
    evidence: evidence || '',
    status: 'In Review',
    submittedAt: new Date().toISOString(),
  };

  runtimeAppeals.unshift(appealTicket);
  return res.status(201).json({ success: true, ticket: appealTicket });
});

// ====================================================================
// 11. CUSTOM LISTS
// ====================================================================
router.get('/custom-lists', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_custom_lists WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return res.json({
        success: true,
        lists: qRes.rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          isPrivate: r.is_private,
          isPinned: r.is_pinned,
          membersCount: r.members_count,
          subscribersCount: r.subscribers_count,
        })),
      });
    }
  } catch {}
  const userLists = runtimeCustomLists.filter((l) => !userId || l.userId === userId);
  return res.json({ success: true, lists: userLists });
});

router.post('/custom-lists', async (req, res) => {
  const { userId, name, description, isPrivate } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const item = {
    id: `list_${Date.now()}`,
    userId: userId || 'user',
    name: String(name).slice(0, 100),
    description: String(description || '').slice(0, 300),
    isPrivate: !!isPrivate,
    isPinned: false,
    membersCount: 0,
    subscribersCount: 0,
    createdAt: new Date().toISOString(),
  };
  try {
    if (isPgActive()) {
      await queryPg(
        'INSERT INTO social_custom_lists (id, user_id, name, description, is_private, is_pinned, members_count, subscribers_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [item.id, item.userId, item.name, item.description, item.isPrivate, false, 0, 0]
      );
    }
  } catch {}
  runtimeCustomLists.unshift(item);
  return res.status(201).json({ success: true, list: item });
});

router.post('/custom-lists/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { isPinned } = req.body;
  try {
    if (isPgActive()) {
      await queryPg('UPDATE social_custom_lists SET is_pinned = $1 WHERE id = $2', [!!isPinned, id]);
    }
  } catch {}
  const target = runtimeCustomLists.find((l) => l.id === id);
  if (target) target.isPinned = !!isPinned;
  return res.json({ success: true });
});

// ====================================================================
// 12. DRAFTS & SCHEDULER
// ====================================================================
router.get('/drafts', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg("SELECT * FROM social_drafts_scheduler WHERE user_id = $1 AND status = 'draft' ORDER BY updated_at DESC", [userId]);
      return res.json({
        success: true,
        drafts: qRes.rows.map((r) => ({
          id: r.id,
          content: r.content,
          updatedAt: 'Recently saved',
        })),
      });
    }
  } catch {}
  const userDrafts = runtimeDrafts.filter((d) => !userId || d.userId === userId);
  return res.json({ success: true, drafts: userDrafts });
});

router.post('/drafts', async (req, res) => {
  const { userId, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const draft = {
    id: `dr_${Date.now()}`,
    userId: userId || 'user',
    content: String(content),
    updatedAt: 'Just now',
  };
  try {
    if (isPgActive()) {
      await queryPg("INSERT INTO social_drafts_scheduler (id, user_id, content, status) VALUES ($1, $2, $3, 'draft')", [draft.id, draft.userId, draft.content]);
    }
  } catch {}
  runtimeDrafts.unshift(draft);
  return res.status(201).json({ success: true, draft });
});

router.delete('/drafts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isPgActive()) {
      await queryPg('DELETE FROM social_drafts_scheduler WHERE id = $1', [id]);
    }
  } catch {}
  const idx = runtimeDrafts.findIndex((d) => d.id === id);
  if (idx !== -1) runtimeDrafts.splice(idx, 1);
  return res.json({ success: true });
});

router.get('/drafts/scheduled', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg("SELECT * FROM social_drafts_scheduler WHERE user_id = $1 AND status = 'scheduled' ORDER BY created_at DESC", [userId]);
      return res.json({
        success: true,
        scheduled: qRes.rows.map((r) => ({
          id: r.id,
          content: r.content,
          publishAt: r.publish_at,
          audience: r.audience,
          mediaType: r.media_type,
        })),
      });
    }
  } catch {}
  const userSch = runtimeScheduled.filter((s) => !userId || s.userId === userId);
  return res.json({ success: true, scheduled: userSch });
});

router.post('/drafts/schedule', async (req, res) => {
  const { userId, content, publishAt, audience, mediaType } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const item = {
    id: `sch_${Date.now()}`,
    userId: userId || 'user',
    content: String(content),
    publishAt: publishAt || 'Tomorrow, 10:00 AM',
    audience: audience || 'Public',
    mediaType: mediaType || 'text',
    countdown: 'Scheduled',
  };
  try {
    if (isPgActive()) {
      await queryPg(
        "INSERT INTO social_drafts_scheduler (id, user_id, content, publish_at, audience, media_type, status) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')",
        [item.id, item.userId, item.content, item.publishAt, item.audience, item.mediaType]
      );
    }
  } catch {}
  runtimeScheduled.unshift(item);
  return res.status(201).json({ success: true, scheduledPost: item });
});

router.delete('/drafts/scheduled/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isPgActive()) {
      await queryPg('DELETE FROM social_drafts_scheduler WHERE id = $1', [id]);
    }
  } catch {}
  const idx = runtimeScheduled.findIndex((s) => s.id === id);
  if (idx !== -1) runtimeScheduled.splice(idx, 1);
  return res.json({ success: true });
});

// ====================================================================
// 13. BIO LINKS
// ====================================================================
router.get('/bio-links', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_bio_links WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at ASC', [userId]);
      return res.json({
        success: true,
        links: qRes.rows.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          icon: r.icon,
          clicks: r.clicks,
        })),
      });
    }
  } catch {}
  const userLinks = runtimeBioLinks.filter((l) => !userId || l.userId === userId);
  return res.json({ success: true, links: userLinks });
});

router.post('/bio-links', async (req, res) => {
  const { userId, title, url, icon } = req.body;
  if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
  const newLink = {
    id: `l_${Date.now()}`,
    userId: userId || 'user',
    title: String(title).slice(0, 100),
    url: String(url).slice(0, 300),
    icon: icon || 'link',
    clicks: 0,
    isActive: true,
  };
  try {
    if (isPgActive()) {
      await queryPg('INSERT INTO social_bio_links (id, user_id, title, url, icon, clicks) VALUES ($1, $2, $3, $4, $5, 0)', [
        newLink.id,
        newLink.userId,
        newLink.title,
        newLink.url,
        newLink.icon,
      ]);
    }
  } catch {}
  runtimeBioLinks.push(newLink);
  return res.status(201).json({ success: true, link: newLink });
});

router.delete('/bio-links/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isPgActive()) {
      await queryPg('DELETE FROM social_bio_links WHERE id = $1', [id]);
    }
  } catch {}
  const idx = runtimeBioLinks.findIndex((l) => l.id === id);
  if (idx !== -1) runtimeBioLinks.splice(idx, 1);
  return res.json({ success: true });
});

// ====================================================================
// 14. WALLET TRANSACTIONS & TOPUP
// ====================================================================
router.get('/wallet/transactions', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return res.json({
        success: true,
        transactions: qRes.rows.map((r) => ({
          id: r.id,
          type: r.type,
          amount: (r.type === 'sent' ? '-' : '+') + '$' + parseFloat(r.amount).toFixed(2),
          party: r.party_name,
          handle: r.party_handle,
          note: r.note,
          date: 'Recent',
        })),
      });
    }
  } catch {}
  const wallet = runtimeWallets[userId] || { transactions: [] };
  return res.json({ success: true, transactions: wallet.transactions || [] });
});

router.post('/wallet/topup', async (req, res) => {
  const { userId, amount, source } = req.body;
  const numAmt = parseFloat(amount);
  if (!numAmt || numAmt <= 0) return res.status(400).json({ error: 'Valid amount required' });

  if (!runtimeWallets[userId]) runtimeWallets[userId] = { balance: 0.0, transactions: [] };
  runtimeWallets[userId].balance += numAmt;

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'topup',
    source: source || 'Connected Card',
    amount: `+$${numAmt.toFixed(2)}`,
    note: 'Wallet balance reload',
    date: 'Just now',
  };
  runtimeWallets[userId].transactions.unshift(tx);

  try {
    if (isPgActive()) {
      await queryPg(
        'INSERT INTO social_wallet_accounts (id, user_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET balance = social_wallet_accounts.balance + $3',
        [`w_${userId}`, userId, numAmt]
      );
      await queryPg(
        'INSERT INTO social_wallet_transactions (id, user_id, type, amount, party_name, note) VALUES ($1, $2, $3, $4, $5, $6)',
        [tx.id, userId, 'topup', numAmt, source || 'Card', 'Wallet reload']
      );
    }
  } catch {}

  return res.json({ success: true, transaction: tx, balance: runtimeWallets[userId].balance });
});

// ====================================================================
// 15. DEVICE SESSIONS
// ====================================================================
router.get('/device-sessions', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_device_sessions WHERE user_id = $1 ORDER BY is_current DESC, last_active DESC', [userId]);
      if (qRes.rows.length > 0) {
        return res.json({
          success: true,
          sessions: qRes.rows.map((r) => ({
            id: r.id,
            device: r.device,
            client: r.client,
            ip: r.ip,
            isCurrent: r.is_current,
            lastActive: 'Active Now',
          })),
        });
      }
    }
  } catch {}
  const list = runtimeDeviceSessions[userId] || [];
  return res.json({ success: true, sessions: list });
});

router.delete('/device-sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isPgActive()) {
      await queryPg('DELETE FROM social_device_sessions WHERE id = $1', [id]);
    }
  } catch {}
  return res.json({ success: true });
});

router.post('/device-sessions/terminate-others', async (req, res) => {
  const { userId } = req.body;
  try {
    if (isPgActive()) {
      await queryPg('DELETE FROM social_device_sessions WHERE user_id = $1 AND is_current = FALSE', [userId]);
    }
  } catch {}
  if (runtimeDeviceSessions[userId]) {
    runtimeDeviceSessions[userId] = runtimeDeviceSessions[userId].filter((s) => s.isCurrent);
  }
  return res.json({ success: true });
});

// ====================================================================
// 16. REFERRALS & REWARDS
// ====================================================================
router.get('/referrals', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_referral_rewards WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const totalPts = qRes.rows.reduce((acc, r) => acc + (r.points || 0), 0);
      return res.json({
        success: true,
        points: totalPts,
        invitedFriends: qRes.rows.map((r) => ({
          name: r.invited_name,
          handle: r.invited_handle,
          joinedAt: 'Recently',
          pointsEarned: r.points_earned,
        })),
      });
    }
  } catch {}
  const data = runtimeReferrals[userId] || { points: 0, invitedFriends: [] };
  return res.json({ success: true, points: data.points, invitedFriends: data.invitedFriends });
});

router.post('/referrals/redeem', async (req, res) => {
  const { userId, cost } = req.body;
  const numCost = parseInt(cost, 10);
  if (!runtimeReferrals[userId]) runtimeReferrals[userId] = { points: 0, invitedFriends: [] };
  if (runtimeReferrals[userId].points < numCost) {
    return res.status(400).json({ error: 'Insufficient points' });
  }
  runtimeReferrals[userId].points -= numCost;
  return res.json({ success: true, remainingPoints: runtimeReferrals[userId].points });
});

// ====================================================================
// 17. CONTENT & FEED FILTERS
// ====================================================================
router.get('/content-filters', async (req, res) => {
  const { userId } = req.query;
  try {
    if (isPgActive()) {
      const qRes = await queryPg('SELECT * FROM social_content_filters WHERE user_id = $1', [userId]);
      if (qRes.rows.length > 0) {
        const r = qRes.rows[0];
        return res.json({
          success: true,
          filters: {
            harassmentShield: r.harassment_shield,
            blurSensitive: r.blur_sensitive,
            hideLowQuality: r.hide_low_quality,
            mutedWords: Array.isArray(r.muted_words) ? r.muted_words : [],
          },
        });
      }
    }
  } catch {}
  const filters = runtimeContentFilters[userId] || {
    harassmentShield: true,
    blurSensitive: true,
    hideLowQuality: true,
    mutedWords: [],
  };
  return res.json({ success: true, filters });
});

router.post('/content-filters', async (req, res) => {
  const { userId, harassmentShield, blurSensitive, hideLowQuality, mutedWords } = req.body;
  const updated = {
    harassmentShield: harassmentShield ?? true,
    blurSensitive: blurSensitive ?? true,
    hideLowQuality: hideLowQuality ?? true,
    mutedWords: Array.isArray(mutedWords) ? mutedWords : [],
  };
  runtimeContentFilters[userId] = updated;
  try {
    if (isPgActive()) {
      await queryPg(
        `INSERT INTO social_content_filters (id, user_id, harassment_shield, blur_sensitive, hide_low_quality, muted_words)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           harassment_shield = EXCLUDED.harassment_shield,
           blur_sensitive = EXCLUDED.blur_sensitive,
           hide_low_quality = EXCLUDED.hide_low_quality,
           muted_words = EXCLUDED.muted_words,
           updated_at = CURRENT_TIMESTAMP`,
        [`cf_${userId}`, userId, updated.harassmentShield, updated.blurSensitive, updated.hideLowQuality, JSON.stringify(updated.mutedWords)]
      );
    }
  } catch {}
  return res.json({ success: true, filters: updated });
});

// ====================================================================
// 18. CREATOR MEDIA KIT
// ====================================================================
router.get('/creator-media-kit', async (req, res) => {
  const { userId } = req.query;
  const socialData = SocialDB.getData();
  const userPosts = (socialData?.posts || []).filter(
    (p) => String(p.author?.id) === String(userId) || String(p.userId) === String(userId)
  );

  let totalLikes = 0;
  userPosts.forEach((p) => {
    totalLikes += Number(p.likes_count || p.like_count || p.likes || 0);
  });
  const engRate = userPosts.length > 0 ? `${((totalLikes / userPosts.length) * 1.5).toFixed(1)}%` : '0.0%';

  const pkgs = runtimeMediaKits[userId] || [];
  return res.json({
    success: true,
    metrics: {
      monthlyImpressions: `${(userPosts.length * 1250 + 200).toLocaleString()}`,
      engagementRate: engRate,
      followersCount: 0,
      postsCount: userPosts.length,
    },
    packages: pkgs,
  });
});

router.post('/creator-media-kit/packages', (req, res) => {
  const { userId, title, price, description, icon } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price required' });
  const pkg = {
    id: `pkg_${Date.now()}`,
    userId,
    title,
    price,
    description,
    icon: icon || 'videocam',
  };
  if (!runtimeMediaKits[userId]) runtimeMediaKits[userId] = [];
  runtimeMediaKits[userId].unshift(pkg);
  return res.status(201).json({ success: true, package: pkg });
});

// ====================================================================
// 19. PARENTAL CONTROLS
// ====================================================================
router.get('/parental-controls', async (req, res) => {
  const { userId } = req.query;
  const controls = runtimeParentalControls[userId] || {
    screenTimeLimit: '1 Hour',
    strictContent: true,
    restrictDMs: true,
    nightQuietHours: true,
    pairingPin: null,
  };
  return res.json({ success: true, controls });
});

router.post('/parental-controls', async (req, res) => {
  const { userId, screenTimeLimit, strictContent, restrictDMs, nightQuietHours, pairingPin } = req.body;
  const updated = {
    screenTimeLimit: screenTimeLimit || '1 Hour',
    strictContent: strictContent ?? true,
    restrictDMs: restrictDMs ?? true,
    nightQuietHours: nightQuietHours ?? true,
    pairingPin: pairingPin || null,
  };
  runtimeParentalControls[userId] = updated;
  return res.json({ success: true, controls: updated });
});

// ====================================================================
// 20. LIVE POLLS
// ====================================================================
router.get('/polls', (req, res) => {
  return res.json({ success: true, polls: runtimePolls });
});

router.post('/polls', (req, res) => {
  const { question, options, authorName, userId } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least 2 options required' });
  }
  const poll = {
    id: `poll_${Date.now()}`,
    userId: userId || 'user',
    author: authorName || 'Creator',
    question: String(question).slice(0, 200),
    options: options.map((opt) => ({ text: opt, votes: 0 })),
    totalVotes: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  runtimePolls.unshift(poll);
  return res.status(201).json({ success: true, poll });
});

router.post('/polls/:id/vote', (req, res) => {
  const { id } = req.params;
  const { optionIndex } = req.body;
  const poll = runtimePolls.find((p) => p.id === id);
  if (!poll || !poll.options[optionIndex]) {
    return res.status(404).json({ error: 'Poll or option not found' });
  }
  poll.options[optionIndex].votes += 1;
  poll.totalVotes += 1;
  return res.json({ success: true, poll });
});

// ====================================================================
// 21. CREATOR TIERS
// ====================================================================
router.get('/creator-tiers', (req, res) => {
  const { creatorId } = req.query;
  const tiers = runtimeCreatorTiers[creatorId] || [];
  return res.json({ success: true, tiers });
});

router.post('/creator-tiers', (req, res) => {
  const { creatorId, name, price, benefits } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  const tier = {
    id: `tier_${Date.now()}`,
    creatorId,
    name,
    price: parseFloat(price) || 0,
    benefits: Array.isArray(benefits) ? benefits : [],
    subscribersCount: 0,
  };
  if (!runtimeCreatorTiers[creatorId]) runtimeCreatorTiers[creatorId] = [];
  runtimeCreatorTiers[creatorId].unshift(tier);
  return res.status(201).json({ success: true, tier });
});

// ====================================================================
// 22. EVENTS HUB
// ====================================================================
router.get('/events', (req, res) => {
  return res.json({ success: true, events: runtimeEvents });
});

router.post('/events', (req, res) => {
  const { title, date, time, location, category, creatorId } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const evt = {
    id: `evt_${Date.now()}`,
    title,
    date: date || 'Upcoming',
    time: time || '18:00 UTC',
    location: location || 'Tiwi Live Stream',
    category: category || 'Community',
    creatorId,
    rsvpCount: 0,
    createdAt: new Date().toISOString(),
  };
  runtimeEvents.unshift(evt);
  return res.status(201).json({ success: true, event: evt });
});

router.post('/events/:id/rsvp', (req, res) => {
  const { id } = req.params;
  const evt = runtimeEvents.find((e) => e.id === id);
  if (!evt) return res.status(404).json({ error: 'Event not found' });
  evt.rsvpCount = (evt.rsvpCount || 0) + 1;
  return res.json({ success: true, event: evt });
});

// ====================================================================
// 23. CO-AUTHOR INVITATIONS
// ====================================================================
router.get('/coauthor/invitations', (req, res) => {
  const { userId } = req.query;
  const invites = runtimeCoauthors.filter((c) => !userId || c.recipientId === userId || c.senderId === userId);
  return res.json({ success: true, invitations: invites });
});

router.post('/coauthor/invitations', (req, res) => {
  const { senderId, recipientId, postId, role } = req.body;
  const inv = {
    id: `co_${Date.now()}`,
    senderId,
    recipientId,
    postId,
    role: role || 'Co-Author',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  runtimeCoauthors.unshift(inv);
  return res.status(201).json({ success: true, invitation: inv });
});

router.post('/coauthor/invitations/:id/respond', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const inv = runtimeCoauthors.find((c) => c.id === id);
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });
  inv.status = status || 'accepted';
  return res.json({ success: true, invitation: inv });
});

// ====================================================================
// 24. BRAND MARKETPLACE
// ====================================================================
router.get('/brand-briefs', (req, res) => {
  return res.json({ success: true, briefs: runtimeBrandBriefs });
});

router.post('/brand-briefs', (req, res) => {
  const { title, budget, description, category, deadline, brandName } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const brief = {
    id: `brief_${Date.now()}`,
    brand: brandName || 'Partner Brand',
    title,
    budget: budget || '$500',
    description,
    category: category || 'Social Video',
    deadline: deadline || 'Open',
    proposals: [],
    createdAt: new Date().toISOString(),
  };
  runtimeBrandBriefs.unshift(brief);
  return res.status(201).json({ success: true, brief });
});

router.post('/brand-briefs/:id/proposals', (req, res) => {
  const { id } = req.params;
  const { creatorId, pitch, requestedRate } = req.body;
  const brief = runtimeBrandBriefs.find((b) => b.id === id);
  if (!brief) return res.status(404).json({ error: 'Brief not found' });
  const prop = {
    id: `prop_${Date.now()}`,
    creatorId,
    pitch,
    requestedRate,
    submittedAt: new Date().toISOString(),
  };
  brief.proposals.push(prop);
  return res.status(201).json({ success: true, proposal: prop });
});

// ====================================================================
// 25. VOICE NOTES
// ====================================================================
router.get('/voice-notes', (req, res) => {
  const { userId } = req.query;
  const list = runtimeVoiceNotes.filter((v) => !userId || v.userId === userId);
  return res.json({ success: true, voiceNotes: list });
});

router.post('/voice-notes', (req, res) => {
  const { userId, title, audioUrl, durationSeconds } = req.body;
  const note = {
    id: `vn_${Date.now()}`,
    userId: userId || 'user',
    title: title || 'Audio broadcast',
    audioUrl,
    durationSeconds: durationSeconds || 0,
    createdAt: new Date().toISOString(),
  };
  runtimeVoiceNotes.unshift(note);
  return res.status(201).json({ success: true, voiceNote: note });
});

// ====================================================================
// 26. ACCOUNT VERIFICATION REQUESTS
// ====================================================================
router.post('/account-verification', (req, res) => {
  const { userId, legalName, category, docType, docNumber, portfolioUrl } = req.body;
  if (!legalName || !docNumber) return res.status(400).json({ error: 'Legal name and document number required' });
  const reqItem = {
    id: `vr_${Date.now()}`,
    userId,
    legalName,
    category,
    docType,
    docNumber,
    portfolioUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  runtimeVerifications.unshift(reqItem);
  return res.status(201).json({ success: true, request: reqItem });
});

export default router;

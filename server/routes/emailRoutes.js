import express from 'express';
const router = express.Router();

// Initial realistic system & corporate emails for Tiwi Mail
let emails = [
  {
    id: 'mail_1',
    folder: 'inbox',
    isFocused: true,
    isUnread: true,
    isFlagged: true,
    isPinned: true,
    sender: {
      name: 'Alex Rivera',
      email: 'alex.rivera@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      initials: 'AR',
      avatarColor: 'bg-[#0078D4]',
      isVerified: true
    },
    to: [
      { name: 'Ahmad Nur Fawaid', email: 'fawait@tiwlo.com' },
      { name: 'Core Architecture Team', email: 'architecture@tiwlo.com' }
    ],
    subject: '[Action Required] Security Architecture & PostgreSQL 16 Migration Plan',
    preview: 'Hi Ahmad, the staging database schema has been verified with zero data loss. Please review the attached migration plan...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <p>Hi Ahmad,</p>
        <p>The staging database schema and replication pipeline for <strong>PostgreSQL 16</strong> has been verified with zero data loss. All constraints, unique indices, and foreign key relations are conforming to our high-frequency standards.</p>
        
        <div style="background-color: #F0F4F9; border-left: 4px solid #0078D4; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 6px 0; color: #0078D4; font-size: 14px;">Key Verification Highlights:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px;">
            <li>Zero downtime automated table switchover</li>
            <li>Connection pool latency reduced by <strong>34%</strong></li>
            <li>Full cryptographic attestation passed</li>
          </ul>
        </div>

        <p>Please review the attached migration checklist before we initiate production cutover this Friday at 22:00 UTC.</p>

        <p style="margin-top: 24px;">Best regards,<br/><strong>Alex Rivera</strong><br/><span style="color: #605E5C; font-size: 12px;">Principal Systems Architect • Tiwlo Core</span></p>
      </div>
    `,
    date: '9:42 AM',
    fullDate: 'Monday, October 5, 2026 at 9:42 AM',
    category: 'Work',
    categoryColor: '#0078D4',
    hasAttachments: true,
    attachments: [
      {
        id: 'att_1',
        filename: 'PostgreSQL_16_Migration_Checklist.pdf',
        size: '2.4 MB',
        type: 'pdf'
      }
    ]
  },
  {
    id: 'mail_2',
    folder: 'inbox',
    isFocused: true,
    isUnread: true,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Sophia Chen',
      email: 'sophia.chen@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      initials: 'SC',
      avatarColor: 'bg-[#9333EA]',
      isVerified: true
    },
    to: [{ name: 'Ahmad Nur Fawaid', email: 'fawait@tiwlo.com' }],
    subject: 'New Fluent Design System Components & Figma Tokens',
    preview: 'Hey Ahmad! I just pushed the finalized Outlook-inspired component specifications into the shared repository...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <p>Hey Ahmad!</p>
        <p>I just pushed the finalized component tokens into our shared Figma design library. We ensured that all elevation shadows, border radii, and accessible contrast ratios strictly align with modern desktop standards.</p>
        <p>Let me know your thoughts on the new Command Ribbon bar and the Focused/Other message list layout!</p>
        <p style="margin-top: 24px;">Warmly,<br/><strong>Sophia Chen</strong><br/><span style="color: #605E5C; font-size: 12px;">Lead UI/UX Designer</span></p>
      </div>
    `,
    date: '8:15 AM',
    fullDate: 'Monday, October 5, 2026 at 8:15 AM',
    category: 'Projects',
    categoryColor: '#9333EA',
    hasAttachments: false,
    attachments: []
  },
  {
    id: 'mail_3',
    folder: 'inbox',
    isFocused: false,
    isUnread: false,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Tiwlo Cloud Security',
      email: 'security-alerts@tiwlo.com',
      avatar: null,
      initials: 'TS',
      avatarColor: 'bg-[#107C41]',
      isVerified: true
    },
    to: [{ name: 'Ahmad Nur Fawaid', email: 'fawait@tiwlo.com' }],
    subject: 'Monthly Security Digest & Audit Report (September 2026)',
    preview: 'Your monthly cloud perimeter security score is 99.8%. No anomalous sign-ins or unauthorized token rotations were detected...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <div style="background-color: #107C41; color: white; border-radius: 4px; padding: 4px 8px; font-weight: bold; font-size: 12px;">SECURITY CERTIFIED</div>
          <span style="font-size: 12px; color: #605E5C;">Automated Perimeter Attestation</span>
        </div>
        <p>Hello Ahmad,</p>
        <p>Your monthly cloud organization security score is currently <strong>99.8%</strong>. Zero anomalous sign-ins, IP mismatches, or unauthorized token escalations were recorded over the last 30-day billing cycle.</p>
        <p>All two-factor authentication devices remain actively synced and verified.</p>
        <p style="margin-top: 24px; font-size: 12px; color: #605E5C;">This is an automated administrative notification from Tiwlo Trust & Safety Engine.</p>
      </div>
    `,
    date: 'Oct 3',
    fullDate: 'Saturday, October 3, 2026 at 11:30 AM',
    category: 'Finance',
    categoryColor: '#F59E0B',
    hasAttachments: true,
    attachments: [
      {
        id: 'att_sec',
        filename: 'Security_Audit_Digest_Sept2026.pdf',
        size: '1.1 MB',
        type: 'pdf'
      }
    ]
  },
  {
    id: 'mail_4',
    folder: 'inbox',
    isFocused: true,
    isUnread: false,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Marcus Chen',
      email: 'marcus.c@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      initials: 'MC',
      avatarColor: 'bg-[#D83B01]',
      isVerified: true
    },
    to: [{ name: 'Ahmad Nur Fawaid', email: 'fawait@tiwlo.com' }],
    subject: 'Quarterly OKR Review & Tiwi Product Roadmap',
    preview: 'Meeting invites for next Wednesday have been sent out. Please prepare your feature milestones and latency benchmarks...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <p>Hi Ahmad,</p>
        <p>I have scheduled the Q4 roadmap review for Wednesday at 14:00 UTC. The primary focus will be our new multi-platform consistency and cross-application integration with Tiwi Mail, Cloud Storage, and eCommerce storefronts.</p>
        <p>Looking forward to seeing the live demonstrations!</p>
        <p style="margin-top: 24px;">Cheers,<br/><strong>Marcus Chen</strong><br/><span style="color: #605E5C; font-size: 12px;">VP of Engineering</span></p>
      </div>
    `,
    date: 'Oct 2',
    fullDate: 'Friday, October 2, 2026 at 3:15 PM',
    category: 'Work',
    categoryColor: '#0078D4',
    hasAttachments: false,
    attachments: []
  },
  {
    id: 'mail_5',
    folder: 'sent',
    isFocused: true,
    isUnread: false,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Ahmad Nur Fawaid',
      email: 'fawait@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      initials: 'AF',
      avatarColor: 'bg-[#0078D4]',
      isVerified: true
    },
    to: [{ name: 'Alex Rivera', email: 'alex.rivera@tiwlo.com' }],
    subject: 'Re: Staging Benchmark Results & Test Suite',
    preview: 'Thanks Alex. I verified the staging deployment and all unit tests passed with 100% code coverage...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <p>Thanks Alex,</p>
        <p>I verified the staging deployment and all unit tests passed with 100% code coverage. The responsive mobile view and desktop command ribbons are completely fluid.</p>
        <p>We are ready for production release.</p>
        <p style="margin-top: 24px;">Best,<br/><strong>Ahmad</strong></p>
      </div>
    `,
    date: 'Oct 1',
    fullDate: 'Thursday, October 1, 2026 at 5:00 PM',
    category: 'Work',
    categoryColor: '#0078D4',
    hasAttachments: false,
    attachments: []
  },
  {
    id: 'mail_6',
    folder: 'drafts',
    isFocused: true,
    isUnread: false,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Ahmad Nur Fawaid',
      email: 'fawait@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      initials: 'AF',
      avatarColor: 'bg-[#0078D4]',
      isVerified: true
    },
    to: [{ name: 'Partner Relations', email: 'partners@tiwlo.com' }],
    subject: '[Draft] Global Multi-Vendor Marketplace Onboarding Kit',
    preview: 'Draft proposal for global retail merchants joining TiwiMart in Q4 2026...',
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #323130; line-height: 1.6;">
        <p>Hello Partners,</p>
        <p>Here is our draft proposal for onboarding verified brands onto the TiwiMart multi-vendor engine...</p>
      </div>
    `,
    date: 'Draft',
    fullDate: 'Saved today at 10:04 AM',
    category: 'Personal',
    categoryColor: '#107C41',
    hasAttachments: false,
    attachments: []
  }
];

// GET /api/email/messages
router.get('/messages', (req, res) => {
  const { folder = 'inbox', tab = 'all', q = '' } = req.query;

  let filtered = emails.filter((m) => {
    if (folder === 'flagged') return m.isFlagged;
    if (folder === 'archive') return m.folder === 'archive';
    return m.folder === folder;
  });

  if (tab === 'focused') {
    filtered = filtered.filter((m) => m.isFocused);
  } else if (tab === 'other') {
    filtered = filtered.filter((m) => !m.isFocused);
  } else if (tab === 'unread') {
    filtered = filtered.filter((m) => m.isUnread);
  }

  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.subject.toLowerCase().includes(query) ||
        m.sender.name.toLowerCase().includes(query) ||
        m.sender.email.toLowerCase().includes(query) ||
        m.preview.toLowerCase().includes(query)
    );
  }

  const counts = {
    inboxUnread: emails.filter((m) => m.folder === 'inbox' && m.isUnread).length,
    junkCount: emails.filter((m) => m.folder === 'junk').length,
    draftsCount: emails.filter((m) => m.folder === 'drafts').length,
    sentCount: emails.filter((m) => m.folder === 'sent').length,
    trashCount: emails.filter((m) => m.folder === 'trash').length,
    archiveCount: emails.filter((m) => m.folder === 'archive').length,
    flaggedCount: emails.filter((m) => m.isFlagged).length
  };

  res.json({
    success: true,
    emails: filtered,
    counts
  });
});

// GET /api/email/messages/:id
router.get('/messages/:id', (req, res) => {
  const mail = emails.find((m) => m.id === req.params.id);
  if (!mail) {
    return res.status(404).json({ success: false, message: 'Message not found' });
  }
  // Auto-mark as read
  mail.isUnread = false;
  res.json({ success: true, email: mail });
});

// POST /api/email/send
router.post('/send', (req, res) => {
  const { to, subject, bodyHtml, attachments = [], category = 'Work' } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ success: false, message: 'Recipient and subject are required.' });
  }

  const newMail = {
    id: `mail_${Date.now()}`,
    folder: 'sent',
    isFocused: true,
    isUnread: false,
    isFlagged: false,
    isPinned: false,
    sender: {
      name: 'Ahmad Nur Fawaid',
      email: 'fawait@tiwlo.com',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      initials: 'AF',
      avatarColor: 'bg-[#0078D4]',
      isVerified: true
    },
    to: Array.isArray(to) ? to : [{ name: to, email: to }],
    subject,
    preview: (bodyHtml || '').replace(/<[^>]*>?/gm, '').substring(0, 100),
    bodyHtml: bodyHtml || '<p></p>',
    date: 'Just now',
    fullDate: new Date().toLocaleString(),
    category,
    categoryColor: '#0078D4',
    hasAttachments: attachments.length > 0,
    attachments
  };

  emails.unshift(newMail);
  res.json({ success: true, message: 'Email sent successfully!', email: newMail });
});

// POST /api/email/toggle-flag
router.post('/toggle-flag', (req, res) => {
  const { id } = req.body;
  const mail = emails.find((m) => m.id === id);
  if (mail) {
    mail.isFlagged = !mail.isFlagged;
    return res.json({ success: true, isFlagged: mail.isFlagged });
  }
  res.status(404).json({ success: false, message: 'Email not found' });
});

// POST /api/email/toggle-read
router.post('/toggle-read', (req, res) => {
  const { id, isUnread } = req.body;
  const mail = emails.find((m) => m.id === id);
  if (mail) {
    mail.isUnread = typeof isUnread === 'boolean' ? isUnread : !mail.isUnread;
    return res.json({ success: true, isUnread: mail.isUnread });
  }
  res.status(404).json({ success: false, message: 'Email not found' });
});

// POST /api/email/toggle-pin
router.post('/toggle-pin', (req, res) => {
  const { id } = req.body;
  const mail = emails.find((m) => m.id === id);
  if (mail) {
    mail.isPinned = !mail.isPinned;
    return res.json({ success: true, isPinned: mail.isPinned });
  }
  res.status(404).json({ success: false, message: 'Email not found' });
});

// POST /api/email/delete
router.post('/delete', (req, res) => {
  const { id } = req.body;
  const mail = emails.find((m) => m.id === id);
  if (mail) {
    if (mail.folder === 'trash') {
      emails = emails.filter((m) => m.id !== id);
    } else {
      mail.folder = 'trash';
    }
    return res.json({ success: true, message: 'Moved to trash' });
  }
  res.status(404).json({ success: false, message: 'Email not found' });
});

// POST /api/email/archive
router.post('/archive', (req, res) => {
  const { id } = req.body;
  const mail = emails.find((m) => m.id === id);
  if (mail) {
    mail.folder = 'archive';
    return res.json({ success: true, message: 'Archived email' });
  }
  res.status(404).json({ success: false, message: 'Email not found' });
});

export default router;

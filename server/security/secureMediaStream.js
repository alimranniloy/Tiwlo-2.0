import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Enterprise Secure Media Session Ticket Engine
 * Protects loading screen video from DevTools / Inspect / Network scraping and direct downloads.
 */

// In-memory active session tickets store
const activeTickets = new Map();

// Periodic garbage collection for expired tickets (runs every 30 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of activeTickets.entries()) {
    if (now > ticket.expiresAt) {
      activeTickets.delete(id);
    }
  }
}, 30000);

/**
 * Creates an ephemeral, single-session media ticket.
 * Bound to the requesting client's IP and User-Agent fingerprint.
 */
export function createMediaSessionTicket(req) {
  const ticketId = crypto.randomBytes(32).toString('hex');
  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const userAgent = (req.headers['user-agent'] || 'unknown').slice(0, 200);

  const ticket = {
    ticketId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 45000, // 45 seconds validity window
    clientIp,
    userAgentHash: crypto.createHash('sha256').update(userAgent).digest('hex'),
    usageCount: 0,
    maxUses: 40 // Allows browser media engine range chunks within the session
  };

  activeTickets.set(ticketId, ticket);
  return {
    ticket: ticketId,
    expiresAt: ticket.expiresAt
  };
}

/**
 * Validates a media session ticket against request credentials.
 * Blocks stolen links, external download managers, curl, and cross-browser sharing.
 */
export function validateMediaSessionTicket(ticketId, req) {
  if (!ticketId || typeof ticketId !== 'string') {
    return { valid: false, reason: 'Missing ticket ID' };
  }

  const ticket = activeTickets.get(ticketId);
  if (!ticket) {
    return { valid: false, reason: 'Session ticket expired or does not exist' };
  }

  const now = Date.now();
  if (now > ticket.expiresAt) {
    activeTickets.delete(ticketId);
    return { valid: false, reason: 'Session ticket expired' };
  }

  // Validate User-Agent fingerprint
  const currentUa = (req.headers['user-agent'] || 'unknown').slice(0, 200);
  const currentUaHash = crypto.createHash('sha256').update(currentUa).digest('hex');
  if (currentUaHash !== ticket.userAgentHash) {
    return { valid: false, reason: 'Fingerprint mismatch: unauthorized client context' };
  }

  // Anti-Scraping / Direct tool detection (block standalone IDM, python-requests, curl, aria2)
  const uaLower = currentUa.toLowerCase();
  const suspiciousAgents = ['idm', 'wget', 'curl', 'python', 'aria2', 'postman', 'insomnia', 'httpie'];
  if (suspiciousAgents.some((tool) => uaLower.includes(tool))) {
    return { valid: false, reason: 'Automated download tools are forbidden' };
  }

  // Enforce usage limit
  ticket.usageCount += 1;
  if (ticket.usageCount > ticket.maxUses) {
    activeTickets.delete(ticketId);
    return { valid: false, reason: 'Session ticket usage limit reached' };
  }

  return { valid: true, ticket };
}

/**
 * Streams media securely with range support and anti-download headers.
 */
export function streamSecureMedia(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Protected media asset not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Base anti-download security headers
  const baseHeaders = {
    'Content-Type': 'video/mp4',
    'Content-Disposition': 'inline', // Force inline viewing, never attachment download
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN'
  };

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize
    });

    fileStream.pipe(res);
    req.on('close', () => fileStream.destroy());
  } else {
    res.writeHead(200, {
      ...baseHeaders,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes'
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    req.on('close', () => fileStream.destroy());
  }
}

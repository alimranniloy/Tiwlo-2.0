import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeIncomingHtml } from './inboundMail.js';

test('keeps safe inline CID images local to the authenticated mailbox endpoint', () => {
  const contentId = 'brand-logo@example.test';
  const imageUrl = '/api/email/attachments/123e4567-e89b-12d3-a456-426614174000/inline';
  const html = sanitizeIncomingHtml(
    `<p>Hello</p><img src="cid:${contentId}" alt="Brand">`,
    '',
    new Map([[contentId, imageUrl]])
  );

  assert.match(html, new RegExp(`src="${imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /alt="Brand"/);
});

test('defers external tracking images until the reader explicitly loads them', () => {
  const html = sanitizeIncomingHtml('<img src="https://sender.example/pixel.png" alt="Logo">');

  assert.match(html, /data-remote-src="https:\/\/sender\.example\/pixel\.png"/);
  assert.doesNotMatch(html, /(?:^|\s)src="https:\/\/sender\.example/);
});

test('removes executable markup and safely formats plain-text messages', () => {
  const html = sanitizeIncomingHtml(
    '<script>alert(1)</script><p onclick="alert(2)">Hello <strong>there</strong></p>'
  );
  const plainText = sanitizeIncomingHtml('', 'Hello <script>alert(1)</script>');

  assert.doesNotMatch(html, /<script|onclick=/i);
  assert.match(html, /<strong>there<\/strong>/);
  assert.match(plainText, /&lt;script&gt;/);
});

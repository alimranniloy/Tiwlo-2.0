import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeIncomingHtml, storeInboundMail } from './inboundMail.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

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

test('routes ticket+<ref>-<token> inbound MIME emails with PDF & JPEG attachments directly to ticket ingest', async () => {
  const boundary = '----TiwloTestBoundary987654';
  const alias = `ticket+twtk202611160001-a1b2c3d4@${PLATFORM_CONFIG.primaryDomain}`;
  const pdfBase64 = Buffer.from('%PDF-1.4\n%sample', 'utf8').toString('base64');
  const jpgBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64');

  const rawRfc822 = [
    `From: Rahim Mia <rahim@example.com>`,
    `To: ${alias}`,
    `Subject: Re: Ticket #TWTK-20261116-0001`,
    `Message-ID: <mime-test-1@example.com>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    `Please check my attached PDF invoice and JPEG image.`,
    ``,
    `On Mon, Nov 16, 2026 at 10:00 AM Support wrote:`,
    `> Previous reply quote that should be stripped`,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="receipt.pdf"`,
    `Content-Disposition: attachment; filename="receipt.pdf"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfBase64,
    `--${boundary}`,
    `Content-Type: image/jpeg; name="screenshot.jpg"`,
    `Content-Disposition: attachment; filename="screenshot.jpg"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    jpgBase64,
    `--${boundary}--`,
    ``
  ].join('\r\n');

  let captured = null;
  const result = await storeInboundMail(Buffer.from(rawRfc822, 'utf8'), alias, {
    ingestTicketEmail: async (payload) => {
      captured = payload;
      return {
        duplicate: false,
        ticket: { id: 'tkt_1', serialNumber: 'TWTK-20261116-0001' },
        attachments: payload.attachments
      };
    }
  });

  assert.equal(result.routedTo, 'support_ticket');
  assert.equal(result.attachmentCount, 2);
  assert.ok(captured);
  assert.equal(captured.to, alias);
  assert.equal(captured.fromEmail, 'rahim@example.com');
  assert.equal(captured.text, 'Please check my attached PDF invoice and JPEG image.');
  assert.equal(captured.emailMessageId, '<mime-test-1@example.com>');
  assert.equal(captured.attachments.length, 2);
  assert.equal(captured.attachments[0].filename, 'receipt.pdf');
  assert.equal(captured.attachments[0].contentType, 'application/pdf');
  assert.ok(Buffer.isBuffer(captured.attachments[0].buffer) && captured.attachments[0].buffer.length > 0);
  assert.equal(captured.attachments[1].filename, 'screenshot.jpg');
  assert.equal(captured.attachments[1].contentType, 'image/jpeg');
  assert.ok(Buffer.isBuffer(captured.attachments[1].buffer) && captured.attachments[1].buffer.length > 0);
});

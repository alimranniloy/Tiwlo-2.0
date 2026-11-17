import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStoredMediaResponseHeaders,
  isMediaRequestAuthorized,
  resolveMediaStorageBackend
} from './mediaStorage.js';

test('identity verification evidence always uses private server storage', () => {
  assert.equal(resolveMediaStorageBackend({ backend: 'google_drive' }, 'identity_verification'), 'local');
  assert.equal(resolveMediaStorageBackend({ backend: 'postgres' }, 'identity_verification'), 'local');
});

test('other media continues to use the configured storage backend', () => {
  assert.equal(resolveMediaStorageBackend({ backend: 'google_drive' }, 'profile_media'), 'google_drive');
  assert.equal(resolveMediaStorageBackend({ backend: 'local' }, 'profile_media'), 'local');
  assert.equal(resolveMediaStorageBackend(null, 'profile_media'), 'postgres');
});

test('identity verification evidence is never exposed through public media aliases', () => {
  const metadata = {
    review_status: 'approved',
    purpose: 'identity_verification',
    owner_id: 'customer-one'
  };
  assert.equal(isMediaRequestAuthorized({}, metadata), false);
  assert.equal(isMediaRequestAuthorized({ activeUser: { id: 'customer-one', role: 'owner' } }, metadata), false);
  assert.equal(isMediaRequestAuthorized({ activeUser: { id: 'admin-one', role: 'admin' } }, metadata), false);
});

test('scriptable MIME types and extensions are never authorized for media streaming', () => {
  for (const mime of [
    'text/html',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/javascript',
    'text/javascript'
  ]) {
    assert.equal(
      isMediaRequestAuthorized({}, {
        review_status: 'approved',
        purpose: 'general',
        content_type: mime,
        original_filename: 'payload.bin'
      }),
      false,
      `Expected ${mime} to be rejected for general media`
    );
    assert.equal(
      isMediaRequestAuthorized({}, {
        review_status: 'approved',
        purpose: 'support_attachment',
        content_type: mime,
        original_filename: 'payload.bin'
      }),
      false,
      `Expected ${mime} to be rejected for support_attachment`
    );
  }

  assert.equal(
    isMediaRequestAuthorized({}, {
      review_status: 'approved',
      purpose: 'support_attachment',
      content_type: 'application/octet-stream',
      original_filename: 'evil.svg'
    }),
    false
  );
  assert.equal(
    isMediaRequestAuthorized({}, {
      review_status: 'approved',
      purpose: 'general',
      content_type: 'application/octet-stream',
      original_filename: 'evil.html'
    }),
    false
  );
});

test('public catalog/feed media and safe support attachments remain authorized with hardened headers', () => {
  assert.equal(
    isMediaRequestAuthorized({}, {
      review_status: 'approved',
      purpose: 'general',
      content_type: 'image/png',
      original_filename: 'catalog.png'
    }),
    true
  );
  assert.equal(
    isMediaRequestAuthorized({}, {
      review_status: 'approved',
      purpose: 'support_attachment',
      content_type: 'application/pdf',
      original_filename: 'invoice.pdf'
    }),
    true
  );

  const createMockRes = () => {
    const headers = new Map();
    return {
      headers,
      setHeader(k, v) { headers.set(String(k).toLowerCase(), String(v)); }
    };
  };

  // Public raster image keeps public cache and no forced attachment
  const pubRes = createMockRes();
  applyStoredMediaResponseHeaders(pubRes, {
    sha256: 'abc',
    size_bytes: 123,
    purpose: 'general',
    content_type: 'image/png',
    original_filename: 'catalog.png'
  });
  assert.equal(pubRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(pubRes.headers.get('content-disposition'), undefined);
  assert.equal(pubRes.headers.get('content-security-policy'), undefined);
  assert.equal(pubRes.headers.get('cache-control'), 'public, max-age=0, must-revalidate');

  // Support attachment raster image gets CSP sandbox + private cache + nosniff
  const supImgRes = createMockRes();
  applyStoredMediaResponseHeaders(supImgRes, {
    sha256: 'def',
    size_bytes: 456,
    purpose: 'support_attachment',
    content_type: 'image/png',
    original_filename: 'shot.png'
  });
  assert.equal(supImgRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(supImgRes.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(supImgRes.headers.get('cache-control'), 'private, no-store');
  assert.equal(supImgRes.headers.get('content-disposition'), undefined);

  // Support attachment PDF gets CSP sandbox + nosniff + forced attachment
  const supPdfRes = createMockRes();
  applyStoredMediaResponseHeaders(supPdfRes, {
    sha256: 'ghi',
    size_bytes: 789,
    purpose: 'support_attachment',
    content_type: 'application/pdf',
    original_filename: 'doc.pdf'
  });
  assert.equal(supPdfRes.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(supPdfRes.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(supPdfRes.headers.get('content-disposition'), 'attachment; filename="doc.pdf"');
  assert.equal(supPdfRes.headers.get('cache-control'), 'private, no-store');
});

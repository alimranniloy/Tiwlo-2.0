import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransporter, getEmailConfig } from './emailService.js';

const SMTP_ENV_KEYS = [
  'SMTP_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_TLS_REJECT_UNAUTHORIZED',
  'SMTP_TLS_SERVERNAME',
  'SMTP_USER',
  'SMTP_PASS'
];

function snapshotSmtpEnv() {
  const saved = {};
  for (const key of SMTP_ENV_KEYS) {
    saved[key] = process.env[key];
  }
  return saved;
}

function restoreSmtpEnv(saved) {
  for (const key of SMTP_ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

test('createTransporter verifies TLS certificates by default for external SMTP relays even when smtp.tls is omitted', () => {
  const saved = snapshotSmtpEnv();
  try {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];

    const transporter = createTransporter({
      smtp: {
        provider: 'custom_smtp',
        host: 'smtp.relay.example.com',
        port: 587,
        secure: false
      }
    });

    assert.equal(transporter.options.host, 'smtp.relay.example.com');
    assert.equal(transporter.options.port, 587);
    assert.equal(transporter.options.tls.rejectUnauthorized, true);
  } finally {
    restoreSmtpEnv(saved);
  }
});

test('createTransporter preserves servername and enforces rejectUnauthorized=true when smtp.tls omits rejectUnauthorized', () => {
  const saved = snapshotSmtpEnv();
  try {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];

    const transporter = createTransporter({
      smtp: {
        provider: 'custom_smtp',
        host: '198.51.100.25',
        port: 465,
        secure: true,
        tls: { servername: 'mail.tiwlo.com' }
      }
    });

    assert.equal(transporter.options.secure, true);
    assert.equal(transporter.options.tls.servername, 'mail.tiwlo.com');
    assert.equal(transporter.options.tls.rejectUnauthorized, true);
  } finally {
    restoreSmtpEnv(saved);
  }
});

test('createTransporter allows explicit SMTP_TLS_REJECT_UNAUTHORIZED=false opt-out for self-signed mail relays', () => {
  const saved = snapshotSmtpEnv();
  try {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];
    process.env.SMTP_PROVIDER = 'custom_smtp';
    process.env.SMTP_HOST = 'mail-internal.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = 'false';

    const cfg = getEmailConfig();
    assert.equal(cfg.smtp.ignoreTLS, false);
    assert.equal(cfg.smtp.tls.rejectUnauthorized, false);

    const transporter = createTransporter(cfg);
    assert.equal(transporter.options.tls.rejectUnauthorized, false);

    const omittedTlsTransporter = createTransporter({
      smtp: {
        provider: 'custom_smtp',
        host: 'mail-internal.example.com',
        port: 587
      }
    });
    assert.equal(omittedTlsTransporter.options.tls.rejectUnauthorized, false);
  } finally {
    restoreSmtpEnv(saved);
  }
});

test('local Postfix loopback 127.0.0.1:25 uses unencrypted ignoreTLS without disabling TLS verification globally', () => {
  const saved = snapshotSmtpEnv();
  try {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];

    const cfg = getEmailConfig();
    assert.equal(cfg.smtp.host, '127.0.0.1');
    assert.equal(cfg.smtp.port, 25);
    assert.equal(cfg.smtp.ignoreTLS, true);
    assert.equal(cfg.smtp.tls.rejectUnauthorized, true);

    const transporter = createTransporter(cfg);
    assert.equal(transporter.options.host, '127.0.0.1');
    assert.equal(transporter.options.port, 25);
    assert.equal(transporter.options.secure, false);
    assert.equal(transporter.options.ignoreTLS, true);
    assert.equal(transporter.options.auth, undefined);
  } finally {
    restoreSmtpEnv(saved);
  }
});

test('non-25 localhost submission port enforces TLS certificate verification unless SMTP_TLS_REJECT_UNAUTHORIZED=false', () => {
  const saved = snapshotSmtpEnv();
  try {
    for (const key of SMTP_ENV_KEYS) delete process.env[key];
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '587';

    const strictCfg = getEmailConfig();
    assert.equal(strictCfg.smtp.ignoreTLS, false);
    const strictTransporter = createTransporter(strictCfg);
    assert.equal(strictTransporter.options.host, '127.0.0.1');
    assert.equal(strictTransporter.options.port, 587);
    assert.equal(strictTransporter.options.ignoreTLS, false);
    assert.equal(strictTransporter.options.tls.rejectUnauthorized, true);

    process.env.SMTP_TLS_REJECT_UNAUTHORIZED = 'false';
    const selfSignedTransporter = createTransporter(getEmailConfig());
    assert.equal(selfSignedTransporter.options.ignoreTLS, false);
    assert.equal(selfSignedTransporter.options.tls.rejectUnauthorized, false);
  } finally {
    restoreSmtpEnv(saved);
  }
});

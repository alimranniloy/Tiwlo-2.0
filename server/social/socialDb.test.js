import test from 'node:test';
import assert from 'node:assert/strict';
import { MasterDB } from '../db/multiTenant.js';
import { getPgPool } from '../db/postgres.js';
import { SocialDB } from './socialDb.js';

test('SocialDB.authenticateUser and SocialDB.registerUser issue high-entropy CSPRNG base64url tokens', async (t) => {
  const prevRustUrl = process.env.TIWLO_RUST_BACKEND_URL;
  const prevIdentitySecret = process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust.test:7100';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'r'.repeat(32);
  t.after(() => {
    if (prevRustUrl === undefined) delete process.env.TIWLO_RUST_BACKEND_URL;
    else process.env.TIWLO_RUST_BACKEND_URL = prevRustUrl;
    if (prevIdentitySecret === undefined) delete process.env.TIWLO_INTERNAL_IDENTITY_SECRET;
    else process.env.TIWLO_INTERNAL_IDENTITY_SECRET = prevIdentitySecret;
  });

  const socialState = {
    profiles: {},
    posts: [],
    reels: [],
    stories: [],
    notifications: [],
    conversations: [],
    messages: [],
    likes: [],
    postViews: [],
    saves: [],
    follows: [],
    followRequests: [],
    reelPreferences: [],
    reelReports: []
  };

  const users = [
    {
      id: 'user-social-1',
      tiwiId: 'TIW-10001',
      name: 'Alice Example',
      storeName: 'Alice Example',
      email: 'alice@example.com',
      password: 'scrypt$hashed-password',
      role: 'owner',
      twoFactorEnabled: false,
      isBanned: false
    }
  ];

  t.mock.method(getPgPool(), 'query', async () => ({ rows: [] }));
  t.mock.method(SocialDB, 'getData', async () => socialState);
  t.mock.method(SocialDB, 'saveData', async () => {});
  t.mock.method(SocialDB, 'isEmailTaken', async () => false);
  t.mock.method(SocialDB, 'isHandleTaken', async () => false);
  t.mock.method(MasterDB, 'getUsers', async () => users);
  t.mock.method(MasterDB, 'createUser', async (payload) => {
    const created = { id: `user-${users.length + 1}`, ...payload };
    users.push(created);
    return created;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ valid: true, rehashPerformed: false }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  ));

  const login1 = await SocialDB.authenticateUser('alice@example.com', 'correct-horse-battery');
  const login2 = await SocialDB.authenticateUser('alice@example.com', 'correct-horse-battery');
  const reg = await SocialDB.registerUser({
    name: 'Bob Example',
    email: 'bob@example.com',
    handle: 'bobexample',
    password: 'StrongPassword123!'
  });

  for (const token of [login1.token, login2.token, reg.token]) {
    assert.match(token, /^tiwi_token_[A-Za-z0-9_-]{43}$/);
    assert.doesNotMatch(token, /^tiwi_token_\d{13}_/);
  }
  assert.notEqual(login1.token, login2.token);
  assert.notEqual(login1.token, reg.token);
});

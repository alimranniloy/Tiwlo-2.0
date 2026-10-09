import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SECURITY_SECRET = 'signup-browser-isolated-test-secret';
const { issueSignupBrowser, verifySignupBrowser, prepareSignupRequest, SIGNUP_BROWSER_COOKIE } = await import('./signupBrowser.js');

test('browser signals require a valid signature and expiry', () => {
  const now = Date.now();
  const token = issueSignupBrowser(now);
  assert.ok(verifySignupBrowser(token, now));
  assert.equal(verifySignupBrowser(token, now + 181 * 86400000), null);
  assert.equal(verifySignupBrowser(`${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`, now), null);
  assert.equal(verifySignupBrowser('a'.repeat(10000), now), null);
  assert.notEqual(verifySignupBrowser(issueSignupBrowser(now), now), verifySignupBrowser(token, now));
});

test('a signed browser ID survives IP and user-agent changes without device claims', () => {
  const token = issueSignupBrowser();
  const ids = [];
  for (const ip of ['192.0.2.1', '198.51.100.1']) {
    const req = { ip, headers: { 'user-agent': ip }, cookies: { [SIGNUP_BROWSER_COOKIE]: token }, body: { email: 'user@example.com', deviceId: ip } };
    prepareSignupRequest(req, { cookie() { assert.fail('Valid cookie should be reused'); } }, error => { if (error) throw error; });
    ids.push(req.signupBrowserId);
  }
  assert.equal(ids[0], ids[1]);
});

test('forged browser IDs are replaced with server-issued HttpOnly cookies', () => {
  const req = { secure: true, cookies: { [SIGNUP_BROWSER_COOKIE]: 'forged' }, body: { email: ' User@example.com ' } };
  let cookie;
  prepareSignupRequest(req, { cookie(...args) { cookie = args; } }, error => { if (error) throw error; });
  assert.equal(cookie[0], SIGNUP_BROWSER_COOKIE);
  assert.equal(cookie[2].httpOnly, true);
  assert.equal(cookie[2].secure, true);
  assert.equal(cookie[2].sameSite, 'lax');
  assert.equal(req.signupBrowserId, verifySignupBrowser(cookie[1]));
  assert.equal(req.body.email, 'user@example.com');
});

test('signed-in accounts cannot create another account through signup', () => {
  let status;
  prepareSignupRequest({ activeUser: { id: 'existing' } }, {
    status(value) { status = value; return this; }, json() {}
  }, () => assert.fail('Signup must stop'));
  assert.equal(status, 409);
});

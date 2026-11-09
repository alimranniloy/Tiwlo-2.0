const MOBILE_APP_CALLBACK = 'tiwlo://auth/callback';
const PICK_APP_CALLBACK = 'pick://auth/callback';

async function returnPickSignInToApp({ returnTo, sessionToken, apiBase }) {
  if (returnTo !== PICK_APP_CALLBACK) return false;
  if (!sessionToken) throw new Error('The sign-in session is missing.');

  const search = new URLSearchParams(window.location.search);
  const codeChallenge = search.get('pick_code_challenge') || '';
  const state = search.get('pick_state') || '';
  const response = await globalThis.fetch(`${apiBase}/pick/auth/mobile-handoff`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ codeChallenge, state })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.callbackUrl !== 'string') {
    throw new Error(result.error || 'Could not return to PICK.');
  }

  window.location.replace(result.callbackUrl);
  return true;
}

export async function returnSocialSignInToApp({ returnTo, sessionToken, apiBase = '/api' }) {
  if (await returnPickSignInToApp({ returnTo, sessionToken, apiBase })) return true;
  if (returnTo !== MOBILE_APP_CALLBACK) return false;
  if (!sessionToken) throw new Error('The social sign-in session is missing.');

  const response = await globalThis.fetch(`${apiBase}/auth/sso/mobile-social-challenge`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ platform: 'android', appVersion: '1.0.0' })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.challengeType || !result.tempToken) {
    throw new Error(result.error || 'Could not return to the Tiwlo app.');
  }

  const callback = new URL(MOBILE_APP_CALLBACK);
  callback.hash = new URLSearchParams({
    auth_challenge: result.challengeType,
    temp_token: result.tempToken,
    message: result.message || ''
  }).toString();
  window.location.replace(callback.toString());
  return true;
}

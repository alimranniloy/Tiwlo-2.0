const MOBILE_APP_CALLBACK = 'tiwlo://auth/callback';
const PICK_APP_CALLBACK = 'pick://auth/callback';
const PICK_DELIVERY_APP_CALLBACK = 'pickdelivery://auth/callback';

async function returnPickSignInToApp({ returnTo, sessionToken, challenge, apiBase }) {
  if (returnTo !== PICK_APP_CALLBACK && returnTo !== PICK_DELIVERY_APP_CALLBACK) return false;
  let result = challenge;
  if (!result) {
    if (!sessionToken) throw new Error('The sign-in session is missing.');
    const response = await globalThis.fetch(`${apiBase}/auth/sso/mobile-social-challenge`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ platform: 'android', appVersion: '1.0.0' })
    });
    result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Could not start PICK security verification.');
    }
  }
  if (!result?.challengeType || !result?.tempToken) {
    throw new Error('Could not start PICK security verification.');
  }

  localStorage.removeItem('stockpro_session');
  localStorage.removeItem('stockpro_user');
  const searchParams = new URLSearchParams(window.location.search);
  const state = searchParams.get('pick_state') || '';
  const callback = new URL(returnTo);
  callback.hash = new URLSearchParams({
    state,
    auth_challenge: result.challengeType,
    temp_token: result.tempToken,
    email_masked: result.emailMasked || '',
    message: result.message || ''
  }).toString();
  window.location.replace(callback.toString());
  return true;
}

export async function returnSocialSignInToApp({ returnTo, sessionToken, challenge, apiBase = '/api' }) {
  if (await returnPickSignInToApp({ returnTo, sessionToken, challenge, apiBase })) return true;
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

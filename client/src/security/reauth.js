import { openMaterialDialog } from '../components/MaterialDialogProvider.jsx';
import { requestAdminPinGrant } from '../administrator/AdminPinGateModal.jsx';

export async function requestSensitiveActionGrant(headers = {}, apiOrigin = window.location.origin, options = {}) {
  const isAdminPanel = typeof window !== 'undefined' && (
    /^\/(administrator|admin)\b/.test(window.location.pathname) ||
    options?.mode === 'admin_pin'
  );
  if (isAdminPanel) {
    return requestAdminPinGrant(headers, apiOrigin, options);
  }
  const authHeaders = new Headers(headers);
  authHeaders.set('Content-Type', 'application/json');
  const challengeResponse = await globalThis.fetch(`${apiOrigin}/api/auth/reauth/request`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders,
    body: '{}'
  });
  const challenge = await challengeResponse.json().catch(() => ({}));
  if (!challengeResponse.ok) {
    throw new Error(challenge.error || 'Could not start verification.');
  }

  const otpCode = await openMaterialDialog({
    type: 'prompt',
    title: 'Verify your identity',
    message: `Enter the verification code sent to ${challenge.emailMasked || 'your verified email'}. It expires in 10 minutes.`,
    inputLabel: 'Verification code',
    inputType: 'text',
    placeholder: 'Enter code',
    confirmLabel: 'Verify'
  });
  if (!otpCode?.trim()) throw new Error('Verification was cancelled.');

  const verifyResponse = await globalThis.fetch(`${apiOrigin}/api/auth/reauth/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders,
    body: JSON.stringify({ tempToken: challenge.tempToken, otpCode: otpCode.trim() })
  });
  const verified = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok || !verified.grant) {
    throw new Error(verified.error || 'The verification code could not be confirmed.');
  }
  return verified.grant;
}

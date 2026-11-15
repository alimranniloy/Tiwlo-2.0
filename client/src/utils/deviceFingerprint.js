const DEVICE_STORAGE_KEY = 'tiwlo_device_token_v1';
let cachedFingerprint = null;
let cachedDeviceToken = null;

function getOrCreateDeviceToken() {
  if (cachedDeviceToken) return cachedDeviceToken;
  try {
    let existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!existing || existing.length < 16) {
      const bytes = new Uint8Array(24);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
        existing = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      } else {
        existing = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
      localStorage.setItem(DEVICE_STORAGE_KEY, existing);
    }
    cachedDeviceToken = existing;
    return existing;
  } catch {
    return '';
  }
}

function getCanvasWebGLSignal() {
  try {
    if (typeof document === 'undefined') return 'no-dom';
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let renderer = '';
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext
        ? `${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || ''}|${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''}`
        : String(gl.getParameter(gl.RENDERER) || '');
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('tiwlo-fp-v1', 2, 2);
    }
    return `${renderer}|${canvas.toDataURL().slice(-64)}`;
  } catch {
    return 'canvas-blocked';
  }
}

async function computeFingerprintHash() {
  if (cachedFingerprint) return cachedFingerprint;
  if (typeof navigator === 'undefined') return '';
  const nav = navigator;
  const scr = typeof screen !== 'undefined' ? screen : {};
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      return '';
    }
  })();

  const material = [
    nav.platform || '',
    nav.hardwareConcurrency || '',
    nav.deviceMemory || '',
    nav.maxTouchPoints || 0,
    nav.language || '',
    Array.isArray(nav.languages) ? nav.languages.join(',') : '',
    `${scr.width || 0}x${scr.height || 0}x${scr.colorDepth || 0}`,
    tz,
    getCanvasWebGLSignal()
  ].join('||');

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(material);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      cachedFingerprint = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      return cachedFingerprint;
    }
  } catch {}

  let fallback = 0;
  for (let i = 0; i < material.length; i++) {
    fallback = ((fallback << 5) - fallback + material.charCodeAt(i)) | 0;
  }
  cachedFingerprint = `fp_${Math.abs(fallback).toString(16)}`;
  return cachedFingerprint;
}

/**
 * Returns compact device-tracking headers for sensitive signup, auth, and store-creation requests.
 */
export async function getDeviceTrackingHeaders() {
  const [fingerprint, deviceToken] = await Promise.all([
    computeFingerprintHash(),
    Promise.resolve(getOrCreateDeviceToken())
  ]);
  const headers = {};
  if (fingerprint) headers['x-tiwlo-fingerprint'] = fingerprint;
  if (deviceToken) headers['x-tiwlo-device-id'] = deviceToken;
  return headers;
}

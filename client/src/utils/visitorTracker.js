const VISITOR_ID_KEY = 'tiwlo_visitor_id';
const SESSION_ID_KEY = 'tiwlo_session_id';
const HEARTBEAT_INTERVAL_MS = 20000;
const TELEMETRY_ENDPOINT = '/api/telemetry/visitor/heartbeat';

let memoryVisitorId = null;
let memorySessionId = null;
let heartbeatTimer = null;
let listenersAttached = false;
let lastBeatAtMs = Date.now();
let lastTransitionKey = '';
let lastTransitionAtMs = 0;

let activeContext = {
  path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/',
  title: typeof document !== 'undefined' ? document.title : '',
  tiwiId: '',
  productId: '',
  productName: ''
};

function generateId(prefix) {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // fallback below
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getVisitorId() {
  if (typeof window === 'undefined') return 'vis_ssr';
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateId('vis');
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = generateId('vis');
    return memoryVisitorId;
  }
}

export function getSessionId() {
  if (typeof window === 'undefined') return 'ses_ssr';
  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = generateId('ses');
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    if (!memorySessionId) memorySessionId = generateId('ses');
    return memorySessionId;
  }
}

function consumeDwellDeltaSeconds() {
  const now = Date.now();
  const delta = Math.round((now - lastBeatAtMs) / 1000);
  lastBeatAtMs = now;
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(120, delta);
}

function buildPayload(overrides = {}) {
  const path = typeof overrides.path === 'string' && overrides.path.trim()
    ? overrides.path.trim()
    : (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : activeContext.path || '/');
  const title = overrides.title !== undefined
    ? overrides.title
    : (activeContext.title || (typeof document !== 'undefined' ? document.title : ''));

  return {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    path: String(path).slice(0, 512),
    title: title ? String(title).slice(0, 256) : undefined,
    tiwiId: overrides.tiwiId !== undefined ? String(overrides.tiwiId || '').slice(0, 64) : activeContext.tiwiId,
    productId: overrides.productId !== undefined ? (overrides.productId ? String(overrides.productId).slice(0, 128) : undefined) : (activeContext.productId || undefined),
    productName: overrides.productName !== undefined ? (overrides.productName ? String(overrides.productName).slice(0, 256) : undefined) : (activeContext.productName || undefined),
    referrer: typeof document !== 'undefined' && document.referrer ? String(document.referrer).slice(0, 512) : undefined,
    dwellDeltaSeconds: overrides.dwellDeltaSeconds ?? 0,
    isPageTransition: overrides.isPageTransition === true,
    eventKind: overrides.eventKind || (overrides.isPageTransition ? 'page_view' : 'heartbeat'),
    targetLabel: overrides.targetLabel ? String(overrides.targetLabel).slice(0, 256) : undefined,
    metadata: overrides.metadata
  };
}

function dispatchTelemetry(payload, { useBeacon = false } = {}) {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(payload);

  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      if (navigator.sendBeacon(TELEMETRY_ENDPOINT, blob)) {
        return;
      }
    } catch {
      // fall through to fetch keepalive
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = window.localStorage?.getItem('stockpro_session');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore storage read error
  }

  try {
    globalThis.fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
      body: serialized
    }).catch(() => {});
  } catch {
    // silent fail to protect UX
  }
}

export function trackPageView({ path, title, tiwiId, productId, productName } = {}) {
  if (typeof window === 'undefined') return;
  const resolvedPath = typeof path === 'string' && path.trim()
    ? path.trim()
    : `${window.location.pathname}${window.location.search}`;
  const resolvedTitle = title !== undefined ? title : (typeof document !== 'undefined' ? document.title : '');
  const resolvedTiwiId = tiwiId ? String(tiwiId).slice(0, 64) : '';
  const resolvedProductId = productId ? String(productId).slice(0, 128) : '';
  const resolvedProductName = productName ? String(productName).slice(0, 256) : '';

  const transitionKey = `${resolvedPath}|${resolvedTiwiId}|${resolvedProductId}`;
  const now = Date.now();
  if (transitionKey === lastTransitionKey && now - lastTransitionAtMs < 1500) {
    return;
  }
  lastTransitionKey = transitionKey;
  lastTransitionAtMs = now;

  const dwellDeltaSeconds = consumeDwellDeltaSeconds();
  activeContext = {
    path: resolvedPath,
    title: resolvedTitle,
    tiwiId: resolvedTiwiId,
    productId: resolvedProductId,
    productName: resolvedProductName
  };

  dispatchTelemetry(
    buildPayload({
      path: resolvedPath,
      title: resolvedTitle,
      tiwiId: resolvedTiwiId,
      productId: resolvedProductId || undefined,
      productName: resolvedProductName || undefined,
      dwellDeltaSeconds,
      isPageTransition: true,
      eventKind: 'page_view'
    })
  );
}

export function trackUserAction({ kind = 'action', label, path, metadata } = {}) {
  if (typeof window === 'undefined') return;
  const dwellDeltaSeconds = consumeDwellDeltaSeconds();
  dispatchTelemetry(
    buildPayload({
      path,
      dwellDeltaSeconds,
      isPageTransition: false,
      eventKind: String(kind || 'action').slice(0, 64),
      targetLabel: label ? String(label).slice(0, 256) : undefined,
      metadata
    })
  );
}

function sendHeartbeatTick() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  const dwellDeltaSeconds = consumeDwellDeltaSeconds();
  dispatchTelemetry(
    buildPayload({
      dwellDeltaSeconds,
      isPageTransition: false,
      eventKind: 'heartbeat'
    })
  );
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    const dwellDeltaSeconds = consumeDwellDeltaSeconds();
    if (dwellDeltaSeconds > 0) {
      dispatchTelemetry(
        buildPayload({
          dwellDeltaSeconds,
          isPageTransition: false,
          eventKind: 'heartbeat'
        }),
        { useBeacon: true }
      );
    }
  } else {
    lastBeatAtMs = Date.now();
  }
}

function handleUnloadFlush() {
  const dwellDeltaSeconds = consumeDwellDeltaSeconds();
  dispatchTelemetry(
    buildPayload({
      dwellDeltaSeconds,
      isPageTransition: false,
      eventKind: 'heartbeat'
    }),
    { useBeacon: true }
  );
}

export function startVisitorTracker() {
  if (typeof window === 'undefined') return () => {};
  if (!heartbeatTimer) {
    lastBeatAtMs = Date.now();
    heartbeatTimer = window.setInterval(sendHeartbeatTick, HEARTBEAT_INTERVAL_MS);
  }
  if (!listenersAttached && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleUnloadFlush);
    window.addEventListener('beforeunload', handleUnloadFlush);
    listenersAttached = true;
  }
  return stopVisitorTracker;
}

export function initVisitorTracker(initialRoute) {
  const stop = startVisitorTracker();
  if (initialRoute) {
    trackPageView(initialRoute);
  }
  return stop;
}

export function stopVisitorTracker() {
  if (typeof window === 'undefined') return;
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (listenersAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handleUnloadFlush);
    window.removeEventListener('beforeunload', handleUnloadFlush);
    listenersAttached = false;
  }
}

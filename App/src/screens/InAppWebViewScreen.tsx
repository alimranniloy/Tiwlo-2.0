import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewProps,
  requireNativeComponent,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TIWLO_API_BASE, type TiwloUser } from '../services/tiwloAuth';
import { colors } from '../theme/tokens';

export interface InAppPaymentResult {
  status: 'success' | 'failed';
  amount?: string;
  currency?: string;
  invoiceId?: string;
  message?: string;
}

export interface InAppWebViewScreenProps {
  title: string;
  url: string;
  sessionToken?: string;
  user?: TiwloUser | null;
  activeStoreId?: string;
  checkoutMode?: boolean;
  onBack: () => void;
  onPaymentResult?: (res: InAppPaymentResult) => void;
}

interface UrlEventPayload {
  url?: string;
  phase?: string;
  status?: string;
  invoiceId?: string;
  amount?: string;
  currency?: string;
  message?: string;
}

interface TiwloEmbeddedWebViewNativeProps extends ViewProps {
  sourceUrl: string;
  authToken?: string;
  userJson?: string;
  activeStoreId?: string;
  onUrlEvent?: (event: NativeSyntheticEvent<UrlEventPayload>) => void;
}

const TiwloEmbeddedWebView =
  requireNativeComponent<TiwloEmbeddedWebViewNativeProps>(
    'TiwloEmbeddedWebView'
  );

function parseQueryParams(rawUrl: string): Record<string, string> {
  const queryIndex = rawUrl.indexOf('?');
  if (queryIndex < 0) return {};
  const queryPart = rawUrl.slice(queryIndex + 1).split('#')[0] || '';
  const params: Record<string, string> = {};
  for (const pair of queryPart.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex >= 0 ? pair.slice(0, eqIndex) : pair;
    const rawVal = eqIndex >= 0 ? pair.slice(eqIndex + 1) : '';
    try {
      const key = decodeURIComponent(rawKey).trim();
      const val = decodeURIComponent(rawVal.replace(/\+/g, ' ')).trim();
      if (key) params[key] = val;
    } catch {
      if (rawKey) params[rawKey] = rawVal;
    }
  }
  return params;
}

export const InAppWebViewScreen: React.FC<InAppWebViewScreenProps> = ({
  title,
  url,
  sessionToken,
  user,
  activeStoreId,
  checkoutMode = false,
  onBack,
  onPaymentResult,
}) => {
  const insets = useSafeAreaInsets();
  const dispatchedRef = useRef(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [storeSynced, setStoreSynced] = useState(!activeStoreId);

  useEffect(() => {
    dispatchedRef.current = false;
    setPageLoading(true);
  }, [url, checkoutMode]);

  useEffect(() => {
    let cancelled = false;
    if (!activeStoreId || !sessionToken) {
      setStoreSynced(true);
      return;
    }
    setStoreSynced(false);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    };
    fetch(`${TIWLO_API_BASE}/stores/active`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ tiwiId: activeStoreId }),
    })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setStoreSynced(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStoreId, sessionToken]);

  const handleUrlEvent = useCallback(
    (event: NativeSyntheticEvent<UrlEventPayload>) => {
      const payload = event.nativeEvent || {};
      if (payload.phase === 'finished') {
        setPageLoading(false);
      }

      if (!checkoutMode || !onPaymentResult || dispatchedRef.current) return;

      const eventUrl = typeof payload.url === 'string' ? payload.url : '';
      const lowerUrl = eventUrl.toLowerCase();
      const params = parseQueryParams(eventUrl);

      const invoiceId =
        payload.invoiceId ||
        params.invoiceId ||
        params.invoice_id ||
        params.topupId ||
        params.orderId;
      const amount = payload.amount || params.amount || params.total;
      const currency = payload.currency || params.currency;
      const message = payload.message || params.message || params.reason;

      const isSuccess =
        lowerUrl.includes('tiwlo://billing/success') ||
        lowerUrl.includes('/billing/success') ||
        lowerUrl.includes('status=paid') ||
        lowerUrl.includes('payment_status=paid') ||
        payload.status?.toLowerCase() === 'paid' ||
        payload.status?.toLowerCase() === 'success';

      if (isSuccess) {
        dispatchedRef.current = true;
        onPaymentResult({
          status: 'success',
          invoiceId,
          amount,
          currency,
          message,
        });
        return;
      }

      const isFailure =
        lowerUrl.includes('tiwlo://billing/fail') ||
        lowerUrl.includes('tiwlo://billing/cancel') ||
        lowerUrl.includes('/billing/fail') ||
        lowerUrl.includes('/billing/cancel') ||
        lowerUrl.includes('status=failed') ||
        lowerUrl.includes('status=fail') ||
        lowerUrl.includes('status=cancel') ||
        lowerUrl.includes('payment_status=failed') ||
        payload.status?.toLowerCase() === 'failed' ||
        payload.status?.toLowerCase() === 'cancelled' ||
        payload.status?.toLowerCase() === 'canceled' ||
        /[/?=&](fail|failed|cancel|cancelled|canceled)(?:[/?=&]|$)/.test(lowerUrl);

      if (isFailure) {
        dispatchedRef.current = true;
        onPaymentResult({
          status: 'failed',
          invoiceId,
          amount,
          currency,
          message,
        });
      }
    },
    [checkoutMode, onPaymentResult]
  );

  const userJson = user ? JSON.stringify(user) : '';

  return (
    <View style={styles.page}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Go back"
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={21} strokeWidth={2} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.webWrap}>
        {storeSynced ? (
          <TiwloEmbeddedWebView
            style={styles.webView}
            sourceUrl={url}
            authToken={sessionToken || ''}
            userJson={userJson}
            activeStoreId={activeStoreId || ''}
            onUrlEvent={handleUrlEvent}
          />
        ) : null}

        {pageLoading || !storeSynced ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={colors.primaryHover} />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  webWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

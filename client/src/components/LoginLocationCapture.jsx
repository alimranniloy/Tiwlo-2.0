import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import { applicationFetch as fetch } from '../api/graphqlTransport.js';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function LoginLocationCapture({ sessionToken }) {
  const [status, setStatus] = useState(() => {
    if (!sessionToken || sessionStorage.getItem('tiwlo_login_location_captured_session') === sessionToken) return 'captured';
    if (sessionStorage.getItem('tiwlo_login_location_declined_session') === sessionToken) return 'declined';
    if (sessionStorage.getItem('tiwlo_login_location_ip_session') === sessionToken) return 'approximate';
    return localStorage.getItem('tiwlo_login_location_consent_v1') === 'yes'
      ? 'capturing'
      : 'consent';
  });
  const [retrying, setRetrying] = useState(false);
  const [consented, setConsented] = useState(
    () => localStorage.getItem('tiwlo_login_location_consent_v1') === 'yes'
  );
  const inFlight = useRef(false);
  const gpsCaptured = useRef(false);
  const [gpsPermissionError, setGpsPermissionError] = useState(false);

  const postLocation = useCallback(async (coordinates) => {
    const response = await fetch(`${API_BASE}/login-location`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
      },
      body: JSON.stringify(coordinates || {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 422) return false;
      throw new Error(result.error || 'Could not save this login location.');
    }
    return result.locationAvailable === true;
  }, [sessionToken]);

  const capture = useCallback(async (showRetryState = false) => {
    if (inFlight.current || gpsCaptured.current) return;
    inFlight.current = true;
    if (showRetryState) setRetrying(true);
    let locationSaved = false;

    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        });
        if (position.coords.accuracy <= 50) {
          locationSaved = await postLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          if (locationSaved) {
            gpsCaptured.current = true;
            sessionStorage.setItem('tiwlo_login_location_captured_session', sessionToken);
            sessionStorage.removeItem('tiwlo_login_location_ip_session');
            setStatus('captured');
            inFlight.current = false;
            setRetrying(false);
            return;
          }
        }
      } catch (error) {
        setGpsPermissionError(error?.code === 1);
      }
    } else {
      setGpsPermissionError(true);
    }

    try {
      locationSaved = await postLocation(null);
      if (locationSaved) {
        sessionStorage.setItem('tiwlo_login_location_ip_session', sessionToken);
        setStatus('approximate');
      } else {
        setStatus('unavailable');
      }
    } catch (error) {
      console.error('[Login Location] Could not record location:', error);
      setStatus('unavailable');
    } finally {
      inFlight.current = false;
      setRetrying(false);
    }
  }, [postLocation, sessionToken]);

  useEffect(() => {
    if (!sessionToken) return undefined;
    const capturedSession = sessionStorage.getItem('tiwlo_login_location_captured_session');
    if (capturedSession === sessionToken) {
      gpsCaptured.current = true;
      return undefined;
    }
    if (sessionStorage.getItem('tiwlo_login_location_declined_session') === sessionToken) {
      return undefined;
    }
    if (localStorage.getItem('tiwlo_login_location_consent_v1') !== 'yes' && !consented) {
      return undefined;
    }

    const captureTimer = window.setTimeout(() => capture(), 0);
    const retryWhenAvailable = () => {
      if (!gpsCaptured.current) capture(true);
    };
    window.addEventListener('focus', retryWhenAvailable);
    window.addEventListener('online', retryWhenAvailable);
    return () => {
      window.clearTimeout(captureTimer);
      window.removeEventListener('focus', retryWhenAvailable);
      window.removeEventListener('online', retryWhenAvailable);
    };
  }, [capture, consented, sessionToken]);

  const consentToCapture = () => {
    localStorage.setItem('tiwlo_login_location_consent_v1', 'yes');
    setConsented(true);
    setStatus('capturing');
    capture(true);
  };

  const declineCapture = () => {
    sessionStorage.setItem('tiwlo_login_location_declined_session', sessionToken);
    setStatus('declined');
  };

  if (status === 'captured' || status === 'declined' || !sessionToken) return null;

  return (
    <aside
      role="status"
      className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          status === 'approximate'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        }`}>
          {status === 'approximate' ? <MapPin className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {status === 'consent'
              ? 'Share this login location?'
              : status === 'capturing'
                ? 'Checking your location…'
              : status === 'approximate'
                ? 'Approximate location saved'
                : 'Login location unavailable'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {status === 'consent'
              ? 'We can save one location for this login: GPS resolved by Google when allowed, or an approximate network-IP location. Administrators can view it. This is optional and will not block login.'
              : status === 'capturing'
                ? 'Waiting for browser location permission and resolving the current location. Login is not blocked.'
              : status === 'approximate'
              ? 'This is based on your network IP, not GPS. Allow device location to replace it with a Google-resolved GPS location.'
              : gpsPermissionError
                ? 'Allow location access in your browser or device settings. Login is not blocked.'
                : 'We will retry GPS when you return online. Login is not blocked.'}
          </p>
          {status === 'consent' ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={consentToCapture}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1765cc]"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Share location
              </button>
              <button
                type="button"
                onClick={declineCapture}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Not now
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={retrying || status === 'capturing'}
              onClick={() => capture(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1765cc] disabled:opacity-60"
            >
              {retrying || status === 'capturing' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {retrying || status === 'capturing' ? 'Checking location…' : 'Retry GPS'}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

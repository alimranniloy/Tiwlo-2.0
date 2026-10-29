import React, { useCallback, useEffect, useRef } from 'react';
import { applicationFetch as fetch } from '../api/graphqlTransport.js';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function LoginLocationCapture({ sessionToken }) {
  const inFlight = useRef(false);
  const gpsCaptured = useRef(
    Boolean(sessionToken && sessionStorage.getItem('tiwlo_login_location_captured_session') === sessionToken)
  );

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

  const capture = useCallback(async () => {
    if (inFlight.current || gpsCaptured.current) return;
    inFlight.current = true;

    if (!navigator.geolocation) {
      inFlight.current = false;
      return;
    }

    try {
      let locationAllowed = false;
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        locationAllowed = permission.state === 'granted';
      } else {
        locationAllowed = localStorage.getItem('tiwlo_login_location_consent_v1') === 'yes';
      }
      if (!locationAllowed) return;

      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        });
        const locationSaved = await postLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        if (locationSaved) {
          gpsCaptured.current = true;
          sessionStorage.setItem('tiwlo_login_location_captured_session', sessionToken);
          sessionStorage.removeItem('tiwlo_login_location_ip_session');
          return;
        }
      } catch (error) {
        console.info('[Login Location] GPS unavailable; trying approximate network location:', error?.message || error);
      }

      if (await postLocation(null)) {
        sessionStorage.setItem('tiwlo_login_location_ip_session', sessionToken);
      }
    } catch (error) {
      console.error('[Login Location] Background location capture failed:', error);
    } finally {
      inFlight.current = false;
    }
  }, [postLocation, sessionToken]);

  useEffect(() => {
    if (!sessionToken) return undefined;
    const capturedSession = sessionStorage.getItem('tiwlo_login_location_captured_session');
    if (capturedSession === sessionToken) {
      gpsCaptured.current = true;
      return undefined;
    }

    const captureTimer = window.setTimeout(() => capture(), 0);
    const retryWhenAvailable = () => {
      if (!gpsCaptured.current) capture();
    };
    window.addEventListener('focus', retryWhenAvailable);
    window.addEventListener('online', retryWhenAvailable);
    return () => {
      window.clearTimeout(captureTimer);
      window.removeEventListener('focus', retryWhenAvailable);
      window.removeEventListener('online', retryWhenAvailable);
    };
  }, [capture, sessionToken]);

  return null;
}

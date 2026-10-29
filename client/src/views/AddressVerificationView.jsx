import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  LogOut,
  MapPin,
  Navigation2
} from 'lucide-react';
import { applicationFetch as fetch } from '../api/graphqlTransport.js';

const API_BASE = '/api';
const TIWLO_LOGO = '/tiwlologo.png';

function getLocationError(error) {
  if (error?.code === 1) {
    return 'Location access is blocked for this site. Browsers do not show the permission popup again until you change the site permission.';
  }
  if (error?.code === 2) {
    return 'Your device could not determine a location. Check that location services are enabled and try again.';
  }
  if (error?.code === 3) {
    return 'Getting your location took too long. Check your connection and try again.';
  }
  return error?.message || 'We could not verify this location. Please try again.';
}

function getBestAvailablePosition() {
  return new Promise((resolve, reject) => {
    let watchId;
    let bestPosition = null;
    const finish = (callback, value) => {
      window.clearTimeout(timeoutId);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      callback(value);
    };
    const timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(resolve, bestPosition);
      } else {
        finish(reject, { code: 3 });
      }
    }, 45000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
      },
      (error) => {
        if (bestPosition) {
          finish(resolve, bestPosition);
          return;
        }
        finish(reject, error);
      },
      { enableHighAccuracy: true, timeout: 45000, maximumAge: 0 }
    );
  });
}

function getLocationSettingsUrl() {
  const site = encodeURIComponent(window.location.origin);
  if (/Edg\//.test(navigator.userAgent)) {
    return `edge://settings/content/siteDetails?site=${site}`;
  }
  if (/Chrome\//.test(navigator.userAgent)) {
    return `chrome://settings/content/siteDetails?site=${site}`;
  }
  if (/Firefox\//.test(navigator.userAgent)) {
    return 'about:preferences#privacy';
  }
  return null;
}

export default function AddressVerificationView({ onVerified, onSignOut }) {
  const [phase, setPhase] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState(null);

  useEffect(() => {
    if (phase !== 'success') return undefined;
    const timer = window.setTimeout(() => onVerified?.(), 4000);
    return () => window.clearTimeout(timer);
  }, [phase, onVerified]);

  const startVerification = async () => {
    setErrorMessage('');
    setPermissionDenied(false);
    if (!navigator.geolocation) {
      setErrorMessage('This browser does not support location access. Try again on a device with GPS enabled.');
      return;
    }

    setPhase('locating');
    try {
      const position = await getBestAvailablePosition();

      setPhase('verifying');
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(`${API_BASE}/address-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.verified !== true || !result.location) {
        throw new Error(result.error || 'We could not verify this location. Please try again.');
      }

      setVerifiedLocation(result.location || null);
      setPhase('success');
    } catch (error) {
      setPhase('idle');
      setPermissionDenied(error?.code === 1);
      setErrorMessage(getLocationError(error));
    }
  };

  const openLocationSettings = () => {
    const settingsUrl = getLocationSettingsUrl();
    if (settingsUrl) window.open(settingsUrl, '_blank', 'noopener,noreferrer');
  };

  const isWorking = phase === 'locating' || phase === 'verifying';
  const mapUrl = verifiedLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${verifiedLocation.latitude},${verifiedLocation.longitude}`)}`
    : '';
  const isApproximate = Number(verifiedLocation?.accuracyMeters) > 50;
  const mapZoom = isApproximate
    ? Math.max(8, Math.min(14, Math.floor(17 - Math.log2(verifiedLocation.accuracyMeters / 50))))
    : 16;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-8 text-[#202124]">
      <section
        aria-labelledby="address-verification-title"
        className="w-full max-w-[448px] overflow-hidden rounded-[28px] border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.12),0_2px_6px_rgba(60,64,67,0.08)]"
      >
        <div className="flex items-center justify-between border-b border-[#f1f3f4] px-5 py-4 sm:px-7">
          <div className="flex items-center">
            <img
              src={TIWLO_LOGO}
              alt="Tiwlo"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-[#5f6368] transition hover:bg-[#f1f3f4] hover:text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#d2e3fc]"
              aria-label="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 pt-6 sm:px-7 sm:pb-7 sm:pt-7">
          <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full ${
            phase === 'success'
              ? 'bg-[#e6f4ea] text-[#188038]'
              : isWorking
                ? 'bg-[#e8f0fe] text-[#1a73e8]'
                : 'bg-[#f1f3f4] text-[#5f6368]'
          }`}>
            {phase === 'success' ? (
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#1a73e8]">
                <MapPin className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-[#188038] text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                </span>
              </span>
            ) : isWorking ? (
              <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation2 className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            )}
          </div>

          {phase === 'success' && (
            <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              isApproximate ? 'bg-[#fef7e0] text-[#8d5d00]' : 'bg-[#e6f4ea] text-[#137333]'
            }`}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {isApproximate ? 'Approximate GPS · Google resolved' : 'Verified with Google'}
            </div>
          )}

          <h1 id="address-verification-title" className="text-[24px] font-normal leading-[1.3] tracking-[-0.35px] text-[#202124]">
            {phase === 'success'
              ? 'Address verified'
              : 'Your account is locked. Verify your address to continue.'}
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-[#5f6368]">
            {phase === 'success'
              ? isApproximate
                ? 'Google resolved the best available GPS coordinates. The map pin is approximate because your device reported a wide accuracy range.'
                : 'Your current address has been verified. Taking you back to your account.'
              : phase === 'locating'
                ? 'Finding the most accurate GPS signal. This can take up to 45 seconds…'
                : phase === 'verifying'
                  ? 'Google is matching your GPS coordinates to an address…'
                  : 'Allow location access to confirm your current address and continue to your account.'}
          </p>

          {isWorking && (
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#e8eaed]" role="progressbar" aria-label="Verifying your location">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#4285f4]" />
            </div>
          )}

          {phase === 'success' && verifiedLocation && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#dadce0] bg-white" role="status">
              <div className="flex items-start gap-3 p-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
                  <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#5f6368]">
                    {isApproximate ? 'Approximate location' : 'Verified address'}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#202124]">{verifiedLocation.formattedAddress}</p>
                </div>
              </div>
              <iframe
                title="Map of verified current location"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${verifiedLocation.latitude},${verifiedLocation.longitude}`)}&z=${mapZoom}&output=embed`}
                className="h-36 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eaed] px-4 py-3 sm:px-5">
                <p className="text-xs text-[#5f6368]">
                  {isApproximate
                    ? `GPS accuracy: about ${Math.round(verifiedLocation.accuracyMeters)} m`
                    : 'Verified just now'}
                </p>
                <a
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f1f6fe]"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 flex gap-3 rounded-xl border border-[#f5c2c0] bg-[#fce8e6] px-3.5 py-3 text-sm leading-5 text-[#b3261e]" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Verification failed</p>
                <p className="mt-0.5">{errorMessage}</p>
                {permissionDenied && (
                  <div className="mt-3 rounded-xl bg-white/70 p-3 text-xs leading-5 text-[#8c2f2b]">
                    <p>
                      Change this site’s Location permission to <strong>Allow</strong> in your browser settings, then return and try again. If it is set to Block, the browser will not show its permission popup again.
                    </p>
                    {getLocationSettingsUrl() && (
                      <button
                        type="button"
                        onClick={openLocationSettings}
                        className="mt-2 inline-flex min-h-9 items-center rounded-full border border-[#d9a09d] px-3 py-1.5 font-semibold text-[#8c2f2b] transition hover:bg-[#fce8e6]"
                      >
                        Open location settings
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {phase !== 'success' ? (
            <button
              type="button"
              onClick={startVerification}
              disabled={isWorking}
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0b57d0] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0842a0] focus:outline-none focus:ring-4 focus:ring-[#d2e3fc] disabled:cursor-wait disabled:opacity-70"
            >
              {isWorking ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {phase === 'locating' ? 'Getting location…' : 'Verifying with Google…'}
                </>
              ) : (
                <>
                  {errorMessage ? 'Try again' : 'Verify address'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-[#5f6368]" role="status">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#1a73e8]" aria-hidden="true" />
              Returning to your account…
            </div>
          )}

        </div>
      </section>
    </main>
  );
}

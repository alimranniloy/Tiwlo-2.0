import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  LoaderCircle,
  MapPin,
  Navigation,
  ShieldCheck
} from 'lucide-react';
import { applicationFetch as fetch } from '../api/graphqlTransport.js';

const API_BASE = '/api';

function getLocationError(error) {
  if (error?.code === 1) {
    return 'Location permission was denied. Allow location access in your browser settings, then try again.';
  }
  if (error?.code === 2) {
    return 'Your device could not determine a location. Check that location services are enabled and try again.';
  }
  if (error?.code === 3) {
    return 'Getting your location took too long. Check your connection and try again.';
  }
  return error?.message || 'We could not verify this location. Please try again.';
}

export default function AddressVerificationView({ onVerified }) {
  const [phase, setPhase] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedLocation, setVerifiedLocation] = useState(null);

  useEffect(() => {
    if (phase !== 'success') return undefined;
    const timer = window.setTimeout(() => onVerified?.(), 1800);
    return () => window.clearTimeout(timer);
  }, [phase, onVerified]);

  const startVerification = async () => {
    setErrorMessage('');
    if (!navigator.geolocation) {
      setErrorMessage('This browser does not support location access. Try again on a device with GPS enabled.');
      return;
    }

    setPhase('locating');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        });
      });
      if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 50) {
        throw new Error('Your GPS accuracy is currently over 50 meters. Move to a place with a clearer GPS signal and try again.');
      }

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
      setErrorMessage(getLocationError(error));
    }
  };

  const isWorking = phase === 'locating' || phase === 'verifying';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-10 text-[#202124]">
      <section
        aria-labelledby="address-verification-title"
        className="w-full max-w-[448px] rounded-[28px] border border-[#e4e8ef] bg-white px-7 py-9 shadow-[0_8px_32px_rgba(32,33,36,0.08)] sm:px-10"
      >
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight text-[#3c4043]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2]">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>Tiwlo Account</span>
        </div>

        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f5fb] text-[#1967d2]">
          {phase === 'success' ? (
            <Check className="h-8 w-8" aria-hidden="true" />
          ) : isWorking ? (
            <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
          ) : (
            <Navigation className="h-8 w-8" aria-hidden="true" />
          )}
        </div>

        <h1 id="address-verification-title" className="text-[28px] font-normal leading-tight tracking-[-0.4px]">
          {phase === 'success' ? 'Congratulations' : 'Verify your live location'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">
          {phase === 'success'
            ? 'Google resolved this live location. Taking you back to where you left off.'
            : phase === 'locating'
              ? 'Waiting for your device to share its location…'
              : phase === 'verifying'
                ? 'Google is resolving your GPS location…'
                : 'Select Verify Address to allow location access. Google Maps will resolve your address, area, postcode, and Plus Code.'}
        </p>

        {isWorking && (
          <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]" role="progressbar" aria-label="Verifying your location">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#4285f4]" />
          </div>
        )}

        {phase === 'success' && (
          <div className="mt-6 rounded-2xl bg-[#f1f8f3] px-4 py-3 text-sm text-[#137333]" role="status">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Google resolved this live location.</p>
                {verifiedLocation && (
                  <dl className="mt-2 space-y-1 text-[#3c6b4c]">
                    <div><dt className="inline font-medium">Address: </dt><dd className="inline">{verifiedLocation.formattedAddress}</dd></div>
                    <div><dt className="inline font-medium">Area: </dt><dd className="inline">{verifiedLocation.area}</dd></div>
                    <div><dt className="inline font-medium">Postcode: </dt><dd className="inline">{verifiedLocation.postalCode}</dd></div>
                    <div><dt className="inline font-medium">Plus Code: </dt><dd className="inline">{verifiedLocation.plusCode}</dd></div>
                    <div><dt className="inline font-medium">GPS accuracy: </dt><dd className="inline">{Math.round(verifiedLocation.accuracyMeters)} m</dd></div>
                    <div><dt className="inline font-medium">Coordinates: </dt><dd className="inline">{verifiedLocation.latitude}, {verifiedLocation.longitude}</dd></div>
                    {verifiedLocation.verifiedAt && (
                      <div><dt className="inline font-medium">Verified at: </dt><dd className="inline">{new Date(verifiedLocation.verifiedAt).toLocaleString()}</dd></div>
                    )}
                  </dl>
                )}
                {verifiedLocation && (
                  <a
                    className="mt-2 inline-flex font-medium text-[#1967d2] underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${verifiedLocation.latitude},${verifiedLocation.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View pin in Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-6 flex gap-2 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm leading-5 text-[#b3261e]" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Verification failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {phase !== 'success' && (
          <button
            type="button"
            onClick={startVerification}
            disabled={isWorking}
            className="mt-7 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1765cc] focus:outline-none focus:ring-4 focus:ring-[#d2e3fc] disabled:cursor-wait disabled:opacity-70"
          >
            {isWorking ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                {phase === 'locating' ? 'Getting location…' : 'Verifying…'}
              </>
            ) : (
              <>
                {errorMessage ? 'Try again' : 'Verify Address'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}

        <div className="mt-7 border-t border-[#e8eaed] pt-5 text-xs leading-5 text-[#5f6368]">
          By selecting Verify Address, you consent to share a fresh GPS fix and its reported
          accuracy with Tiwlo and Google Maps. The coordinates and Google-resolved address, area,
          postcode, and Plus Code are stored as your latest live-location check. Verification fails
          if GPS accuracy is over 50 meters           or Google cannot return every required address field. GPS accuracy is device-reported
          and may be inaccurate or spoofed; this is not proof of residence or banking KYC.
        </div>
      </section>
    </main>
  );
}

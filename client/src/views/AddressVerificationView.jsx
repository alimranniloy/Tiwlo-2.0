import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Navigation2,
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
    const timer = window.setTimeout(() => onVerified?.(), 4000);
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
  const mapUrl = verifiedLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${verifiedLocation.latitude},${verifiedLocation.longitude}`)}`
    : '';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8fafd] px-4 py-8 text-[#202124] sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-[#dbe8ff]/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-36 h-[28rem] w-[28rem] rounded-full bg-[#e6f4ea]/80 blur-3xl" />
      <section
        aria-labelledby="address-verification-title"
        className="relative w-full max-w-[520px] overflow-hidden rounded-[30px] border border-[#e3e8f0] bg-white shadow-[0_18px_60px_rgba(60,64,67,0.12)]"
      >
        <div className="flex items-center justify-between border-b border-[#edf0f4] px-6 py-5 sm:px-9">
          <div className="flex items-center gap-3 text-sm font-medium tracking-tight text-[#3c4043]">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#e8f0fe] text-[#1a73e8]">
              <MapPin className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span>Tiwlo Account</span>
          </div>
          <span className="rounded-full bg-[#f1f3f4] px-3 py-1.5 text-[11px] font-medium text-[#5f6368]">
            Location check
          </span>
        </div>

        <div className="px-6 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-10">
          <div className={`mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-[26px] ${
            phase === 'success'
              ? 'bg-[#e6f4ea] text-[#188038]'
              : isWorking
                ? 'bg-[#e8f0fe] text-[#1a73e8]'
                : 'bg-[#f1f3f4] text-[#5f6368]'
          }`}>
            {phase === 'success' ? (
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1a73e8] shadow-sm">
                <MapPin className="h-7 w-7" strokeWidth={2.3} aria-hidden="true" />
                <span className="absolute -bottom-1 -right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#188038] text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
              </span>
            ) : isWorking ? (
              <LoaderCircle className="h-9 w-9 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation2 className="h-8 w-8" strokeWidth={1.9} aria-hidden="true" />
            )}
          </div>

          {phase === 'success' && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-3 py-1.5 text-xs font-semibold text-[#137333]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Verified with Google
            </div>
          )}

          <h1 id="address-verification-title" className="text-[28px] font-normal leading-tight tracking-[-0.5px] text-[#202124] sm:text-[30px]">
            {phase === 'success' ? 'Location verified' : 'Verify your live location'}
          </h1>
          <p className="mt-3 max-w-[420px] text-sm leading-6 text-[#5f6368]">
            {phase === 'success'
              ? 'Your current location was resolved and securely saved. Returning you to your account shortly.'
              : phase === 'locating'
                ? 'Waiting for your device to share its current location…'
                : phase === 'verifying'
                  ? 'Google is matching your GPS coordinates to an address…'
                  : 'Use your device location to verify where you are now. Google will resolve the address, area, postcode, and Plus Code.'}
          </p>

          {isWorking && (
            <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]" role="progressbar" aria-label="Verifying your location">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#4285f4]" />
            </div>
          )}

          {phase === 'success' && verifiedLocation && (
            <div className="mt-7 overflow-hidden rounded-[22px] border border-[#e8eaed] bg-white" role="status">
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
                  <MapPin className="h-5 w-5" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f6368]">Current location</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-[#202124]">{verifiedLocation.formattedAddress}</p>
                  <p className="mt-1 text-xs text-[#5f6368]">
                    {[verifiedLocation.area, verifiedLocation.postalCode].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-[#e8eaed] bg-[#e8eaed]">
                <div className="bg-[#f8fafd] px-4 py-3 sm:px-5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#80868b]">Plus Code</p>
                  <p className="mt-1 text-xs font-semibold text-[#3c4043]">{verifiedLocation.plusCode}</p>
                </div>
                <div className="bg-[#f8fafd] px-4 py-3 sm:px-5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#80868b]">GPS accuracy</p>
                  <p className="mt-1 text-xs font-semibold text-[#3c4043]">{Math.round(verifiedLocation.accuracyMeters)} meters</p>
                </div>
              </div>
              <iframe
                title="Map of verified current location"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${verifiedLocation.latitude},${verifiedLocation.longitude}`)}&z=15&output=embed`}
                className="h-40 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eaed] px-4 py-3 sm:px-5">
                <p className="text-[11px] text-[#80868b]">
                  {verifiedLocation.verifiedAt ? `Verified ${new Date(verifiedLocation.verifiedAt).toLocaleString()}` : 'Verified just now'}
                </p>
                <a
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[#1a73e8] transition hover:bg-[#f1f6fe]"
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
            <div className="mt-6 flex gap-3 rounded-2xl border border-[#f5c2c0] bg-[#fce8e6] px-4 py-3 text-sm leading-5 text-[#b3261e]" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Verification failed</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {phase !== 'success' ? (
            <button
              type="button"
              onClick={startVerification}
              disabled={isWorking}
              className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(26,115,232,0.25)] transition hover:bg-[#1765cc] focus:outline-none focus:ring-4 focus:ring-[#d2e3fc] disabled:cursor-wait disabled:opacity-70"
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

          <div className="mt-6 flex items-start gap-2 border-t border-[#edf0f4] pt-4 text-[11px] leading-5 text-[#80868b]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5f6368]" aria-hidden="true" />
            <p>
              By selecting Verify address, you consent to share a fresh GPS fix with Tiwlo and Google.
              Coordinates and the resolved address are saved as your latest live-location check.
              GPS accuracy can vary and does not prove residence or banking KYC.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

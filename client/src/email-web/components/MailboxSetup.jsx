import React, { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { PLATFORM_DOMAIN } from '../../config/platformConfig';
import { EmailAPI } from '../api/emailApi';
import { useEmail } from '../context/EmailContext';

export default function MailboxSetup() {
  const { currentUser, handleCreateMailbox, showToast } = useEmail();
  const [localPart, setLocalPart] = useState('');
  const [availability, setAvailability] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const candidate = localPart.trim().toLowerCase();
    if (!candidate) {
      setAvailability(null);
      setIsChecking(false);
      return undefined;
    }

    let active = true;
    setAvailability(null);
    setIsChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await EmailAPI.checkMailboxAvailability(candidate);
        if (active) setAvailability(result);
      } catch (error) {
        if (active) {
          setAvailability({ available: false, error: error.message });
        }
      } finally {
        if (active) setIsChecking(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [localPart]);

  const submit = async (event) => {
    event.preventDefault();
    if (!availability?.available || isCreating) return;
    setIsCreating(true);
    try {
      await handleCreateMailbox(localPart.trim().toLowerCase());
    } catch (error) {
      showToast(error.message, 'error');
      setAvailability({ available: false, error: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0F172A] px-4 py-10 text-slate-800 dark:text-slate-100">
      <section className="w-full max-w-[480px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18181B] p-7 sm:p-9 shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#0078D4]">
          <Mail className="h-7 w-7" />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight">Create your Tiwlo Mail address</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
          Your Tiwlo account is signed in. Choose the address you want to use with Tiwlo Mail.
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Signed in as <strong className="font-semibold">{currentUser?.email || 'your Tiwlo account'}</strong></span>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="mailbox-local-part" className="mb-1.5 block text-sm font-semibold">
              Your new email address
            </label>
            <div className="flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 focus-within:border-[#0078D4] focus-within:ring-2 focus-within:ring-[#0078D4]/20">
              <input
                id="mailbox-local-part"
                autoComplete="off"
                maxLength={30}
                value={localPart}
                onChange={(event) => setLocalPart(event.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="yourname"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                aria-describedby="mailbox-availability"
              />
              <span className="flex items-center border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 px-3 text-sm text-slate-500 dark:text-slate-400">
                @{PLATFORM_DOMAIN}
              </span>
            </div>
            <p id="mailbox-availability" aria-live="polite" className="mt-2 min-h-5 text-xs">
              {isChecking ? (
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking availability…
                </span>
              ) : availability?.available ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {availability.address} is available
                </span>
              ) : availability?.error ? (
                <span className="text-red-600">{availability.error}</span>
              ) : (
                <span className="text-slate-500">Use 3–30 letters, numbers, dots, hyphens, or underscores.</span>
              )}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            This reserves your address and saves drafts and sent items in your account. Sending still uses Tiwlo’s configured SMTP sender, and receiving incoming email is not connected yet, so your Inbox will remain empty.
          </div>

          <button
            type="submit"
            disabled={!availability?.available || isChecking || isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0078D4] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#106EBE] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isCreating && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isCreating ? 'Creating address…' : 'Create address'}
          </button>
        </form>
      </section>
    </main>
  );
}

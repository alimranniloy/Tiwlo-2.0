import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Check, RotateCw } from 'lucide-react';
import { getPlatformUrl, PLATFORM_DOMAIN } from '../../config/platformConfig';
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
    if (!candidate) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      setIsChecking(true);
      try {
        const result = await EmailAPI.checkMailboxAvailability(candidate);
        if (active) setAvailability(result);
      } catch (error) {
        if (active) setAvailability({ available: false, error: error.message });
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
    if (!availability?.available || isChecking || isCreating) return;
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
    <div className="min-h-screen bg-[#ffffff] sm:bg-[#f8f9fa] flex flex-col justify-between py-6 sm:py-12 px-4 sm:px-6 font-sans antialiased text-[#1f1f1f] select-none">
      <div className="w-full max-w-[1040px] mx-auto my-auto bg-white sm:border sm:border-[#dadce0] sm:rounded-[28px] p-6 sm:p-10 lg:p-12 sm:shadow-[0_1px_3px_0_rgba(60,64,67,0.15)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
          <div className="flex flex-col justify-between lg:min-h-[420px]">
            <div>
              <div className="mb-5 sm:mb-6">
                <a href={getPlatformUrl()} className="inline-block transition-opacity hover:opacity-90">
                  <img
                    src="/tiwlologo.png"
                    alt="Tiwlo"
                    className="h-7 sm:h-8 w-auto object-contain"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                      event.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#0b57d0] text-white font-bold flex items-center justify-center text-sm">
                      T
                    </div>
                    <span className="font-semibold text-lg text-[#1f1f1f] tracking-tight">Tiwlo</span>
                  </div>
                </a>
              </div>

              <h1 className="text-[28px] sm:text-[36px] font-normal text-[#1f1f1f] tracking-tight leading-[1.2] mb-3">
                Create your Tiwlo Mail address
              </h1>
              <p className="text-[15px] sm:text-[16px] text-[#444746] leading-relaxed max-w-[420px]">
                Choose an email address for your Tiwlo account.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-[#f1f3f4] hidden lg:block">
              <div className="flex items-center justify-between text-[12px] text-[#444746] mb-2 font-medium">
                <span>Choose your email address</span>
                <span className="font-mono text-[#747775]">Step 1 of 1</span>
              </div>
              <div className="w-full bg-[#e0e2ec] h-1 rounded-full overflow-hidden">
                <div className="bg-[#0b57d0] h-full w-full rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between lg:min-h-[420px]">
            <div className="space-y-4">
              <div className="p-3 rounded-[8px] bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#1a73e8] shrink-0" />
                  <span className="font-medium text-[#1a73e8] truncate">
                    Signed in as {currentUser?.email || 'your Tiwlo account'}
                  </span>
                </div>
                <Check className="w-4 h-4 text-[#137333] shrink-0" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="mailbox-local-part" className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                    Choose your email address
                  </label>
                  <div className="flex">
                    <input
                      id="mailbox-local-part"
                      type="text"
                      value={localPart}
                      onChange={(event) => {
                        setLocalPart(event.target.value.toLowerCase().replace(/\s/g, ''));
                        setAvailability(null);
                        setIsChecking(false);
                      }}
                      placeholder="username"
                      autoComplete="off"
                      maxLength={30}
                      required
                      aria-describedby="mailbox-availability"
                      className={`min-w-0 flex-1 px-3.5 py-3 rounded-l-[4px] border text-[14px] text-[#1f1f1f] outline-none transition-colors placeholder:text-[#747775] ${
                        availability?.error
                          ? 'border-[#d93025] focus:border-[#d93025] focus:ring-1 focus:ring-[#d93025]'
                          : availability?.available
                            ? 'border-[#137333] focus:border-[#137333] focus:ring-1 focus:ring-[#137333]'
                            : 'border-[#747775] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]'
                      }`}
                    />
                    <span className="flex items-center px-3 border border-l-0 border-[#747775] rounded-r-[4px] bg-[#f8f9fa] text-[14px] text-[#5f6368]">
                      @{PLATFORM_DOMAIN}
                    </span>
                    {isChecking && (
                      <div className="ml-2 flex items-center">
                        <RotateCw className="w-4 h-4 text-[#747775] animate-spin" />
                      </div>
                    )}
                  </div>
                  <div id="mailbox-availability" aria-live="polite" className="mt-1.5 min-h-[18px] text-[12px]">
                    {availability?.available ? (
                      <span className="flex items-center gap-1.5 text-[#137333]">
                        <Check className="w-3.5 h-3.5" /> {availability.address} is available
                      </span>
                    ) : availability?.error ? (
                      <span className="flex items-center gap-1.5 text-[#d93025]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {availability.error}
                      </span>
                    ) : (
                      <span className="text-[#747775]">Use 3–30 letters, numbers, dots, hyphens, or underscores.</span>
                    )}
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={!availability?.available || isChecking || isCreating}
                    className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] disabled:opacity-45 disabled:cursor-not-allowed text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                  >
                    <span>{isCreating ? 'Creating…' : 'Create address'}</span>
                    {!isCreating && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full max-w-[1040px] mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#5f6368] gap-3">
        <span>English (United States)</span>
        <div className="flex items-center gap-6">
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Help</a>
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Privacy</a>
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Terms</a>
          <span>&copy; 2026 Tiwlo, Inc.</span>
        </div>
      </footer>
    </div>
  );
}

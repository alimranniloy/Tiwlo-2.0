import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

const MaterialDialogContext = createContext(null);
let enqueueExternalDialog = null;

export function openMaterialDialog(options = {}) {
  if (!enqueueExternalDialog) return Promise.resolve(options.type === 'prompt' ? null : false);
  return new Promise(resolve => enqueueExternalDialog({ ...options, resolve }));
}

export function showMaterialAlert(message, title = 'Notice') {
  return openMaterialDialog({ type: 'alert', title, message: String(message ?? '') });
}

export function useMaterialDialog() {
  const showDialog = useContext(MaterialDialogContext);
  if (!showDialog) throw new Error('useMaterialDialog must be used inside MaterialDialogProvider.');
  return showDialog;
}

export default function MaterialDialogProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const inputRef = useRef(null);
  const active = queue[0] || null;
  const titleId = useId();
  const messageId = useId();

  const showDialog = useCallback(options => new Promise(resolve => {
    setQueue(current => [...current, { type: 'confirm', ...options, resolve }]);
  }), []);

  useEffect(() => {
    enqueueExternalDialog = request => setQueue(current => [...current, { type: 'confirm', ...request }]);
    return () => { enqueueExternalDialog = null; };
  }, []);

  useEffect(() => {
    if (active?.type === 'prompt') inputRef.current?.focus();
  }, [active]);

  const settle = value => {
    if (!active) return;
    active.resolve(value);
    setQueue(current => current.slice(1));
  };

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(active.type === 'prompt' ? null : false);
      }
      if (event.key === 'Enter' && active.type !== 'alert' && event.target?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        settle(active.type === 'prompt' ? (inputRef.current?.value ?? '') : true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  const kind = active?.type || 'confirm';
  const isAlert = kind === 'alert';
  const isPrompt = kind === 'prompt';
  const Icon = kind === 'alert' ? AlertCircle : kind === 'confirm' ? (active?.tone === 'danger' ? AlertTriangle : HelpCircle) : Info;

  return (
    <MaterialDialogContext.Provider value={showDialog}>
      {children}
      {active && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-[#212121]/40 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !isAlert) settle(isPrompt ? null : false);
          }}
        >
          <section
            role={isAlert ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#e7e7e7] bg-[#fafafa] text-[#212121] shadow-[0_16px_48px_rgba(32,33,36,0.28)] dark:border-[#3f3f3f] dark:bg-[#2c2c2c] dark:text-[#eaeaea] animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active.tone === 'danger' ? 'bg-[#fce8e6] text-[#b3261e] dark:bg-[#601410] dark:text-[#f2b8b5]' : 'bg-[#e1e1e1] text-[#000000] dark:bg-[#3c3c3c] dark:text-[#e1e1e1]'}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-[22px] font-normal leading-7 tracking-[-0.25px] text-[#1f1f1f] dark:text-[#eaeaea]">
                  {active.title || (isAlert ? 'Notice' : isPrompt ? 'Enter information' : 'Confirm action')}
                </h2>
                <p id={messageId} className="mt-3 whitespace-pre-line text-sm leading-[22px] text-[#444746] dark:text-[#c4c7c5]">
                  {active.message || ''}
                </p>
                {active.details && (
                  <div className="mt-4 rounded-2xl bg-[#f2f2f2] px-4 py-3.5 text-[13px] leading-5 text-[#444746] dark:bg-[#363636] dark:text-[#c4c7c5]">
                    {active.details}
                  </div>
                )}
                {isPrompt && (
                  <label className="mt-5 block text-xs font-medium text-[#636363] dark:text-[#c1c1c1]">
                    {active.inputLabel || 'Value'}
                    <input
                      ref={inputRef}
                      defaultValue={active.defaultValue || ''}
                      placeholder={active.placeholder || ''}
                      type={active.inputType || 'text'}
                      className="mt-2 w-full rounded-[4px] border border-[#747775] bg-transparent px-3.5 py-3 text-sm text-[#212121] outline-none transition focus:border-2 focus:border-[#000000] dark:border-[#8e918f] dark:text-[#eaeaea]"
                    />
                  </label>
                )}
              </div>
              {!isAlert && active.showClose !== false && (
                <button type="button" aria-label="Close dialog" onClick={() => settle(isPrompt ? null : false)} className="-mr-2 -mt-2 rounded-full p-2 text-[#636363] transition hover:bg-[#ededed] dark:text-[#c1c1c1] dark:hover:bg-[#3f3f3f]">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
              {!isAlert && (
                <button type="button" onClick={() => settle(isPrompt ? null : false)} className="min-h-10 rounded-full px-5 text-sm font-medium text-[#000000] transition hover:bg-[#ededed] dark:text-[#c4c4c4] dark:hover:bg-[#3d3d3d]">
                  {active.cancelLabel || 'Cancel'}
                </button>
              )}
              <button type="button" autoFocus onClick={() => settle(isAlert ? true : isPrompt ? (inputRef.current?.value ?? '') : true)} className={`min-h-10 rounded-full px-6 text-sm font-medium transition ${active.tone === 'danger' ? 'bg-[#b3261e] text-white hover:bg-[#8c1d18]' : 'bg-[#000000] text-white hover:bg-[#3c3c3c]'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#000000] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#2c2c2c]`}>
                {active.confirmLabel || (isAlert ? 'Got it' : isPrompt ? 'Continue' : 'Continue')}
              </button>
            </div>
          </section>
        </div>
      )}
    </MaterialDialogContext.Provider>
  );
}

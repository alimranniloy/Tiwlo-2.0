import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const TOAST_STYLES = {
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-[#188038] dark:text-[#81c995]'
  },
  error: {
    Icon: AlertCircle,
    iconClass: 'text-[#d93025] dark:text-[#f28b82]'
  },
  info: {
    Icon: Info,
    iconClass: 'text-[#1a73e8] dark:text-[#8ab4f8]'
  }
};

export default function ToastNotification({ message, type = 'success' }) {
  if (!message) return null;

  const { Icon, iconClass } = TOAST_STYLES[type] || TOAST_STYLES.info;

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className="fixed bottom-5 left-1/2 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-[#dadce0] bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#202124] shadow-[0_4px_12px_rgba(60,64,67,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-200 dark:border-[#5f6368] dark:bg-[#303134] dark:text-[#e8eaed]"
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden="true" />
      <span className="break-words">{message}</span>
    </div>
  );
}

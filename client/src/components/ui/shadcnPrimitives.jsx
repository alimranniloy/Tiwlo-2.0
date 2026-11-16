import React, { createContext, useContext } from 'react';

function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ');
}

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200/80 bg-white text-neutral-950 shadow-xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold leading-none tracking-tight text-neutral-950 dark:text-white', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('text-xs text-neutral-500 dark:text-neutral-400', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div className={cn('flex items-center p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props}>
      {children}
    </div>
  );
}

const BADGE_VARIANTS = {
  default:
    'border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200',
  brand:
    'border-[#1ED760]/35 bg-[#1ED760]/15 text-emerald-800 dark:border-[#1ED760]/40 dark:bg-[#1ED760]/15 dark:text-[#1ED760]',
  secondary:
    'border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  outline:
    'border-neutral-300 bg-transparent text-neutral-700 dark:border-neutral-700 dark:text-neutral-300',
  success:
    'border-[#1ED760]/35 bg-[#1ED760]/15 text-emerald-800 dark:border-[#1ED760]/40 dark:bg-[#1ED760]/15 dark:text-[#1ED760]',
  warning:
    'border-amber-500/30 bg-amber-500/12 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300',
  destructive:
    'border-rose-500/30 bg-rose-500/12 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300',
  info:
    'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300',
  dark:
    'border-neutral-800 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100',
};

export function Badge({ variant = 'default', className = '', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap transition-colors',
        BADGE_VARIANTS[variant] || BADGE_VARIANTS.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  default:
    'bg-[#1ED760] text-black hover:bg-[#18c254] active:bg-[#15ad4b] shadow-xs border border-[#1ED760]',
  primary:
    'bg-[#1ED760] text-black hover:bg-[#18c254] active:bg-[#15ad4b] shadow-xs border border-[#1ED760]',
  secondary:
    'bg-neutral-100 text-neutral-900 hover:bg-neutral-200/80 border border-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:border-neutral-800',
  outline:
    'border border-neutral-200/80 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900',
  ghost:
    'border border-transparent bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white',
  destructive:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 border border-rose-600 shadow-xs dark:bg-rose-600 dark:hover:bg-rose-500',
  dark:
    'bg-neutral-900 text-white hover:bg-neutral-800 border border-neutral-900 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700 dark:border-neutral-700',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-9 px-3.5 text-xs rounded-xl',
  lg: 'h-10 px-4 text-sm rounded-xl',
  icon: 'h-8 w-8 rounded-lg p-0',
};

export function Button({
  type = 'button',
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/60 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.default,
        BUTTON_SIZES[size] || BUTTON_SIZES.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Separator({ orientation = 'horizontal', className = '', ...props }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-neutral-200/80 dark:bg-neutral-800',
        orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
        className
      )}
      {...props}
    />
  );
}

const ALERT_VARIANTS = {
  default:
    'border-neutral-200/80 bg-neutral-50 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-200',
  info:
    'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-200',
  success:
    'border-[#1ED760]/35 bg-[#1ED760]/12 text-emerald-950 dark:border-[#1ED760]/35 dark:bg-[#1ED760]/12 dark:text-emerald-200',
  warning:
    'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200',
  destructive:
    'border-rose-500/35 bg-rose-500/10 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
};

export function Alert({ variant = 'default', className = '', children, ...props }) {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-xs',
        ALERT_VARIANTS[variant] || ALERT_VARIANTS.default,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const TabsContext = createContext({ value: '', onValueChange: () => {} });

export function Tabs({ value, onValueChange, className = '', children, ...props }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', children, ...props }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-neutral-100/80 p-1 dark:bg-neutral-900',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, onClick, active: activeProp, className = '', children, ...props }) {
  const ctx = useContext(TabsContext);
  const isActive = typeof activeProp === 'boolean' ? activeProp : ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={(e) => {
        ctx.onValueChange?.(value);
        onClick?.(e);
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
        isActive
          ? 'bg-[#1ED760] text-black font-semibold shadow-xs'
          : 'text-neutral-600 hover:bg-white/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

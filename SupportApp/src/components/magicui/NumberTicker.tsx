import React, { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

interface NumberTickerProps {
  value: number;
  decimalPlaces?: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  delayMs?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Magic UI NumberTicker native port: smooth eased count-up transition.
 */
export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  decimalPlaces = 0,
  suffix = '',
  prefix = '',
  durationMs = 680,
  delayMs = 40,
  style,
}) => {
  const target = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;
    let startTs = 0;
    const from = 0;

    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!startTs) startTs = now;
        const elapsed = now - startTs;
        const progress = Math.min(1, elapsed / Math.max(150, durationMs));
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (target - from) * eased;
        setDisplay(current);
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setDisplay(target);
        }
      };
      rafId = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [delayMs, durationMs, target]);

  const formatted =
    decimalPlaces > 0 ? display.toFixed(decimalPlaces) : Math.round(display).toLocaleString('en-US');

  return <Text style={style}>{`${prefix}${formatted}${suffix}`}</Text>;
};

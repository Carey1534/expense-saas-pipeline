'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpOptions {
  start?: number;
  end: number;
  duration?: number;   // ms
  decimals?: number;
  prefix?: string;
  suffix?: string;
  enabled?: boolean;   // set false to skip animation
}

/**
 * Animates a number from `start` to `end` over `duration` ms using
 * an ease-out cubic curve. Returns the formatted string to render.
 */
export function useCountUp({
  start = 0,
  end,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  enabled = true,
}: CountUpOptions): string {
  const [current, setCurrent] = useState(enabled ? start : end);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setCurrent(end);
      return;
    }

    // Reset to start on each new `end` value
    setCurrent(start);
    startTimeRef.current = 0;

    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const value = start + (end - start) * eased;
      setCurrent(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, enabled]);

  const formatted = current.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${prefix}${formatted}${suffix}`;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Polls a fetch URL until the returned array length exceeds `knownCount`,
 * then calls `onNewData` with the fresh array.
 *
 * Usage:
 *   const startPolling = useUploadPoller('/api/expenses', expenses.length, (data) => {
 *     setExpenses(data);
 *   });
 *   // call startPolling() when an upload completes
 */
export function useUploadPoller<T>(
  url: string,
  knownCount: number,
  onNewData: (data: T[]) => void,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knownCountRef = useRef(knownCount);
  const [polling, setPolling] = useState(false);

  // Keep ref current so the interval closure sees the latest value
  useEffect(() => { knownCountRef.current = knownCount; }, [knownCount]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    setPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    // Don't stack multiple polls
    if (intervalRef.current) return;
    setPolling(true);

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data: T[] = await res.json();
        if (data.length > knownCountRef.current) {
          onNewData(data);
          stopPolling();
        }
      } catch { /* network blip — keep polling */ }
    }, 3000); // poll every 3 seconds

    // Give up after 90 seconds (n8n should be done well before then)
    timeoutRef.current = setTimeout(stopPolling, 90_000);
  }, [url, onNewData, stopPolling]);

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  return { startPolling, stopPolling, polling };
}

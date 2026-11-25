import { useEffect, useRef } from 'react';

/**
 * Custom hook that executes a callback immediately and repeatedly every `interval` milliseconds.
 *
 * @param fn Callback function to execute
 * @param interval Polling interval in milliseconds
 * @param enabled Whether polling is active (defaults to true)
 */
export function usePolling(
  fn: () => void | Promise<void>,
  interval: number,
  enabled: boolean = true
): void {
  const savedCallback = useRef(fn);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = fn;
  }, [fn]);

  // Set up the interval
  useEffect(() => {
    if (!enabled || interval <= 0) {
      return;
    }

    // Immediate call on mount / enable
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, interval);

    return () => clearInterval(id);
  }, [interval, enabled]);
}

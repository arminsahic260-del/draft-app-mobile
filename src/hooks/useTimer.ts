// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer(initialSeconds = 30) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  // Incrementing this key forces the effect to re-run even when isActive stays true
  const [resetKey, setResetKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsActive(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // resetKey is included so calling reset() always restarts the interval
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, resetKey]);

  const start = useCallback(() => setIsActive(true), []);
  const pause = useCallback(() => setIsActive(false), []);
  const reset = useCallback((s = initialSeconds) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSeconds(s);
    setIsActive(true);
    setResetKey((k) => k + 1); // force effect re-run even if isActive was already true
  }, [initialSeconds]);

  return { seconds, isActive, start, pause, reset };
}

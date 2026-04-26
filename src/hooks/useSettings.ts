// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'draft-app-settings';

export interface Settings {
  soundEnabled: boolean;
}

const DEFAULTS: Settings = { soundEnabled: false };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          setSettings({ ...DEFAULTS, ...parsed });
        }
      } catch {
        // Fall back to defaults — user sees un-persisted state this session.
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch((err) =>
      console.warn('[useSettings] failed to persist settings:', err?.message ?? err),
    );
  }, [settings, loaded]);

  const toggleSound = useCallback(() => {
    setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }));
  }, []);

  return { settings, toggleSound, loaded };
}

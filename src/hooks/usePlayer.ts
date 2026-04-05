// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useCallback } from 'react';
import type { PlayerProfile } from '../types';
import { fetchPlayer } from '../api/riot';

export function usePlayer() {
  const [player,  setPlayer]  = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const lookupPlayer = useCallback(async (summonerInput: string) => {
    setLoading(true);
    setError(null);
    setPlayer(null);

    try {
      const profile = await fetchPlayer(summonerInput);
      setPlayer(profile);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load player data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { player, loading, error, lookupPlayer };
}

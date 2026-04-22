// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.
//
// Thin client for /api/claude-explain. The Anthropic key lives on the server;
// we only send structured draft context and a Firebase ID token.

import type { Champion, DraftState, PlayerMastery, Recommendation } from '../types';
import { ENV } from '../config/env';
import { getFirebaseAuth } from './firebase';

export async function getPickExplanation(
  recommendation: Recommendation,
  draft: DraftState,
  mastery: PlayerMastery | undefined,
  allChampions: Champion[],
): Promise<string> {
  if (!ENV.API_BASE) {
    return 'API_BASE is not configured.';
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    return 'Sign in to get AI explanations.';
  }

  const nameOf = (id: string | null) =>
    id ? (allChampions.find((c) => c.id === id)?.name ?? id) : null;

  const enemyTeam = draft.playerTeam === 'blue' ? 'red' : 'blue';
  const allyPicks = draft.picks[draft.playerTeam]
    .map(nameOf)
    .filter((n): n is string => !!n);
  const enemyPicks = draft.picks[enemyTeam]
    .map(nameOf)
    .filter((n): n is string => !!n);
  const bans = [...draft.bans.blue, ...draft.bans.red]
    .map(nameOf)
    .filter((n): n is string => !!n);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${ENV.API_BASE}/api/claude-explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        championName: recommendation.championName,
        playerRole: draft.playerRole,
        allyPicks,
        enemyPicks,
        bans,
        mastery: mastery
          ? { gamesPlayed: mastery.gamesPlayed, winRate: mastery.winRate }
          : undefined,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return data.error ?? 'Could not load AI explanation.';
    }
    const data = await res.json();
    return data.explanation ?? 'No explanation available.';
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return 'AI explanation timed out — try again.';
    }
    return 'Could not load AI explanation.';
  }
}

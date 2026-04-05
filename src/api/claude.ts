// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, DraftState, PlayerMastery, Recommendation } from '../types';
import { ENV } from '../config/env';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

function getApiKey(): string | null {
  return ENV.CLAUDE_API_KEY || null;
}

export async function getPickExplanation(
  recommendation: Recommendation,
  draft: DraftState,
  mastery: PlayerMastery | undefined,
  allChampions: Champion[],
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return 'Configure CLAUDE_API_KEY in app config to enable AI explanations.';
  }

  const enemyTeam = draft.playerTeam === 'blue' ? 'red' : 'blue';
  const enemyPicks = draft.picks[enemyTeam]
    .filter((id): id is string => id !== null)
    .map((id) => allChampions.find((c) => c.id === id)?.name ?? id);

  const allyPicks = draft.picks[draft.playerTeam]
    .filter((id): id is string => id !== null)
    .map((id) => allChampions.find((c) => c.id === id)?.name ?? id);

  const bans = [...draft.bans.blue, ...draft.bans.red]
    .filter((id): id is string => id !== null)
    .map((id) => allChampions.find((c) => c.id === id)?.name ?? id);

  const prompt = `You are a League of Legends draft coach. Explain in 2-3 concise sentences why ${recommendation.championName} is a strong pick in this specific draft situation.

Draft context:
- Player role: ${draft.playerRole}
- Ally picks so far: ${allyPicks.length ? allyPicks.join(', ') : 'none yet'}
- Enemy picks: ${enemyPicks.length ? enemyPicks.join(', ') : 'none yet'}
- Banned: ${bans.length ? bans.join(', ') : 'none'}
${mastery ? `- Player has ${mastery.gamesPlayed} games on this champion at ${mastery.winRate}% win rate` : ''}

Focus on: win condition, synergies with allies, counters to enemies, or power spike. Be specific, not generic.`;

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? 'No explanation available.';
}

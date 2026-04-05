// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, PlayerMastery, Role } from '../types';
import allChampions from '../data/champions.json';
import matchupsData from '../data/matchups.json';
import tierlistData from '../data/tierlist.json';

const champions = allChampions as Champion[];
const matchups  = matchupsData  as Record<string, Record<string, number>>;
const tierlist  = tierlistData  as Record<string, string[]>;

export interface BanSuggestion {
  championId: string;
  championName: string;
  ddragonId: string;
  tier: string;
  reason: string;
  priority: number; // 0-1
}

function getTier(championId: string): string {
  for (const [tier, ids] of Object.entries(tierlist)) {
    if (ids.includes(championId)) return tier;
  }
  return 'C';
}

function tierScore(tier: string): number {
  return { S: 1, A: 0.75, B: 0.5, C: 0.25 }[tier] ?? 0;
}

/** How much does the enemy champion threaten the player's top picks? */
function threatScore(enemyId: string, playerMasteries: PlayerMastery[]): number {
  const topMasteries = [...playerMasteries]
    .sort((a, b) => b.masteryPoints - a.masteryPoints)
    .slice(0, 5);

  const champMatchups = matchups[enemyId];
  if (!champMatchups) return 0;

  let totalThreat = 0;
  let count = 0;
  for (const m of topMasteries) {
    const delta = champMatchups[m.championId] ?? 0;
    totalThreat += Math.max(0, delta);
    count++;
  }
  return count > 0 ? totalThreat / count / 8 : 0;
}

export function getBanSuggestions(
  unavailableIds: string[],
  playerMasteries: PlayerMastery[],
  limit = 5,
  playerRole?: Role,
): BanSuggestion[] {
  const unavailable = new Set(unavailableIds);

  return champions
    .filter((c) => !unavailable.has(c.id))
    .map((c) => {
      const tier   = getTier(c.id);
      const threat = threatScore(c.id, playerMasteries);
      const meta   = tierScore(tier);
      const laneBonus = playerRole && c.roles.includes(playerRole) ? 0.25 : 0;
      const priority  = 0.35 * threat + 0.40 * meta + 0.25 * laneBonus;

      let reason = '';
      if (laneBonus > 0 && tier === 'S') {
        reason = `S-tier in your role — direct lane threat`;
      } else if (laneBonus > 0 && threat > 0.25) {
        reason = `Counters your champion pool in ${playerRole}`;
      } else if (threat > 0.3 && meta >= 0.75) {
        reason = `Strong meta pick that counters your champion pool`;
      } else if (threat > 0.3) {
        const names = playerMasteries
          .filter((m) => (matchups[c.id]?.[m.championId] ?? 0) > 1)
          .slice(0, 2)
          .map((m) => m.championId.charAt(0).toUpperCase() + m.championId.slice(1))
          .join(' & ');
        reason = names ? `Directly counters ${names}` : `Threatens your champion pool`;
      } else if (meta >= 0.9) {
        reason = `Dominant S-tier pick this patch`;
      } else if (laneBonus > 0) {
        reason = `${tier}-tier in ${playerRole} — strong this patch`;
      } else {
        reason = `${tier}-tier — generally strong this patch`;
      }

      return { championId: c.id, championName: c.name, ddragonId: c.ddragonId, tier, reason, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

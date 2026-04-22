// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, DraftState, Role } from '../types';
import bundledTierlist from '../data/tierlist.json';

const DEFAULT_TIERLIST = bundledTierlist as Record<string, string[]>;
const TIER_ORDER = ['S', 'A', 'B', 'C'];
const DEFAULT_ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

function tierRank(id: string, tierlist: Record<string, string[]>): number {
  for (let i = 0; i < TIER_ORDER.length; i++) {
    if (tierlist[TIER_ORDER[i]]?.includes(id)) return i;
  }
  return TIER_ORDER.length;
}

/**
 * Returns the champion ID the bot should pick or ban next.
 * Bans: highest-tier champion not yet unavailable.
 * Picks: highest-tier champion for the next unfilled role slot.
 */
export function getBotAction(
  draft: DraftState,
  action: 'pick' | 'ban',
  allChampions: Champion[],
  unavailable: string[],
  tierlist: Record<string, string[]> = DEFAULT_TIERLIST,
): string | null {
  const taken = new Set(unavailable);
  const available = allChampions.filter((c) => !taken.has(c.id));

  if (action === 'ban') {
    return available.sort((a, b) => tierRank(a.id, tierlist) - tierRank(b.id, tierlist))[0]?.id ?? null;
  }

  // Pick: next role slot for red team
  const redPickCount = draft.picks.red.filter(Boolean).length;
  const neededRole = DEFAULT_ROLES[redPickCount] ?? 'mid';

  const roleMatch = available
    .filter((c) => c.roles.includes(neededRole))
    .sort((a, b) => tierRank(a.id, tierlist) - tierRank(b.id, tierlist));

  if (roleMatch.length > 0) return roleMatch[0].id;

  // Fallback: any available champion by tier
  return available.sort((a, b) => tierRank(a.id, tierlist) - tierRank(b.id, tierlist))[0]?.id ?? null;
}

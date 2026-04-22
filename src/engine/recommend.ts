// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, DraftState, PlayerMastery, Recommendation } from '../types';
import allChampions from '../data/champions.json';
import bundledMatchups from '../data/matchups.json';
import {
  calculateMatchupScore,
  calculateCompNeedScore,
  calculateMasteryScore,
} from './scoring';

const champions = allChampions as Champion[];
const DEFAULT_MATCHUPS = bundledMatchups as Record<string, Record<string, number>>;

export function getRecommendations(
  draft: DraftState,
  masteries: PlayerMastery[],
  limit = 3,
  matchups: Record<string, Record<string, number>> = DEFAULT_MATCHUPS,
): Recommendation[] {
  const { playerRole, playerTeam, picks, bans } = draft;

  const allBanned = new Set<string>([
    ...(bans.blue.filter((id): id is string => id !== null)),
    ...(bans.red.filter((id): id is string => id !== null)),
  ]);
  const allPicked = new Set<string>([
    ...(picks.blue.filter((id): id is string => id !== null)),
    ...(picks.red.filter((id): id is string => id !== null)),
  ]);
  const unavailable = new Set<string>([...allBanned, ...allPicked]);

  const candidates = champions.filter(
    (c) => c.roles.includes(playerRole) && !unavailable.has(c.id),
  );

  const teamPickIds  = picks[playerTeam].filter((id): id is string => id !== null);
  const enemyTeam    = playerTeam === 'blue' ? 'red' : 'blue';
  const enemyPickIds = picks[enemyTeam].filter((id): id is string => id !== null);

  const recommendations: Recommendation[] = candidates.map((champ) => {
    const matchupScore  = calculateMatchupScore(champ.id, enemyPickIds, matchups);
    const compNeedScore = calculateCompNeedScore(champ.id, teamPickIds, champions);
    const masteryScore  = calculateMasteryScore(champ.id, masteries);

    const finalScore     = 0.4 * matchupScore + 0.3 * compNeedScore + 0.3 * masteryScore;
    const winProbability = 45 + finalScore * 15;

    const counterTarget = getBestCounterTarget(champ.id, enemyPickIds, matchups);
    const reasoning     = buildReasoning(champ, matchupScore, compNeedScore, masteries, enemyPickIds, counterTarget);

    return {
      championId: champ.id,
      championName: champ.name,
      finalScore,
      matchupScore,
      compNeedScore,
      masteryScore,
      winProbability,
      reasoning,
      counterTarget,
    };
  });

  recommendations.sort((a, b) => b.finalScore - a.finalScore);
  return recommendations.slice(0, limit);
}

function getBestCounterTarget(
  championId: string,
  enemyPickIds: string[],
  matchups: Record<string, Record<string, number>>,
): Recommendation['counterTarget'] {
  const champMatchups = matchups[championId];
  if (!champMatchups || enemyPickIds.length === 0) return undefined;

  let bestDelta = 0;
  let bestEnemyId: string | null = null;
  for (const enemyId of enemyPickIds) {
    const delta = champMatchups[enemyId] ?? 0;
    if (delta > bestDelta) { bestDelta = delta; bestEnemyId = enemyId; }
  }
  if (!bestEnemyId || bestDelta < 1.0) return undefined;

  const enemyChamp = champions.find((c) => c.id === bestEnemyId);
  return enemyChamp
    ? { championId: bestEnemyId, championName: enemyChamp.name, delta: bestDelta }
    : undefined;
}

function buildReasoning(
  champ: Champion,
  matchupScore: number,
  compNeedScore: number,
  masteries: PlayerMastery[],
  enemyPickIds: string[],
  counterTarget: Recommendation['counterTarget'],
): string {
  const parts: string[] = [];

  if (counterTarget && counterTarget.delta >= 1.5) {
    parts.push(`Hard counters ${counterTarget.championName} (+${counterTarget.delta.toFixed(1)}% WR advantage).`);
  } else if (matchupScore >= 0.65 && enemyPickIds.length > 0) {
    const names = enemyPickIds
      .map((id) => champions.find((c) => c.id === id)?.name ?? id)
      .slice(0, 2).join(' & ');
    parts.push(`Strong into ${names}.`);
  } else if (matchupScore <= 0.35 && enemyPickIds.length > 0) {
    parts.push('Difficult matchup against enemy picks.');
  }

  if (compNeedScore >= 0.65) {
    if (champ.damageType === 'AP')      parts.push('Your team needs AP damage.');
    else if (champ.damageType === 'AD') parts.push('Your team needs AD damage.');
    const tags = champ.tags.map((t) => t.toLowerCase());
    if (tags.some((t) => t === 'engage' || t === 'initiator')) parts.push('Provides engage your team is missing.');
    if (tags.some((t) => t === 'tank'   || t === 'frontline')) parts.push('Adds frontline your team needs.');
  }

  const mastery = masteries.find((m) => m.championId === champ.id);
  if (mastery && mastery.winRate !== null) {
    parts.push(`${mastery.gamesPlayed} games · ${Math.round(mastery.winRate)}% WR.`);
  } else if (mastery && mastery.gamesPlayed > 0) {
    parts.push(`${mastery.gamesPlayed} games this season.`);
  }

  return parts.join(' ').trim() || 'Solid pick for this draft.';
}

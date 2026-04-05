// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, PlayerMastery } from '../types';
import { analyzeComp } from './compAnalysis';

const MATCHUP_MIN = -8;
const MATCHUP_MAX = 8;
const MASTERY_POINTS_MAX = 300000;

/**
 * Averages win-rate deltas of championId vs each enemy and normalizes to 0-1.
 * The matchups data provides deltas in percentage points (e.g. +3 means +3% win rate).
 * Maps the range [-8, +8] linearly onto [0, 1].
 */
export function calculateMatchupScore(
  championId: string,
  enemyIds: string[],
  matchups: Record<string, Record<string, number>>,
): number {
  const champMatchups = matchups[championId];
  if (!champMatchups || enemyIds.length === 0) return 0.5;

  const deltas: number[] = [];
  for (const enemyId of enemyIds) {
    if (typeof champMatchups[enemyId] === 'number') {
      deltas.push(champMatchups[enemyId]);
    }
  }

  if (deltas.length === 0) return 0.5;

  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

  // Clamp to expected range then normalize to [0, 1]
  const clamped = Math.max(MATCHUP_MIN, Math.min(MATCHUP_MAX, avgDelta));
  return (clamped - MATCHUP_MIN) / (MATCHUP_MAX - MATCHUP_MIN);
}

/**
 * Scores how well adding championId fixes weaknesses in the current team composition.
 * Returns a value in [0, 1].
 */
export function calculateCompNeedScore(
  championId: string,
  teamChampionIds: string[],
  allChampions: Champion[],
): number {
  const candidate = allChampions.find((c) => c.id === championId);
  if (!candidate) return 0;

  const analysis = analyzeComp(teamChampionIds, allChampions);

  let score = 0.5; // neutral baseline

  // Reward AP champion when team is heavy AD
  if (analysis.adRatio > 0.75 && candidate.damageType === 'AP') {
    score += 0.25;
  } else if (analysis.adRatio > 0.6 && candidate.damageType === 'AP') {
    score += 0.15;
  }

  // Reward AD champion when team is heavy AP
  if (analysis.apRatio > 0.75 && candidate.damageType === 'AD') {
    score += 0.25;
  } else if (analysis.apRatio > 0.6 && candidate.damageType === 'AD') {
    score += 0.15;
  }

  // Reward high CC champion when team has low CC
  if (analysis.totalCc < 8) {
    const ccContribution = Math.min(candidate.ccScore / 10, 0.2);
    score += ccContribution;
  }

  // Reward engage when team lacks it
  const candidateTags = candidate.tags.map((t) => t.toLowerCase());
  if (!analysis.hasEngage) {
    if (candidateTags.some((t) => t === 'engage' || t === 'initiator')) {
      score += 0.15;
    }
  }

  // Reward tank/frontline when team has no frontline
  const teamChampions = teamChampionIds
    .map((id) => allChampions.find((c) => c.id === id))
    .filter((c): c is Champion => c !== undefined);
  const allTeamTags = teamChampions.flatMap((c) => c.tags.map((t) => t.toLowerCase()));
  const hasTank = allTeamTags.some((t) => t === 'tank' || t === 'frontline');
  if (!hasTank && candidateTags.some((t) => t === 'tank' || t === 'frontline')) {
    score += 0.15;
  }

  // Reward poke when team lacks it
  if (!analysis.hasPoke && candidateTags.some((t) => t === 'poke' || t === 'harass')) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Scores player mastery on championId based on mastery points and win rate.
 * Returns a value in [0, 1].
 */
export function calculateMasteryScore(championId: string, masteries: PlayerMastery[]): number {
  const mastery = masteries.find((m) => m.championId === championId);
  if (!mastery) return 0;

  // Normalize mastery points to [0, 1]
  const pointsScore = Math.min(mastery.masteryPoints / MASTERY_POINTS_MAX, 1);

  // Normalize win rate from percentage (e.g. 56.2) to [0, 1]
  const winRateScore = Math.max(0, Math.min(1, mastery.winRate / 100));

  // Weight: 60% mastery points depth, 40% win rate performance
  return 0.6 * pointsScore + 0.4 * winRateScore;
}

// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion, CompAnalysis, PhaseStrength, Role } from '../types';

const ALL_ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

// ── Game phase power ratings per champion (early / mid / late, scale 1–3) ──
// 1 = weak, 2 = average, 3 = strong
const PHASE_MAP: Record<string, [number, number, number]> = {
  // Top — original
  darius:     [3, 2, 2], garen:      [2, 2, 2], fiora:       [2, 3, 3],
  ornn:       [1, 2, 3], camille:    [2, 3, 2], jax:         [1, 2, 3],
  aatrox:     [2, 3, 2], malphite:   [1, 2, 3], nasus:       [1, 2, 3],
  irelia:     [2, 3, 2],
  // Top — new
  akali:      [2, 3, 2], chogath:    [1, 2, 3], drmundo:     [1, 2, 3],
  gangplank:  [2, 3, 3], gnar:       [2, 2, 2], gwen:        [1, 2, 3],
  heimerdinger:[3,2, 2], illaoi:     [2, 2, 3], jayce:       [3, 2, 2],
  ksante:     [1, 2, 3], kayle:      [1, 1, 3], kennen:      [2, 3, 2],
  kled:       [3, 2, 2], maokai:     [2, 2, 3], mordekaiser: [2, 2, 3],
  olaf:       [3, 2, 1], pantheon:   [3, 2, 1], quinn:       [3, 2, 2],
  renekton:   [3, 2, 1], riven:      [2, 3, 2], rumble:      [2, 3, 2],
  ryze:       [1, 2, 3], sett:       [2, 3, 2], shen:        [2, 3, 2],
  singed:     [2, 2, 3], sion:       [1, 2, 3], teemo:       [2, 3, 2],
  trundle:    [2, 3, 2], tryndamere: [1, 2, 3], urgot:       [2, 2, 3],
  vayne:      [1, 2, 3], volibear:   [2, 3, 2], wukong:      [2, 3, 2],
  yorick:     [1, 2, 3], poppy:      [2, 3, 2], ambessa:     [2, 3, 2],
  // Jungle — original
  leesin:     [3, 3, 1], vi:         [2, 3, 2], elise:       [3, 2, 1],
  reksai:     [3, 2, 2], jarvaniv:   [2, 3, 2], graves:      [2, 3, 3],
  hecarim:    [1, 3, 2], nidalee:    [3, 2, 1], khazix:      [2, 3, 2],
  // Jungle — new
  amumu:      [2, 3, 2], belveth:    [2, 2, 3], briar:       [3, 2, 2],
  diana:      [2, 3, 2], ekko:       [2, 3, 2], evelynn:     [1, 3, 2],
  fiddlesticks:[1,2, 3], gragas:     [2, 3, 2], ivern:       [1, 2, 3],
  karthus:    [1, 2, 3], kayn:       [1, 3, 2], kindred:     [2, 2, 3],
  lillia:     [1, 2, 3], masteryi:   [1, 2, 3], naafiri:     [2, 3, 2],
  nocturne:   [2, 3, 2], nunu:       [2, 3, 2], rammus:      [2, 3, 2],
  rengar:     [3, 3, 1], sejuani:    [2, 3, 2], shaco:       [3, 2, 1],
  shyvana:    [1, 2, 3], skarner:    [2, 3, 2], taliyah:     [2, 3, 2],
  udyr:       [2, 3, 2], viego:      [1, 2, 3], warwick:     [3, 3, 2],
  xinzhao:    [3, 2, 2], zac:        [2, 3, 2],
  // Mid — original
  ahri:       [2, 3, 2], zed:        [2, 3, 2], syndra:      [2, 3, 2],
  orianna:    [1, 2, 3], yasuo:      [1, 2, 3], leblanc:     [3, 3, 1],
  viktor:     [1, 2, 3], lux:        [2, 2, 2], fizz:        [2, 3, 2],
  cassiopeia: [1, 2, 3], galio:      [2, 3, 2], lissandra:   [2, 3, 2],
  // Mid — new
  akshan:     [2, 3, 2], anivia:     [1, 2, 3], annie:       [2, 2, 2],
  aurelionsol:[1, 1, 3], azir:       [1, 2, 3], corki:       [1, 3, 2],
  hwei:       [1, 2, 3], kassadin:   [1, 2, 3], katarina:    [1, 3, 2],
  malzahar:   [1, 2, 3], qiyana:     [2, 3, 2], sylas:       [2, 3, 2],
  talon:      [2, 3, 2], twistedfate:[2, 3, 2], veigar:      [1, 2, 3],
  velkoz:     [2, 3, 2], vex:        [2, 3, 2], vladimir:    [1, 2, 3],
  xerath:     [2, 3, 2], yone:       [1, 2, 3], zilean:      [2, 2, 3],
  zoe:        [2, 3, 1],
  // ADC — original
  jinx:       [1, 2, 3], kaisa:      [2, 2, 3], ezreal:      [2, 3, 2],
  jhin:       [2, 3, 2], caitlyn:    [3, 2, 2], aphelios:    [1, 2, 3],
  missfortune:[2, 3, 2],
  // ADC — new
  ashe:       [2, 3, 2], draven:     [3, 3, 1], kalista:     [2, 3, 2],
  kogmaw:     [1, 2, 3], lucian:     [3, 3, 1], nilah:       [2, 3, 2],
  samira:     [2, 3, 2], seraphine:  [1, 2, 3], sivir:       [1, 3, 2],
  smolder:    [1, 2, 3], swain:      [1, 2, 3], tristana:    [2, 3, 2],
  twitch:     [1, 2, 3], varus:      [2, 3, 2], xayah:       [2, 2, 3],
  yunara:     [2, 3, 2], zeri:       [1, 2, 3],
  // Support — original
  thresh:     [3, 3, 2], lulu:       [2, 2, 3], nautilus:    [3, 3, 2],
  leona:      [3, 3, 2], yuumi:      [1, 2, 3], senna:       [2, 2, 3],
  blitzcrank: [3, 3, 2],
  // Support — new
  alistar:    [3, 3, 2], bard:       [2, 2, 3], brand:       [2, 3, 2],
  braum:      [3, 3, 2], janna:      [2, 3, 2], karma:       [2, 3, 2],
  mel:        [1, 2, 3], milio:      [2, 2, 3], morgana:     [2, 3, 2],
  nami:       [2, 3, 2], pyke:       [3, 3, 2], rakan:       [2, 3, 2],
  rell:       [2, 3, 2], renata:     [2, 2, 3], soraka:      [1, 2, 3],
  tahmkench:  [3, 2, 3], taric:      [2, 2, 3], zaahen:      [1, 2, 3],
  // New additions
  aurora:     [2, 3, 2], neeko:      [2, 3, 2], sona:        [1, 2, 3],
  ziggs:      [2, 3, 2], zyra:       [2, 3, 2],
};

function computePhaseStrength(teamChampions: Champion[]): PhaseStrength {
  if (teamChampions.length === 0) return { early: 0, mid: 0, late: 0 };

  let early = 0, mid = 0, late = 0;
  for (const c of teamChampions) {
    const [e, m, l] = PHASE_MAP[c.id] ?? [2, 2, 2];
    early += e;
    mid   += m;
    late  += l;
  }
  const n = teamChampions.length;
  // Scale to 0-10
  return {
    early: Math.round((early / n / 3) * 10),
    mid:   Math.round((mid   / n / 3) * 10),
    late:  Math.round((late  / n / 3) * 10),
  };
}

/** Returns a single champion's raw phase curve [early, mid, late] on a 1–3 scale. */
export function getChampionPhaseCurve(id: string): [number, number, number] {
  return PHASE_MAP[id] ?? [2, 2, 2];
}

/** Rough "draft score" out of 100 based on comp quality. */
export function draftScore(analysis: CompAnalysis): number {
  let score = 50;
  if (analysis.hasEngage)     score += 10;
  if (analysis.hasPoke)       score +=  5;
  if (analysis.hasSplitpush)  score +=  5;
  if (analysis.totalCc >= 20) score += 10;
  else if (analysis.totalCc >= 10) score += 5;
  if (analysis.adRatio >= 0.3 && analysis.adRatio <= 0.7) score += 10;
  score -= analysis.warnings.length * 5;
  return Math.max(0, Math.min(100, score));
}

export function analyzeComp(teamChampionIds: string[], allChampions: Champion[]): CompAnalysis {
  const teamChampions = teamChampionIds
    .map((id) => allChampions.find((c) => c.id === id))
    .filter((c): c is Champion => c !== undefined);

  // AD/AP ratio
  let adSum = 0;
  for (const champ of teamChampions) {
    if (champ.damageType === 'AD') adSum += 1.0;
    else if (champ.damageType === 'mixed') adSum += 0.5;
  }
  const adRatio = teamChampions.length > 0 ? adSum / teamChampions.length : 0;
  const apRatio = teamChampions.length > 0 ? 1 - adRatio : 0;

  const totalCc = teamChampions.reduce((sum, c) => sum + c.ccScore, 0);

  const allTags = teamChampions.flatMap((c) => c.tags.map((t) => t.toLowerCase()));
  const hasEngage    = allTags.some((t) => t === 'engage' || t === 'initiator');
  const hasPoke      = allTags.some((t) => t === 'poke' || t === 'harass');
  const hasSplitpush = allTags.some((t) => t === 'splitpush' || t === 'split push' || t === 'split-push');

  const coveredRoles = new Set<Role>(teamChampions.flatMap((c) => c.roles));
  const missingRoles = ALL_ROLES.filter((r) => !coveredRoles.has(r));

  const warnings: string[] = [];
  if (adRatio > 0.75)                      warnings.push('Triple AD - need AP damage');
  if (totalCc < 8)                          warnings.push('Low CC');
  if (!hasEngage)                           warnings.push('No engage');
  const hasTank = allTags.some((t) => t === 'tank' || t === 'frontline');
  if (!hasTank)                             warnings.push('No frontline');
  if (apRatio > 0.75)                       warnings.push('Heavy AP - consider some AD');
  if (hasSplitpush && !hasEngage)           warnings.push('Split push comp without engage');

  const phaseStrength = computePhaseStrength(teamChampions);

  return {
    adRatio, apRatio, totalCc,
    hasEngage, hasPoke, hasSplitpush,
    missingRoles, warnings, phaseStrength,
  };
}

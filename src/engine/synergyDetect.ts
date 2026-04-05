// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { Champion } from '../types';

export interface Synergy {
  id: string;
  label: string;
  description: string;
  strength: 'S' | 'A' | 'B';
  involvedIds: string[]; // champion ids that form this synergy
}

type SynergyRule = {
  id: string;
  label: string;
  description: string;
  strength: 'S' | 'A' | 'B';
  check: (ids: string[]) => string[] | null; // returns involved ids or null
};

// ── Specific champion-pair synergies ────────────────────────────────────────
const KNOCKUP_CHAMPS = ['malphite', 'jarvaniv', 'vi', 'ornn', 'reksai', 'hecarim', 'yasuo'];

const RULES: SynergyRule[] = [
  // ── S-tier wombo combos ─────────────────────────────────────────────────
  {
    id: 'yasuo-knockup',
    label: 'Wind Combo',
    description: 'Yasuo can use his ult immediately on every knockup',
    strength: 'S',
    check: (ids) => {
      if (!ids.includes('yasuo')) return null;
      const ku = ids.filter((id) => id !== 'yasuo' && KNOCKUP_CHAMPS.includes(id));
      return ku.length > 0 ? ['yasuo', ...ku] : null;
    },
  },
  {
    id: 'orianna-malphite',
    label: 'Clockwork Smash',
    description: 'Malphite ult + Orianna ball → massive 5-man shockwave',
    strength: 'S',
    check: (ids) =>
      ids.includes('orianna') && ids.includes('malphite') ? ['orianna', 'malphite'] : null,
  },
  {
    id: 'orianna-hecarim',
    label: 'Phantom Rush',
    description: 'Hecarim dashes through team, Orianna shockwave decimates them',
    strength: 'S',
    check: (ids) =>
      ids.includes('orianna') && ids.includes('hecarim') ? ['orianna', 'hecarim'] : null,
  },
  {
    id: 'thresh-jinx',
    label: 'Get Excited!',
    description: 'Thresh hooks set up Jinx resets perfectly',
    strength: 'A',
    check: (ids) =>
      ids.includes('thresh') && ids.includes('jinx') ? ['thresh', 'jinx'] : null,
  },
  {
    id: 'leona-caitlyn',
    label: 'Headshot Setup',
    description: 'Leona stuns let Caitlyn land free headshots and traps',
    strength: 'A',
    check: (ids) =>
      ids.includes('leona') && (ids.includes('caitlyn') || ids.includes('jinx') || ids.includes('jhin'))
        ? [ids.includes('caitlyn') ? 'caitlyn' : ids.includes('jinx') ? 'jinx' : 'jhin', 'leona']
        : null,
  },
  {
    id: 'yuumi-kaisa',
    label: 'Starbound',
    description: 'Yuumi attached to Kai\'Sa empowers her full combo and sustain',
    strength: 'A',
    check: (ids) =>
      ids.includes('yuumi') && ids.includes('kaisa') ? ['yuumi', 'kaisa'] : null,
  },
  {
    id: 'lulu-jinx',
    label: 'Hyper Growth',
    description: 'Lulu ult on Jinx lets her fully commit as a raid boss',
    strength: 'A',
    check: (ids) =>
      ids.includes('lulu') && (ids.includes('jinx') || ids.includes('kaisa') || ids.includes('aphelios'))
        ? ['lulu', ids.find((id) => ['jinx', 'kaisa', 'aphelios'].includes(id))!]
        : null,
  },
  {
    id: 'nautilus-leona',
    label: 'Double Hook',
    description: 'Two hard-engage supports create impossible-to-escape bot lane',
    strength: 'A',
    check: (ids) =>
      ids.includes('nautilus') && ids.includes('leona') ? ['nautilus', 'leona'] : null,
  },
  {
    id: 'hecarim-vi',
    label: 'Onslaught',
    description: 'Two unstoppable engage junglers dive the backline simultaneously',
    strength: 'A',
    check: (ids) =>
      ids.includes('hecarim') && ids.includes('vi') ? ['hecarim', 'vi'] : null,
  },

  // ── Tag-based composition synergies ────────────────────────────────────
  {
    id: 'poke-comp',
    label: 'Poke & Siege',
    description: 'Three+ poke champions harass before sieging objectives',
    strength: 'A',
    check: (_ids) => null, // handled via tag-based detection below
  },
  {
    id: 'full-engage',
    label: 'All-In Engage',
    description: 'Multiple engage champions create overwhelming wombo potential',
    strength: 'S',
    check: (_ids) => null, // handled via tag-based detection below
  },
  {
    id: 'splitpush-pressure',
    label: 'Dual Threat',
    description: 'Two split-pushers force enemy to spread thin across map',
    strength: 'B',
    check: (_ids) => null, // handled via tag-based detection below
  },
];

/** Detect synergies for a given list of champion IDs */
export function detectSynergies(championIds: string[], allChampions: Champion[]): Synergy[] {
  const ids = championIds.filter(Boolean);
  if (ids.length < 2) return [];

  const results: Synergy[] = [];
  const seen = new Set<string>();

  // Run specific pair/group rules
  for (const rule of RULES.slice(0, -3)) {
    // skip tag-based placeholders
    const involved = rule.check(ids);
    if (involved && !seen.has(rule.id)) {
      seen.add(rule.id);
      results.push({
        id: rule.id,
        label: rule.label,
        description: rule.description,
        strength: rule.strength,
        involvedIds: involved,
      });
    }
  }

  // Tag-based: count engage / poke / splitpush
  const champObjs = ids
    .map((id) => allChampions.find((c) => c.id === id))
    .filter((c): c is Champion => !!c);

  const engageChamps = champObjs.filter((c) =>
    c.tags.some((t) => t === 'engage' || t === 'initiator'),
  );
  const pokeChamps = champObjs.filter((c) =>
    c.tags.some((t) => t === 'poke' || t === 'harass'),
  );
  const splitChamps = champObjs.filter((c) =>
    c.tags.some((t) => t === 'splitpush' || t === 'split push'),
  );

  if (engageChamps.length >= 3 && !seen.has('full-engage')) {
    results.push({
      id: 'full-engage',
      label: 'All-In Engage',
      description: `${engageChamps.map((c) => c.name).join(', ')} — overwhelming dive potential`,
      strength: 'S',
      involvedIds: engageChamps.map((c) => c.id),
    });
  } else if (engageChamps.length === 2 && pokeChamps.length === 0 && !seen.has('engage-duo')) {
    results.push({
      id: 'engage-duo',
      label: 'Dive & Follow',
      description: 'Double engage creates hard disengage and pick potential',
      strength: 'B',
      involvedIds: engageChamps.map((c) => c.id),
    });
  }

  if (pokeChamps.length >= 3 && !seen.has('poke-comp')) {
    results.push({
      id: 'poke-comp',
      label: 'Poke & Siege',
      description: `${pokeChamps.map((c) => c.name).join(', ')} — chip damage before every objective`,
      strength: 'A',
      involvedIds: pokeChamps.map((c) => c.id),
    });
  }

  if (splitChamps.length >= 2 && !seen.has('splitpush-pressure')) {
    results.push({
      id: 'splitpush-pressure',
      label: 'Dual Threat',
      description: `${splitChamps.map((c) => c.name).join(' & ')} — enemy can\'t cover both splits`,
      strength: 'B',
      involvedIds: splitChamps.map((c) => c.id),
    });
  }

  // Damage-balance reward
  const adCount = champObjs.filter((c) => c.damageType === 'AD').length;
  const apCount = champObjs.filter((c) => c.damageType === 'AP').length;
  if (adCount >= 2 && apCount >= 2 && !seen.has('damage-balance')) {
    results.push({
      id: 'damage-balance',
      label: 'Balanced Threat',
      description: 'Mixed AD/AP makes it impossible for enemy to itemise defensively',
      strength: 'B',
      involvedIds: champObjs
        .filter((c) => c.damageType === 'AD' || c.damageType === 'AP')
        .slice(0, 4)
        .map((c) => c.id),
    });
  }

  // Sort: S first, then A, then B
  const order = { S: 0, A: 1, B: 2 };
  return results.sort((a, b) => order[a.strength] - order[b.strength]).slice(0, 4);
}

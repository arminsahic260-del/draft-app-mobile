// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support';
export type DamageType = 'AD' | 'AP' | 'mixed';
export type Team = 'blue' | 'red';
export type DraftAction = 'pick' | 'ban';

export interface Champion {
  id: string;
  name: string;
  ddragonId: string;
  roles: Role[];
  damageType: DamageType;
  tags: string[];
  ccScore: number; // 0-10
  imageUrl: string;
}

export interface PlayerMastery {
  championId: string;
  masteryLevel: number;
  masteryPoints: number;
  gamesPlayed: number;
  winRate: number;
}

export interface PlayerProfile {
  summonerName: string;
  tagLine: string;
  /** Riot PUUID — used to correlate drafts with post-game match results. */
  puuid?: string;
  /** Platform region (e.g. "euw1") — same scope as the summoner lookup. */
  region?: string;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  masteries: PlayerMastery[];
}

export interface DraftSlot {
  championId: string | null;
  team: Team;
  role?: Role;
}

export interface BanSlot {
  championId: string | null;
  team: Team;
}

export interface DraftState {
  phase: 'bans' | 'picks' | 'complete';
  currentAction: DraftAction;
  currentTeam: Team;
  playerTeam: Team;
  playerRole: Role;
  picks: { blue: (string | null)[]; red: (string | null)[] };
  bans:  { blue: (string | null)[]; red: (string | null)[] };
  /** Role assigned to each pick slot (index 0-4 = top/jgl/mid/adc/sup by default) */
  pickRoles: { blue: (Role | null)[]; red: (Role | null)[] };
  timer: number;
}

export interface Recommendation {
  championId: string;
  championName: string;
  finalScore: number;
  matchupScore: number;
  compNeedScore: number;
  masteryScore: number;
  winProbability: number;
  reasoning: string;
  /** Best enemy counter target this pick exploits */
  counterTarget?: { championId: string; championName: string; delta: number };
}

export interface PhaseStrength {
  early: number; // 0-10
  mid:   number;
  late:  number;
}

export interface CompAnalysis {
  adRatio: number;
  apRatio: number;
  totalCc: number;
  hasEngage: boolean;
  hasPoke: boolean;
  hasSplitpush: boolean;
  missingRoles: Role[];
  warnings: string[];
  /** Average early/mid/late power curve (0-10 each) */
  phaseStrength: PhaseStrength;
}

export interface LiveDraftEvent {
  type: 'session_start' | 'session_update' | 'session_end';
  playerTeam?: Team;
  playerRole?: Role;
  bans?:      { blue: (string | null)[]; red: (string | null)[] };
  picks?:     { blue: (string | null)[]; red: (string | null)[] };
  pickRoles?: { blue: (Role | null)[]; red: (Role | null)[] };
  phase?:     DraftState['phase'];
  timer?:     number;
  reason?:    string; // for session_end
}

export interface LcuStatus {
  clientDetected: boolean;
  connected:      boolean;
  inChampSelect:  boolean;
  port:           number | null;
}

export type AppScreen = 'setup' | 'draft' | 'recommendations' | 'history' | 'terms';

export interface EnemyMastery {
  puuid: string;
  championId: string;
  points: number;
  level: number;
}

export interface DraftMatchResult {
  matchId: string;
  won: boolean;
  championId: string | null;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  gold: number;
  durationSec: number;
  gameEndMs: number;
  queueId: number | null;
  reviewedAt: string;
  /** Top-mastery pick per enemy player. Missing on pre-2026-04-22 reviews. */
  enemyMasteries?: EnemyMastery[];
}

export type DraftReviewStatus =
  | { kind: 'pending' }
  | { kind: 'reviewed'; result: DraftMatchResult }
  | { kind: 'no-match'; reason: string; checkedAt: string };

export interface LocalDraftRecord {
  id: string;
  createdAt: string;
  playerRole: string;
  picks: { blue: (string | null)[]; red: (string | null)[] };
  bans:  { blue: (string | null)[]; red: (string | null)[] };
  topRecommendation?: string;
  blueScore: number;
  redScore: number;
  summoner?: {
    puuid: string;
    region: string;
    name: string;
    tag: string;
  };
  review?: DraftReviewStatus;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isPro: boolean;
  dailyDraftCount: number;
  lastDraftDate: string;
}

export interface SavedDraft {
  id?: string;
  uid: string;
  createdAt: string;
  playerRole: Role;
  picks: { blue: (string | null)[]; red: (string | null)[] };
  bans:  { blue: (string | null)[]; red: (string | null)[] };
  topRecommendation?: string; // championId
}

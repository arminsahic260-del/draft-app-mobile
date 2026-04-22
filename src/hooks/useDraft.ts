// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useReducer, useMemo } from 'react';
import type { DraftState, DraftAction, Role, Team, LiveDraftEvent } from '../types';

const DEFAULT_ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

// Solo-queue ranked format: all 10 bans up front (5 per team, alternating),
// then all 10 picks. See web useDraft.ts for the same rationale.
const PHASE_BAN_LIMITS: Record<DraftState['phase'], number> = {
  bans: 5, picks: 0, complete: 0,
};

const PHASE_PICK_LIMITS: Record<DraftState['phase'], number> = {
  bans: 0, picks: 5, complete: 0,
};

function makeInitialState(playerRole: Role, playerTeam: Team): DraftState {
  return {
    phase: 'bans',
    currentAction: 'ban',
    currentTeam: 'blue',
    playerTeam,
    playerRole,
    picks: { blue: [null, null, null, null, null], red: [null, null, null, null, null] },
    bans:  { blue: [null, null, null, null, null], red: [null, null, null, null, null] },
    pickRoles: {
      blue: [...DEFAULT_ROLES] as (Role | null)[],
      red:  [...DEFAULT_ROLES] as (Role | null)[],
    },
    timer: 30,
  };
}

type ReducerAction =
  | { type: 'PICK_CHAMPION'; championId: string; team: Team }
  | { type: 'BAN_CHAMPION';  championId: string; team: Team }
  | { type: 'SET_ACTION';    action: DraftAction; team: Team }
  | { type: 'SET_ROLE';      team: Team; slotIndex: number; role: Role }
  | { type: 'UNDO' }
  | { type: 'RESET'; playerRole: Role; playerTeam: Team }
  | { type: 'SYNC_LIVE'; event: LiveDraftEvent };

interface DraftWithHistory {
  current: DraftState;
  history: DraftState[];
}

function makeInitialWithHistory(playerRole: Role, playerTeam: Team): DraftWithHistory {
  return { current: makeInitialState(playerRole, playerTeam), history: [] };
}

function fillNextSlot(slots: (string | null)[], value: string): (string | null)[] {
  const copy = [...slots];
  const idx = copy.indexOf(null);
  if (idx !== -1) copy[idx] = value;
  return copy;
}

function countFilled(slots: (string | null)[]): number {
  return slots.filter((s) => s !== null).length;
}

function draftReducer(state: DraftWithHistory, action: ReducerAction): DraftWithHistory {
  const draft = state.current;

  switch (action.type) {
    case 'BAN_CHAMPION': {
      const { championId, team } = action;
      if (PHASE_BAN_LIMITS[draft.phase] === 0) return state;

      const newBans = { ...draft.bans, [team]: fillNextSlot(draft.bans[team], championId) };
      const phaseComplete = countFilled(newBans.blue) >= 5 && countFilled(newBans.red) >= 5;

      // Solo-queue bans are simultaneous (all 10 players ban in parallel), so
      // we don't flip currentTeam between bans. The phase exit transitions to
      // blue first pick.
      const next: DraftState = phaseComplete
        ? { ...draft, bans: newBans, phase: 'picks', currentAction: 'pick', currentTeam: 'blue' }
        : { ...draft, bans: newBans };
      return { current: next, history: [...state.history, draft] };
    }

    case 'PICK_CHAMPION': {
      const { championId, team } = action;
      if (PHASE_PICK_LIMITS[draft.phase] === 0) return state;

      const newPicks = { ...draft.picks, [team]: fillNextSlot(draft.picks[team], championId) };
      const phaseComplete = countFilled(newPicks.blue) >= 5 && countFilled(newPicks.red) >= 5;

      const next: DraftState = phaseComplete
        ? { ...draft, picks: newPicks, phase: 'complete', currentTeam: 'blue' }
        : { ...draft, picks: newPicks, currentTeam: team === 'blue' ? 'red' : 'blue' };
      return { current: next, history: [...state.history, draft] };
    }

    case 'SET_ACTION':
      return {
        current: { ...draft, currentAction: action.action, currentTeam: action.team },
        history: state.history,
      };

    case 'SET_ROLE': {
      const { team, slotIndex, role } = action;
      const newRoles = [...draft.pickRoles[team]] as (Role | null)[];
      newRoles[slotIndex] = role;
      return {
        current: { ...draft, pickRoles: { ...draft.pickRoles, [team]: newRoles } },
        history: state.history,
      };
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      return {
        current: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
      };
    }

    case 'RESET':
      return makeInitialWithHistory(action.playerRole, action.playerTeam);

    case 'SYNC_LIVE': {
      const e = action.event;
      const next: DraftState = {
        ...draft,
        ...(e.playerTeam  !== undefined && { playerTeam: e.playerTeam }),
        ...(e.playerRole  !== undefined && { playerRole: e.playerRole }),
        ...(e.phase       !== undefined && { phase: e.phase }),
        ...(e.timer       !== undefined && { timer: e.timer }),
        ...(e.bans        !== undefined && { bans: e.bans }),
        ...(e.picks       !== undefined && { picks: e.picks }),
        ...(e.pickRoles   !== undefined && { pickRoles: e.pickRoles }),
        currentAction: e.phase?.startsWith('ban') ? 'ban' : 'pick',
        currentTeam: draft.currentTeam,
      };
      // No history tracking in live mode (undo is meaningless)
      return { current: next, history: [] };
    }

    default:
      return state;
  }
}

export function useDraft(playerRole: Role, playerTeam: Team) {
  const [state, dispatch] = useReducer(
    draftReducer,
    undefined,
    () => makeInitialWithHistory(playerRole, playerTeam),
  );

  const draft   = state.current;
  const canUndo = state.history.length > 0;

  const pickChampion = (championId: string, team: Team) =>
    dispatch({ type: 'PICK_CHAMPION', championId, team });

  const banChampion = (championId: string, team: Team) =>
    dispatch({ type: 'BAN_CHAMPION', championId, team });

  const setAction = (action: DraftAction, team: Team) =>
    dispatch({ type: 'SET_ACTION', action, team });

  const setRole = (team: Team, slotIndex: number, role: Role) =>
    dispatch({ type: 'SET_ROLE', team, slotIndex, role });

  const undo     = () => dispatch({ type: 'UNDO' });
  const reset    = () => dispatch({ type: 'RESET', playerRole, playerTeam });
  const syncLive = (event: LiveDraftEvent) => dispatch({ type: 'SYNC_LIVE', event });

  const allPickedOrBanned = useMemo<string[]>(() => {
    const ids: string[] = [];
    for (const slot of [...draft.picks.blue, ...draft.picks.red, ...draft.bans.blue, ...draft.bans.red]) {
      if (slot) ids.push(slot);
    }
    return ids;
  }, [draft.picks, draft.bans]);

  return { draft, pickChampion, banChampion, setAction, setRole, undo, canUndo, reset, syncLive, allPickedOrBanned };
}

// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useReducer, useMemo } from 'react';
import type { DraftState, DraftAction, Role, Team, LiveDraftEvent } from '../types';

const DEFAULT_ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];

const PHASE_BAN_LIMITS: Record<DraftState['phase'], number> = {
  bans1: 3, picks1: 0, bans2: 2, picks2: 0, complete: 0,
};

const PHASE_PICK_LIMITS: Record<DraftState['phase'], number> = {
  bans1: 0, picks1: 3, bans2: 0, picks2: 2, complete: 0,
};

const PHASE_ORDER: DraftState['phase'][] = ['bans1', 'picks1', 'bans2', 'picks2', 'complete'];

function nextPhase(current: DraftState['phase']): DraftState['phase'] {
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
}

function makeInitialState(playerRole: Role, playerTeam: Team): DraftState {
  return {
    phase: 'bans1',
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
      const blueFilled = countFilled(newBans.blue);
      const redFilled  = countFilled(newBans.red);
      const endBlue = draft.phase === 'bans1' ? 3 : 5;
      const endRed  = draft.phase === 'bans1' ? 3 : 5;
      const phaseComplete = blueFilled >= endBlue && redFilled >= endRed;

      let next: DraftState;
      if (phaseComplete) {
        const np = nextPhase(draft.phase);
        next = {
          ...draft, bans: newBans, phase: np,
          currentAction: np === 'complete' ? 'ban' : PHASE_PICK_LIMITS[np] > 0 ? 'pick' : 'ban',
          currentTeam: 'blue',
        };
      } else {
        next = { ...draft, bans: newBans, currentTeam: team === 'blue' ? 'red' : 'blue' };
      }
      return { current: next, history: [...state.history, draft] };
    }

    case 'PICK_CHAMPION': {
      const { championId, team } = action;
      if (PHASE_PICK_LIMITS[draft.phase] === 0) return state;

      const newPicks = { ...draft.picks, [team]: fillNextSlot(draft.picks[team], championId) };
      const blueFilled = countFilled(newPicks.blue);
      const redFilled  = countFilled(newPicks.red);
      const endBlue = draft.phase === 'picks1' ? 3 : 5;
      const endRed  = draft.phase === 'picks1' ? 3 : 5;
      const phaseComplete = blueFilled >= endBlue && redFilled >= endRed;

      let next: DraftState;
      if (phaseComplete) {
        const np = nextPhase(draft.phase);
        next = {
          ...draft, picks: newPicks, phase: np,
          currentAction: np === 'complete' ? 'pick' : PHASE_BAN_LIMITS[np] > 0 ? 'ban' : 'pick',
          currentTeam: 'blue',
        };
      } else {
        next = { ...draft, picks: newPicks, currentTeam: team === 'blue' ? 'red' : 'blue' };
      }
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

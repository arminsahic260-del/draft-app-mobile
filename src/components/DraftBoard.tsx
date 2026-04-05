// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Pressable } from 'react-native';
import type { Champion, DraftState, Role, Team } from '../types';
import ChampionCard from './ChampionCard';

interface DraftBoardProps {
  draft: DraftState;
  champions: Champion[];
  onRoleChange?: (team: Team, slotIndex: number, role: Role) => void;
}

const PHASES: DraftState['phase'][] = ['bans1', 'picks1', 'bans2', 'picks2', 'complete'];

const PHASE_LABELS: Record<DraftState['phase'], string> = {
  bans1: 'Ban Phase 1', picks1: 'Pick Phase 1',
  bans2: 'Ban Phase 2', picks2: 'Pick Phase 2',
  complete: 'Draft Complete',
};

const PHASE_SHORT: Record<DraftState['phase'], string> = {
  bans1: 'B1', picks1: 'P1', bans2: 'B2', picks2: 'P2', complete: '\u2713',
};

const ALL_ROLES: Role[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const ROLE_ICONS: Record<Role, string> = {
  top: '\uD83D\uDDE1\uFE0F', jungle: '\uD83C\uDF3F', mid: '\u2726', adc: '\uD83C\uDFF9', support: '\uD83D\uDC9B',
};
const ROLE_ABBR: Record<Role, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

function PhaseProgressBar({ phase }: { phase: DraftState['phase'] }) {
  const currentIdx = PHASES.indexOf(phase);
  return (
    <View className="flex-row items-center gap-0.5 w-full px-1">
      {PHASES.slice(0, -1).map((p, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <View key={p} className="flex-row items-center flex-1">
            <View className="flex-1 items-center gap-0.5">
              <View className={`w-full h-1.5 rounded-full ${
                isDone ? 'bg-lol-gold'
                : isCurrent ? 'bg-lol-gold/60'
                : 'bg-lol-border'
              }`} />
              <Text className={`text-[8px] font-bold tracking-wide ${
                isDone ? 'text-lol-gold'
                : isCurrent ? 'text-lol-gold/80'
                : 'text-lol-text/30'
              }`}>
                {PHASE_SHORT[p]}
              </Text>
            </View>
            {i < 3 && (
              <View className={`h-px w-2 mx-0.5 ${i < currentIdx ? 'bg-lol-gold' : 'bg-lol-border'}`} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function findChampion(champions: Champion[], id: string | null): Champion | undefined {
  if (!id) return undefined;
  return champions.find((c) => c.id === id);
}

function EmptyPickSlot({ active, team }: { active?: boolean; team: 'blue' | 'red' }) {
  const borderColor = team === 'blue' ? 'border-lol-blue/30' : 'border-lol-red/30';
  const activeBorder = team === 'blue' ? 'border-lol-blue' : 'border-lol-red';
  return (
    <View className={`w-12 h-12 rounded-md border-2 bg-lol-darker items-center justify-center ${
      active ? activeBorder : borderColor
    }`}>
      {active && <Text className="text-lol-text text-xs font-medium opacity-60">?</Text>}
    </View>
  );
}

function EmptyBanSlot({ active, team }: { active?: boolean; team: 'blue' | 'red' }) {
  const borderColor = team === 'blue' ? 'border-lol-blue/20' : 'border-lol-red/20';
  const activeBorder = team === 'blue' ? 'border-lol-blue/80' : 'border-lol-red/80';
  return (
    <View className={`w-8 h-8 rounded border-2 bg-lol-darker items-center justify-center ${
      active ? activeBorder : borderColor
    }`}>
      {active && <Text className="text-lol-text text-[9px] opacity-50">?</Text>}
    </View>
  );
}

function getActiveSlotInfo(draft: DraftState): { team: Team; type: 'pick' | 'ban'; index: number } | null {
  if (draft.phase === 'complete') return null;
  const type = draft.currentAction;
  const team = draft.currentTeam;
  const slots = type === 'pick' ? draft.picks[team] : draft.bans[team];
  const nextIndex = slots.findIndex((s) => s === null);
  if (nextIndex === -1) return null;
  return { team, type, index: nextIndex };
}

function TeamColumn({
  team, label, picks, bans, pickRoles, champions, activeSlot, onRoleChange,
}: {
  team: Team;
  label: string;
  picks: (string | null)[];
  bans: (string | null)[];
  pickRoles: (Role | null)[];
  champions: Champion[];
  activeSlot: ReturnType<typeof getActiveSlotInfo>;
  onRoleChange?: (team: Team, slotIndex: number, role: Role) => void;
}) {
  const labelColor = team === 'blue' ? 'text-lol-blue' : 'text-lol-red';

  const cycleRole = (slotIndex: number) => {
    if (!onRoleChange) return;
    const current = pickRoles[slotIndex] ?? ALL_ROLES[slotIndex] ?? ALL_ROLES[0];
    const nextIdx = (ALL_ROLES.indexOf(current) + 1) % ALL_ROLES.length;
    onRoleChange(team, slotIndex, ALL_ROLES[nextIdx]);
  };

  return (
    <View className="gap-2 items-center flex-1">
      <Text className={`font-bold text-sm tracking-wide uppercase ${labelColor}`}>{label}</Text>

      {/* Ban row */}
      <View className="flex-row gap-1 flex-wrap justify-center">
        {bans.map((banId, i) => {
          const champ = findChampion(champions, banId);
          const isActive = activeSlot?.team === team && activeSlot?.type === 'ban' && activeSlot?.index === i;
          return champ
            ? <ChampionCard key={i} champion={champ} banned size="sm" />
            : <EmptyBanSlot key={i} active={isActive} team={team} />;
        })}
      </View>

      <View className="w-full h-px bg-lol-border opacity-40" />

      {/* Pick column */}
      <View className="gap-1 items-center w-full">
        {picks.map((pickId, i) => {
          const champ = findChampion(champions, pickId);
          const isActive = activeSlot?.team === team && activeSlot?.type === 'pick' && activeSlot?.index === i;
          const role = pickRoles[i] ?? ALL_ROLES[i] ?? null;

          return (
            <View key={i} className="flex-row items-center gap-1 justify-center">
              <Pressable
                onPress={() => cycleRole(i)}
                className="w-6 items-center py-0.5 rounded border bg-lol-darker border-lol-border"
              >
                <Text className="text-[8px]">{role ? ROLE_ICONS[role] : '\u2013'}</Text>
                <Text className="text-[7px] text-lol-text-bright leading-tight">{role ? ROLE_ABBR[role] : ''}</Text>
              </Pressable>

              {champ
                ? <ChampionCard champion={champ} selected={false} size="md" />
                : <EmptyPickSlot active={isActive} team={team} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function DraftBoard({ draft, champions, onRoleChange }: DraftBoardProps) {
  const activeSlot = getActiveSlotInfo(draft);

  return (
    <View className="items-center gap-2 w-full">
      <Text className={`font-semibold tracking-widest uppercase text-sm ${
        draft.phase === 'complete' ? 'text-lol-green' : 'text-lol-gold'
      }`}>
        {PHASE_LABELS[draft.phase]}
      </Text>

      <PhaseProgressBar phase={draft.phase} />

      <View className="flex-row items-start gap-2 w-full justify-center">
        <TeamColumn
          team="blue" label="Blue Side"
          picks={draft.picks.blue} bans={draft.bans.blue}
          pickRoles={draft.pickRoles.blue}
          champions={champions} activeSlot={activeSlot}
          onRoleChange={onRoleChange}
        />
        <View className="items-center pt-6 gap-1 opacity-30">
          <View className="w-px h-8 bg-lol-border" />
          <Text className="text-lol-text text-xs">VS</Text>
          <View className="w-px h-8 bg-lol-border" />
        </View>
        <TeamColumn
          team="red" label="Red Side"
          picks={draft.picks.red} bans={draft.bans.red}
          pickRoles={draft.pickRoles.red}
          champions={champions} activeSlot={activeSlot}
          onRoleChange={onRoleChange}
        />
      </View>
    </View>
  );
}

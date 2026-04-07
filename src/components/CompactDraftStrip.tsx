// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Image } from 'react-native';
import type { Champion, DraftState, Role, Team } from '../types';
import { getChampionImageUrl } from './ChampionCard';

const PHASES: DraftState['phase'][] = ['bans1', 'picks1', 'bans2', 'picks2'];
const PHASE_SHORT: Record<string, string> = {
  bans1: 'B1', picks1: 'P1', bans2: 'B2', picks2: 'P2', complete: '\u2713',
};
const PHASE_LABEL: Record<string, string> = {
  bans1: 'Ban Phase 1', picks1: 'Pick Phase 1',
  bans2: 'Ban Phase 2', picks2: 'Pick Phase 2',
  complete: 'Draft Complete',
};
const ROLE_ABBR: Record<Role, string> = {
  top: 'T', jungle: 'J', mid: 'M', adc: 'A', support: 'S',
};

interface Props {
  draft: DraftState;
  champions: Champion[];
}

function SlotIcon({ id, champions, size, banned, active, team }: {
  id: string | null; champions: Champion[]; size: number;
  banned?: boolean; active?: boolean; team: Team;
}) {
  const champ = id ? champions.find(c => c.id === id) : null;
  const border = active
    ? (team === 'blue' ? 'border-lol-blue' : 'border-lol-red')
    : (team === 'blue' ? 'border-lol-blue/25' : 'border-lol-red/25');

  if (champ) {
    return (
      <View style={{ width: size, height: size, borderWidth: 1.5 }} className={`rounded overflow-hidden ${border}`}>
        <Image
          source={{ uri: getChampionImageUrl(champ.ddragonId) }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
        {banned && (
          <View className="absolute inset-0 bg-black/60 items-center justify-center">
            <Text className="text-red-500 font-black text-xs">{'\u2715'}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderWidth: active ? 2 : 1 }}
      className={`rounded bg-lol-darker items-center justify-center ${border}`}
    >
      {active && <Text className="text-lol-text/40 text-[8px]">?</Text>}
    </View>
  );
}

export default function CompactDraftStrip({ draft, champions }: Props) {
  const currentIdx = PHASES.indexOf(draft.phase);
  const isComplete = draft.phase === 'complete';

  const activeTeam = draft.currentTeam;
  const activeType = draft.currentAction;

  function isSlotActive(team: Team, type: 'ban' | 'pick', index: number) {
    if (isComplete) return false;
    if (activeTeam !== team || activeType !== type) return false;
    const slots = type === 'pick' ? draft.picks[team] : draft.bans[team];
    return slots.findIndex(s => s === null) === index;
  }

  return (
    <View className="bg-lol-darker border-b border-lol-border px-3 py-2 gap-1.5">
      {/* Phase bar */}
      <View className="flex-row items-center gap-2">
        <Text className={`text-[11px] font-bold uppercase tracking-wide flex-1 ${
          isComplete ? 'text-lol-green' : 'text-lol-gold'
        }`}>
          {PHASE_LABEL[draft.phase]}
        </Text>
        <View className="flex-row items-center gap-0.5">
          {PHASES.map((p, i) => (
            <View key={p} className={`h-1 w-6 rounded-full ${
              isComplete ? 'bg-lol-gold'
              : i < currentIdx ? 'bg-lol-gold'
              : i === currentIdx ? 'bg-lol-gold/60'
              : 'bg-lol-border'
            }`} />
          ))}
        </View>
      </View>

      {/* Bans row */}
      <View className="flex-row items-center">
        <View className="flex-row gap-1 flex-1">
          {draft.bans.blue.map((id, i) => (
            <SlotIcon key={`bb${i}`} id={id} champions={champions} size={22}
              banned={!!id} active={isSlotActive('blue', 'ban', i)} team="blue" />
          ))}
        </View>
        <Text className="text-lol-text/20 text-[9px] font-bold mx-2">VS</Text>
        <View className="flex-row gap-1 flex-1 justify-end">
          {draft.bans.red.map((id, i) => (
            <SlotIcon key={`br${i}`} id={id} champions={champions} size={22}
              banned={!!id} active={isSlotActive('red', 'ban', i)} team="red" />
          ))}
        </View>
      </View>

      {/* Picks row */}
      <View className="flex-row items-end">
        <View className="flex-row gap-0.5 flex-1">
          {draft.picks.blue.map((id, i) => (
            <View key={`pb${i}`} className="items-center">
              <SlotIcon id={id} champions={champions} size={28}
                active={isSlotActive('blue', 'pick', i)} team="blue" />
              <Text className="text-[7px] text-lol-text/40 mt-0.5">
                {ROLE_ABBR[draft.pickRoles.blue[i] as Role] ?? '-'}
              </Text>
            </View>
          ))}
        </View>
        <View className="mx-1.5" />
        <View className="flex-row gap-0.5 flex-1 justify-end">
          {draft.picks.red.map((id, i) => (
            <View key={`pr${i}`} className="items-center">
              <SlotIcon id={id} champions={champions} size={28}
                active={isSlotActive('red', 'pick', i)} team="red" />
              <Text className="text-[7px] text-lol-text/40 mt-0.5">
                {ROLE_ABBR[draft.pickRoles.red[i] as Role] ?? '-'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

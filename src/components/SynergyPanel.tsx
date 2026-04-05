// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text } from 'react-native';
import type { Synergy } from '../engine/synergyDetect';
import type { Team } from '../types';

interface SynergyPanelProps {
  synergies: Synergy[];
  team: Team;
}

const STRENGTH_BADGE: Record<Synergy['strength'], string> = {
  S: 'bg-yellow-400 text-black',
  A: 'bg-lol-green text-lol-dark',
  B: 'bg-lol-blue text-white',
};

const STRENGTH_GLOW: Record<Synergy['strength'], string> = {
  S: 'border-yellow-400/30 bg-yellow-400/5',
  A: 'border-lol-green/30 bg-lol-green/5',
  B: 'border-lol-blue/20 bg-lol-blue/5',
};

export default function SynergyPanel({ synergies, team }: SynergyPanelProps) {
  if (synergies.length === 0) return null;

  const teamColor = team === 'blue' ? 'text-lol-blue' : 'text-lol-red';

  return (
    <View className="bg-lol-card border border-lol-border rounded-lg px-3 py-2.5 gap-2">
      <Text className={`text-xs font-bold uppercase tracking-wide ${teamColor}`}>
        {team === 'blue' ? 'Blue' : 'Red'} Synergies
      </Text>

      <View className="gap-1.5">
        {synergies.map((syn) => (
          <View
            key={syn.id}
            className={`flex-row items-start gap-2 rounded-md border px-2 py-1.5 ${STRENGTH_GLOW[syn.strength]}`}
          >
            <Text className={`text-[9px] font-black px-1 py-px rounded mt-px ${STRENGTH_BADGE[syn.strength]}`}>
              {syn.strength}
            </Text>
            <View className="min-w-0 flex-1">
              <Text className="text-xs font-semibold text-lol-text-bright leading-tight">
                {syn.label}
              </Text>
              <Text className="text-[10px] text-lol-text leading-snug mt-0.5">
                {syn.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

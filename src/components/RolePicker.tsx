// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Pressable } from 'react-native';
import type { Role } from '../types';

interface RolePickerProps {
  selected: Role | null;
  onSelect: (role: Role) => void;
}

const ROLES: { role: Role; abbr: string; icon: string }[] = [
  { role: 'top',     abbr: 'TOP', icon: '⚔️' },
  { role: 'jungle',  abbr: 'JGL', icon: '🌿' },
  { role: 'mid',     abbr: 'MID', icon: '⚡' },
  { role: 'adc',     abbr: 'ADC', icon: '🏹' },
  { role: 'support', abbr: 'SUP', icon: '🛡️' },
];

export default function RolePicker({ selected, onSelect }: RolePickerProps) {
  return (
    <View className="flex-row gap-1.5">
      {ROLES.map(({ role, abbr, icon }) => {
        const isSelected = selected === role;
        return (
          <Pressable
            key={role}
            onPress={() => onSelect(role)}
            className={`flex-1 items-center justify-center gap-0.5 px-2 py-2 rounded-md border ${
              isSelected
                ? 'border-lol-gold bg-lol-gold/10'
                : 'border-lol-border bg-lol-card'
            }`}
          >
            <Text className="text-base leading-none">{icon}</Text>
            <Text className={`text-[10px] tracking-wide leading-none font-medium ${
              isSelected ? 'text-lol-gold' : 'text-lol-text'
            }`}>
              {abbr}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

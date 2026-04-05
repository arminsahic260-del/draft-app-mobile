// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Pressable, ScrollView, Modal, Image } from 'react-native';
import type { BanSuggestion } from '../engine/banRecommend';
import { getChampionImageUrl } from './ChampionCard';

const TIER_BG: Record<string, string> = {
  S: 'bg-yellow-400', A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-gray-500',
};
const TIER_TEXT: Record<string, string> = {
  S: 'text-black', A: 'text-white', B: 'text-white', C: 'text-white',
};

interface PreDraftBansModalProps {
  suggestions: BanSuggestion[];
  onBan: (championId: string) => void;
  onClose: () => void;
  playerRole: string;
}

export default function PreDraftBansModal({ suggestions, onBan, onClose, playerRole }: PreDraftBansModalProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/75 justify-center items-center px-4">
        <View className="bg-lol-card border border-lol-border rounded-xl w-full max-w-md overflow-hidden">

          {/* Header */}
          <View className="px-5 pt-5 pb-3 border-b border-lol-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lol-gold font-bold text-base uppercase tracking-wider">
                  Pre-Draft: Suggested Bans
                </Text>
                <Text className="text-lol-text text-xs mt-0.5">
                  Based on your <Text className="text-lol-text-bright font-semibold">{playerRole.toUpperCase()}</Text> role
                </Text>
              </View>
              <Text className="text-[10px] text-lol-text/50 bg-lol-darker px-2 py-1 rounded border border-lol-border">
                Tap to ban
              </Text>
            </View>
          </View>

          {/* Ban list */}
          <ScrollView className="max-h-80 px-4 py-3" contentContainerClassName="gap-2">
            {suggestions.map((ban, i) => (
              <Pressable
                key={ban.championId}
                onPress={() => onBan(ban.championId)}
                className="flex-row items-center gap-3 p-2.5 rounded-lg border border-lol-border bg-lol-darker"
              >
                <Text className="text-xs text-lol-text/40 font-bold w-4">{i + 1}</Text>
                <Image
                  source={{ uri: getChampionImageUrl(ban.ddragonId) }}
                  className="w-10 h-10 rounded border border-lol-border"
                  resizeMode="cover"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm text-lol-text-bright font-semibold">{ban.championName}</Text>
                    <Text className={`text-[9px] font-black px-1 py-px rounded ${TIER_BG[ban.tier] ?? 'bg-gray-600'} ${TIER_TEXT[ban.tier] ?? 'text-white'}`}>
                      {ban.tier}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-lol-text mt-0.5" numberOfLines={1}>{ban.reason}</Text>
                </View>
                <Text className="text-[10px] text-lol-red font-bold">Ban {'\u2715'}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Footer */}
          <View className="px-4 pb-4 pt-1 flex-row gap-2">
            <Pressable onPress={onClose} className="flex-1 py-2.5 rounded-lg bg-lol-gold items-center">
              <Text className="text-lol-dark font-bold text-sm">Start Draft {'\u2192'}</Text>
            </Pressable>
            <Pressable onPress={onClose} className="px-4 py-2.5 rounded-lg bg-lol-darker border border-lol-border items-center">
              <Text className="text-lol-text text-xs">Skip</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

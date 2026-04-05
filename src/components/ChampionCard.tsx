// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import type { Champion, PlayerMastery } from '../types';

const DDRAGON_VERSION = '16.7.1';

export function getChampionImageUrl(ddragonId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${ddragonId}.png`;
}

const TIER_STYLE: Record<string, string> = {
  S: 'bg-yellow-400',
  A: 'bg-green-500',
  B: 'bg-blue-500',
  C: 'bg-gray-500',
};

const TIER_TEXT_STYLE: Record<string, string> = {
  S: 'text-black',
  A: 'text-white',
  B: 'text-white',
  C: 'text-white',
};

interface ChampionCardProps {
  champion: Champion;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  selected?: boolean;
  banned?: boolean;
  mastery?: PlayerMastery;
  tier?: string;
}

export default function ChampionCard({
  champion,
  onPress,
  onLongPress,
  disabled = false,
  size = 'md',
  selected = false,
  banned = false,
  mastery,
  tier,
}: ChampionCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isSm = size === 'sm';

  const tileSize = isSm ? 'w-8 h-8' : 'w-12 h-12';

  const fallbackBg =
    champion.damageType === 'AD'
      ? 'bg-rose-700'
      : champion.damageType === 'AP'
        ? 'bg-cyan-700'
        : 'bg-violet-700';

  return (
    <Pressable
      onPress={!disabled && !banned ? onPress : undefined}
      onLongPress={onLongPress}
      disabled={disabled || banned}
      className={[
        tileSize,
        'relative items-center justify-center rounded-md border overflow-hidden',
        'bg-lol-card border-lol-border',
        selected
          ? 'border-lol-gold shadow-lol-gold shadow-lg'
          : '',
        disabled ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Champion image */}
      {!imgFailed ? (
        <Image
          source={{ uri: getChampionImageUrl(champion.ddragonId) }}
          onError={() => setImgFailed(true)}
          className="w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <View
          className={`w-full h-full items-center justify-center ${fallbackBg}`}
        >
          <Text className="font-bold text-white/90 text-sm">
            {champion.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Name strip -- md only */}
      {!isSm && (
        <View className="absolute bottom-0 left-0 right-0 bg-black/70 items-center py-0.5 px-0.5">
          <Text
            className="text-[9px] text-lol-text-bright font-medium leading-tight"
            numberOfLines={1}
          >
            {champion.name}
          </Text>
        </View>
      )}

      {/* Mastery badge -- top-left */}
      {!isSm && mastery && mastery.masteryLevel >= 5 && (
        <View className="absolute top-0.5 left-0.5">
          <Text
            className={[
              'text-[8px] font-black leading-none px-0.5 rounded',
              mastery.masteryLevel === 7
                ? 'bg-lol-gold text-lol-dark'
                : mastery.masteryLevel === 6
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-500 text-white',
            ].join(' ')}
          >
            M{mastery.masteryLevel}
          </Text>
        </View>
      )}

      {/* Tier badge -- top-right */}
      {!isSm && tier && (
        <View className="absolute top-0.5 right-0.5">
          <Text
            className={[
              'text-[8px] font-black leading-none px-0.5 rounded',
              TIER_STYLE[tier] ?? 'bg-gray-600',
              TIER_TEXT_STYLE[tier] ?? 'text-white',
            ].join(' ')}
          >
            {tier}
          </Text>
        </View>
      )}

      {/* Banned overlay */}
      {banned && (
        <View className="absolute inset-0 bg-black/70 items-center justify-center">
          <Text className="text-red-500 font-black text-xl leading-none">
            ✕
          </Text>
        </View>
      )}
    </Pressable>
  );
}

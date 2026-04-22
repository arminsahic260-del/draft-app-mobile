// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Image } from 'react-native';
import type { Recommendation, Champion } from '../types';
import { getChampionImageUrl } from './ChampionCard';
import { usePatch } from '../hooks/PatchDataContext';

interface MatchupIntelProps {
  enemyPickIds: string[];
  topRecommendation: Recommendation | undefined;
  allChampions: Champion[];
}

function getDelta(
  playerChampId: string | undefined,
  enemyChampId: string,
  matchups: Record<string, Record<string, number>>,
): number | null {
  if (!playerChampId) return null;
  const champMatchups = matchups[playerChampId];
  if (!champMatchups) return null;
  const val = champMatchups[enemyChampId];
  return typeof val === 'number' ? val : null;
}

function AdvBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <Text className="text-[9px] text-lol-text/40">{'\u2014'}</Text>;
  if (delta >= 1.5) return <Text className="text-[9px] font-bold text-lol-green">{'\u25B2'} +{delta.toFixed(1)}%</Text>;
  if (delta <= -1.5) return <Text className="text-[9px] font-bold text-lol-red">{'\u25BC'} {delta.toFixed(1)}%</Text>;
  return <Text className="text-[9px] text-lol-text/60">{'\u2248'} {delta > 0 ? '+' : ''}{delta.toFixed(1)}%</Text>;
}

export default function MatchupIntel({ enemyPickIds, topRecommendation, allChampions }: MatchupIntelProps) {
  const { data: patch } = usePatch();
  const validEnemies = enemyPickIds.filter(Boolean);
  if (validEnemies.length === 0 || !topRecommendation) return null;

  const playerChampId = topRecommendation.championId;
  const playerChamp = allChampions.find((c) => c.id === playerChampId);

  return (
    <View className="bg-lol-card border border-lol-border rounded-lg px-3 py-2.5 gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-lol-text uppercase tracking-wide">Matchup Intel</Text>
        {playerChamp && (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[9px] text-lol-text">vs #1:</Text>
            <Image source={{ uri: getChampionImageUrl(playerChamp.ddragonId) }} className="w-5 h-5 rounded" resizeMode="cover" />
            <Text className="text-[10px] text-lol-gold font-semibold">{playerChamp.name}</Text>
          </View>
        )}
      </View>

      <View className="gap-1">
        {validEnemies.map((enemyId) => {
          const champ = allChampions.find((c) => c.id === enemyId);
          if (!champ) return null;
          const delta = getDelta(playerChampId, enemyId, patch.matchups);
          return (
            <View key={enemyId} className="flex-row items-center gap-2 py-0.5">
              <Image source={{ uri: getChampionImageUrl(champ.ddragonId) }} className="w-6 h-6 rounded" resizeMode="cover" />
              <Text className="text-xs text-lol-text-bright flex-1" numberOfLines={1}>{champ.name}</Text>
              <AdvBadge delta={delta} />
            </View>
          );
        })}
      </View>

      <Text className="text-[9px] text-lol-text/50 italic">
        Win rate delta vs each enemy pick for your top suggestion
      </Text>
    </View>
  );
}

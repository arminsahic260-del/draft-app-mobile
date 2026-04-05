// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Pressable, Modal, ScrollView, Image } from 'react-native';
import type { Champion } from '../types';
import { getChampionImageUrl } from './ChampionCard';
import { getChampionPhaseCurve } from '../engine/compAnalysis';
import matchupsData from '../data/matchups.json';
import tierlistData from '../data/tierlist.json';
import championsData from '../data/champions.json';

const matchups  = matchupsData as Record<string, Record<string, number>>;
const tierlist  = tierlistData as Record<string, string[]>;
const allChamps = championsData as Champion[];

function getTier(id: string): string | undefined {
  for (const [tier, ids] of Object.entries(tierlist)) {
    if (ids.includes(id)) return tier;
  }
  return undefined;
}

const TIER_BG: Record<string, string> = { S: 'bg-yellow-400', A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-gray-500' };
const TIER_TEXT: Record<string, string> = { S: 'text-black', A: 'text-white', B: 'text-white', C: 'text-white' };

const ROLE_LABEL: Record<string, string> = {
  top: '\uD83D\uDDE1\uFE0F Top', jungle: '\uD83C\uDF3F Jungle', mid: '\u2726 Mid', adc: '\uD83C\uDFF9 ADC', support: '\uD83D\uDC9B Support',
};

function PhaseCurveBar({ label, value }: { label: string; value: number }) {
  const pct = ((value - 1) / 2) * 100;
  const color = value === 3 ? 'bg-lol-gold' : value === 2 ? 'bg-lol-blue' : 'bg-lol-text/30';
  const strLabel = value === 3 ? 'Strong' : value === 2 ? 'Average' : 'Weak';
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[10px] text-lol-text w-10">{label}</Text>
      <View className="flex-1 h-2 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(10, pct)}%` }} />
      </View>
      <Text className="text-[9px] text-lol-text/60 w-12 text-right">{strLabel}</Text>
    </View>
  );
}

function MatchupRow({ enemyId, delta }: { enemyId: string; delta: number }) {
  const enemy = allChamps.find((c) => c.id === enemyId);
  if (!enemy) return null;
  const isPositive = delta >= 0;
  const color = isPositive ? 'text-lol-green' : 'text-lol-red';
  return (
    <View className="flex-row items-center gap-2 py-1 border-b border-lol-border/30">
      <Image source={{ uri: getChampionImageUrl(enemy.ddragonId) }} className="w-6 h-6 rounded" resizeMode="cover" />
      <Text className="text-xs text-lol-text-bright flex-1" numberOfLines={1}>{enemy.name}</Text>
      <Text className={`text-xs font-bold ${color}`}>{isPositive ? '+' : ''}{delta.toFixed(1)}%</Text>
    </View>
  );
}

function getSynergyHints(champion: Champion): string[] {
  const hints: string[] = [];
  const tags = champion.tags.map((t) => t.toLowerCase());
  const id = champion.id;
  if (id === 'yasuo' || id === 'yone') hints.push('Needs knockup champions \u2014 Malphite, Jarvan IV, Vi, Ornn');
  if (id === 'orianna') hints.push('Combos with Malphite ult, Hecarim engage, and flanking assassins');
  if (id === 'jinx' || id === 'kaisa') hints.push('Scales with Lulu, Yuumi, or Thresh for peel');
  if (id === 'thresh') hints.push('Enables Jinx, Jhin, and Ashe with reliable hook combos');
  if (id === 'leona') hints.push('Pairs with high-damage ADCs \u2014 Caitlyn, Jhin, Jinx');
  if (tags.includes('engage') || tags.includes('initiator')) hints.push('Pairs with poke / harass damage dealers');
  if (tags.includes('poke') || tags.includes('harass')) hints.push('Pairs with engage frontline for follow-up');
  if (tags.includes('splitpush')) hints.push('Best with a strong teamfight comp to hold objectives');
  if (tags.includes('assassin')) hints.push('Needs peel or disengage supports \u2014 Lulu, Janna, Morgana');
  if (id === 'malphite') hints.push('Wombo combo with Yasuo, Orianna, Kennen, or any AoE follow-up');
  return hints.slice(0, 3);
}

interface ChampionDetailModalProps {
  champion: Champion;
  onClose: () => void;
}

export default function ChampionDetailModal({ champion, onClose }: ChampionDetailModalProps) {
  const tier = getTier(champion.id);
  const [early, mid, late] = getChampionPhaseCurve(champion.id);

  const champMatchups = matchups[champion.id] ?? {};
  const sortedMatchups = Object.entries(champMatchups).sort((a, b) => b[1] - a[1]);
  const bestMatchups  = sortedMatchups.slice(0, 5);
  const worstMatchups = sortedMatchups.slice(-5).reverse();
  const synergyHints = getSynergyHints(champion);

  const dmgColor = champion.damageType === 'AD' ? 'text-lol-red' : champion.damageType === 'AP' ? 'text-lol-blue' : 'text-lol-purple';
  const dmgLabel = champion.damageType === 'AD' ? '\u2694 AD' : champion.damageType === 'AP' ? '\u2726 AP' : '\u26A1 Mixed';

  return (
    <Modal transparent animationType="fade">
      <Pressable className="flex-1 bg-black/80 justify-center items-center px-4" onPress={onClose}>
        <Pressable className="bg-lol-darker border border-lol-border rounded-xl w-full max-w-lg max-h-[85%] overflow-hidden" onPress={() => {}}>
          <ScrollView>
            {/* Header */}
            <View className="flex-row items-start gap-4 p-4 border-b border-lol-border">
              <Image source={{ uri: getChampionImageUrl(champion.ddragonId) }} className="w-20 h-20 rounded-lg border-2 border-lol-border" resizeMode="cover" />
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-lg font-bold text-lol-text-bright">{champion.name}</Text>
                  {tier && (
                    <Text className={`text-[10px] font-black px-1.5 py-0.5 rounded ${TIER_BG[tier] ?? 'bg-gray-600'} ${TIER_TEXT[tier] ?? 'text-white'}`}>
                      {tier}-Tier
                    </Text>
                  )}
                  <Text className={`text-xs font-semibold ${dmgColor}`}>{dmgLabel}</Text>
                </View>
                <View className="flex-row flex-wrap gap-1 mt-1.5">
                  {champion.roles.map((r) => (
                    <Text key={r} className="text-[10px] bg-lol-card border border-lol-border rounded px-1.5 py-px text-lol-text">
                      {ROLE_LABEL[r] ?? r}
                    </Text>
                  ))}
                </View>
                <View className="flex-row flex-wrap gap-1 mt-1.5">
                  {champion.tags.map((tag) => (
                    <Text key={tag} className="text-[9px] bg-lol-darker border border-lol-border/60 rounded px-1 py-px text-lol-text/70 capitalize">
                      {tag}
                    </Text>
                  ))}
                </View>
              </View>
              <Pressable onPress={onClose}>
                <Text className="text-lol-text/50 text-lg leading-none">{'\u2715'}</Text>
              </Pressable>
            </View>

            <View className="p-4 gap-4">
              {/* Phase Curve */}
              <View>
                <Text className="text-[11px] font-bold text-lol-gold uppercase tracking-wide mb-2">Game Phase Strength</Text>
                <View className="gap-1.5 bg-lol-card border border-lol-border/50 rounded-lg p-3">
                  <PhaseCurveBar label="Early" value={early} />
                  <PhaseCurveBar label="Mid" value={mid} />
                  <PhaseCurveBar label="Late" value={late} />
                </View>
              </View>

              {/* Synergies */}
              {synergyHints.length > 0 && (
                <View>
                  <Text className="text-[11px] font-bold text-lol-gold uppercase tracking-wide mb-2">Synergy Notes</Text>
                  <View className="gap-1.5">
                    {synergyHints.map((hint, i) => (
                      <View key={i} className="flex-row items-start gap-2 bg-lol-card border border-lol-border/50 rounded px-2.5 py-1.5">
                        <Text className="text-lol-gold mt-px">{'\u2726'}</Text>
                        <Text className="text-xs text-lol-text flex-1">{hint}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Matchups */}
              {sortedMatchups.length > 0 && (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-lol-green uppercase tracking-wide mb-2">Wins Against</Text>
                    <View className="bg-lol-card border border-lol-border/50 rounded-lg px-2 py-1">
                      {bestMatchups.map(([id, delta]) => <MatchupRow key={id} enemyId={id} delta={delta} />)}
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[11px] font-bold text-lol-red uppercase tracking-wide mb-2">Loses To</Text>
                    <View className="bg-lol-card border border-lol-border/50 rounded-lg px-2 py-1">
                      {worstMatchups.map(([id, delta]) => <MatchupRow key={id} enemyId={id} delta={delta} />)}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

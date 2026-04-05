// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import type { Recommendation, PlayerMastery, Champion } from '../types';
import { getChampionImageUrl } from './ChampionCard';
import { getChampionPhaseCurve } from '../engine/compAnalysis';
import championsData from '../data/champions.json';

const champions = championsData as Champion[];

interface EnemyPick { id: string; name: string; ddragonId: string }
interface AllyPick  { id: string; name: string; ddragonId: string; tags: string[] }

interface RecommendationCardProps {
  recommendation: Recommendation;
  rank: number;
  locked?: boolean;
  onPick?: () => void;
  onAskAI?: () => Promise<string>;
  enemyPicks?: EnemyPick[];
  allyPicks?: AllyPick[];
  matchupsData?: Record<string, Record<string, number>>;
  mastery?: PlayerMastery;
}

const RANK_STYLES: Record<number, { badge: string }> = {
  1: { badge: 'bg-lol-gold text-lol-dark' },
  2: { badge: 'bg-gray-400 text-lol-dark' },
  3: { badge: 'bg-amber-700 text-white' },
};

function WinBar({ percent }: { percent: number }) {
  const color = percent >= 57 ? 'bg-green-500' : percent >= 52 ? 'bg-lol-gold' : percent >= 48 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = percent >= 52 ? 'text-lol-green' : percent >= 48 ? 'text-lol-gold' : 'text-lol-red';
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] text-lol-text uppercase tracking-wide">Win Probability</Text>
        <Text className={`text-sm font-black ${textColor}`}>{percent.toFixed(1)}%</Text>
      </View>
      <View className="h-2 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
      </View>
    </View>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[10px] text-lol-text w-14">{label}</Text>
      <View className="flex-1 h-1.5 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </View>
      <Text className="text-[10px] text-lol-text-bright w-7 text-right">{Math.round(value)}%</Text>
    </View>
  );
}

function MatchupRow({ enemy, delta }: { enemy: EnemyPick; delta: number }) {
  const isPositive = delta >= 0;
  const barColor = isPositive ? 'bg-lol-green' : 'bg-lol-red';
  const textColor = isPositive ? 'text-lol-green' : 'text-lol-red';
  const barWidth = Math.min(100, Math.abs(delta) * 10);
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <Image source={{ uri: getChampionImageUrl(enemy.ddragonId) }} className="w-5 h-5 rounded border border-lol-border/50" resizeMode="cover" />
      <Text className="text-[10px] text-lol-text w-16" numberOfLines={1}>{enemy.name}</Text>
      <View className="flex-1 h-1 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
      </View>
      <Text className={`text-[10px] font-semibold w-10 text-right ${textColor}`}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}%
      </Text>
    </View>
  );
}

function PhaseCurve({ champId }: { champId: string }) {
  const [early, mid, late] = getChampionPhaseCurve(champId);
  const labels = [{ name: 'Early', value: early }, { name: 'Mid', value: mid }, { name: 'Late', value: late }];
  return (
    <View className="flex-row gap-3">
      {labels.map((p) => (
        <View key={p.name} className="flex-row items-center gap-1">
          <Text className="text-[9px] text-lol-text w-7">{p.name}</Text>
          <View className="flex-row gap-px">
            {[1, 2, 3].map((n) => (
              <View key={n} className={`w-2.5 h-1.5 rounded-sm ${n <= p.value ? 'bg-lol-purple' : 'bg-lol-darker'}`} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function RecommendationCard({
  recommendation, rank, locked = false, onPick, onAskAI,
  enemyPicks = [], allyPicks = [], matchupsData = {}, mastery,
}: RecommendationCardProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const rankStyle = RANK_STYLES[rank] ?? RANK_STYLES[3];
  const champ = champions.find((c) => c.id === recommendation.championId);

  const champMatchups = matchupsData[recommendation.championId] ?? {};
  const matchupRows = enemyPicks
    .map((e) => ({ enemy: e, delta: champMatchups[e.id] ?? 0 }))
    .sort((a, b) => b.delta - a.delta);

  const handleAskAI = async () => {
    if (!onAskAI || aiLoading) return;
    setAiLoading(true);
    try {
      const text = await onAskAI();
      setAiText(text);
    } catch {
      setAiText('Could not load explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View className="relative bg-lol-card border border-lol-border rounded-lg overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center gap-2 p-3 pb-2">
        <Text className={`text-xs font-black px-2 py-0.5 rounded ${rankStyle.badge}`}>#{rank}</Text>
        {champ && (
          <Image source={{ uri: getChampionImageUrl(champ.ddragonId) }} className="w-10 h-10 rounded-lg border border-lol-border" resizeMode="cover" />
        )}
        <View className="flex-1 min-w-0">
          <Text className="text-lol-text-bright font-bold text-base" numberOfLines={1}>{recommendation.championName}</Text>
          {mastery && mastery.gamesPlayed > 0 && (
            <View className="flex-row items-center gap-2 mt-0.5">
              <Text className="text-[10px] text-lol-gold font-semibold">M{mastery.masteryLevel}</Text>
              <Text className="text-[10px] text-lol-text">{mastery.gamesPlayed}G</Text>
              {mastery.winRate != null && (
                <Text className={`text-[10px] font-semibold ${mastery.winRate >= 55 ? 'text-lol-green' : mastery.winRate <= 45 ? 'text-lol-red' : 'text-lol-text'}`}>
                  {mastery.winRate}% WR
                </Text>
              )}
            </View>
          )}
        </View>
        {!locked && onPick && (
          <Pressable onPress={onPick} className="px-3 py-2 rounded-lg bg-lol-gold">
            <Text className="text-lol-dark text-xs font-bold uppercase">Pick</Text>
          </Pressable>
        )}
      </View>

      {/* Win probability */}
      <View className="px-3"><WinBar percent={recommendation.winProbability} /></View>

      {/* Score breakdown */}
      <View className="px-3 py-2 gap-1">
        <ScoreBar label="Matchup"  value={recommendation.matchupScore * 100}  color="bg-lol-red" />
        <ScoreBar label="Comp Fit" value={recommendation.compNeedScore * 100} color="bg-lol-blue" />
        <ScoreBar label="Mastery"  value={recommendation.masteryScore * 100}  color="bg-lol-gold" />
      </View>

      {/* Matchup breakdown */}
      {matchupRows.length > 0 && (
        <View className="px-3 py-2 border-t border-lol-border/50">
          <Text className="text-[10px] text-lol-text uppercase tracking-wide font-semibold">vs Enemy Champions</Text>
          <View className="mt-1">
            {matchupRows.map((row) => <MatchupRow key={row.enemy.id} enemy={row.enemy} delta={row.delta} />)}
          </View>
        </View>
      )}

      {/* Phase curve */}
      {champ && (
        <View className="px-3 py-2 border-t border-lol-border/50">
          <PhaseCurve champId={champ.id} />
        </View>
      )}

      {/* Reasoning */}
      <View className="px-3 py-2 border-t border-lol-border/50">
        <Text className="text-[11px] text-lol-text leading-relaxed">{recommendation.reasoning}</Text>
      </View>

      {/* AI explanation */}
      {aiText && (
        <View className="mx-3 mb-2 bg-lol-darker border border-lol-purple/30 rounded-lg p-2">
          <Text className="text-lol-purple font-semibold text-[10px] uppercase tracking-wide mb-1">AI Analysis</Text>
          <Text className="text-[11px] text-lol-text-bright leading-relaxed">{aiText}</Text>
        </View>
      )}

      {/* Ask AI button */}
      {!locked && onAskAI && !aiText && (
        <View className="px-3 pb-3">
          <Pressable
            onPress={handleAskAI}
            disabled={aiLoading}
            className={`w-full py-1.5 rounded-lg bg-lol-purple/15 border border-lol-purple/30 items-center ${aiLoading ? 'opacity-50' : ''}`}
          >
            <Text className="text-lol-purple text-xs font-semibold">
              {aiLoading ? 'Analyzing...' : 'Ask AI \u2014 Why this pick?'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Locked overlay */}
      {locked && (
        <View className="absolute inset-0 bg-lol-darker/80 items-center justify-center gap-2 rounded-lg">
          <Text className="text-2xl">{'\uD83D\uDD12'}</Text>
          <Text className="text-lol-gold text-xs font-semibold">Upgrade to Pro</Text>
        </View>
      )}
    </View>
  );
}

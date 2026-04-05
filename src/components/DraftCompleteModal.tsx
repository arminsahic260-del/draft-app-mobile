// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { DraftState, Champion, CompAnalysis, Recommendation } from '../types';
import { analyzeComp, draftScore } from '../engine/compAnalysis';
import { getChampionImageUrl } from './ChampionCard';

interface Props {
  draft: DraftState;
  champions: Champion[];
  recommendations: Recommendation[];
  onGetRecommendations: () => void;
  onContinueEditing: () => void;
  onViewHistory?: () => void;
}

function ScoreMeter({ score, team }: { score: number; team: 'blue' | 'red' }) {
  const color = team === 'blue' ? 'bg-lol-blue' : 'bg-lol-red';
  const label =
    score >= 75 ? '\uD83C\uDFC6 Strong' :
    score >= 55 ? '\u2705 Solid' :
    score >= 40 ? '\u26A0\uFE0F Needs work' : '\u274C Weak';
  const textColor = team === 'blue' ? 'text-lol-blue' : 'text-lol-red';

  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text className={`text-[10px] font-semibold ${textColor}`}>
          {team === 'blue' ? 'Blue' : 'Red'} Comp
        </Text>
        <Text className="text-[10px] text-lol-text-bright">{label}</Text>
      </View>
      <View className="h-2 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </View>
      <Text className="text-[10px] text-lol-text text-right">{score}/100</Text>
    </View>
  );
}

function ChampionRow({ championId, champions, role }: { championId: string | null; champions: Champion[]; role?: string }) {
  const champ = champions.find((c) => c.id === championId);
  if (!champ) return null;
  return (
    <View className="flex-row items-center gap-2">
      <Image source={{ uri: getChampionImageUrl(champ.ddragonId) }} className="w-8 h-8 rounded" resizeMode="cover" />
      <View className="flex-1 min-w-0">
        <Text className="text-xs font-medium text-lol-text-bright" numberOfLines={1}>{champ.name}</Text>
        {role && <Text className="text-[9px] text-lol-text capitalize">{role}</Text>}
      </View>
    </View>
  );
}

function WinConditionBadge({ analysis, team }: { analysis: CompAnalysis; team: 'blue' | 'red' }) {
  const color = team === 'blue' ? 'text-lol-blue' : 'text-lol-red';
  const border = team === 'blue' ? 'border-lol-blue/20' : 'border-lol-red/20';
  let label = 'Scale & fight'; let icon = '\u26A1';
  if (analysis.hasEngage && analysis.totalCc >= 20) { label = 'Engage teamfight'; icon = '\u2694\uFE0F'; }
  else if (analysis.hasPoke && !analysis.hasEngage)  { label = 'Poke & siege';     icon = '\uD83C\uDFF9'; }
  else if (analysis.hasSplitpush)                    { label = 'Split pressure';   icon = '\uD83D\uDDFA\uFE0F'; }
  else if (analysis.hasEngage)                       { label = 'Pick & dive';      icon = '\uD83C\uDFAF'; }
  return (
    <View className={`flex-row items-center gap-2 bg-lol-card border ${border} rounded px-2 py-1.5 flex-1`}>
      <Text>{icon}</Text>
      <Text className={`text-xs font-semibold ${color}`}>{label}</Text>
    </View>
  );
}

export default function DraftCompleteModal({
  draft, champions, recommendations, onGetRecommendations, onContinueEditing, onViewHistory,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const payload = JSON.stringify({ picks: draft.picks, bans: draft.bans, role: draft.playerRole });
    await Clipboard.setStringAsync(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const blueIds = draft.picks.blue.filter((id): id is string => id !== null);
  const redIds  = draft.picks.red.filter((id): id is string => id !== null);
  const blueAnalysis = analyzeComp(blueIds, champions);
  const redAnalysis  = analyzeComp(redIds, champions);
  const blueScore = draftScore(blueAnalysis);
  const redScore  = draftScore(redAnalysis);
  const winner = blueScore > redScore + 5 ? 'blue' : redScore > blueScore + 5 ? 'red' : 'even';

  return (
    <Modal transparent animationType="fade">
      <View className="flex-1 bg-black/75 justify-center items-center px-4">
        <View className="bg-lol-darker border border-lol-border rounded-xl w-full max-w-2xl max-h-[85%] overflow-hidden">
          <ScrollView>
            {/* Header */}
            <View className="px-5 py-4 border-b border-lol-border flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-bold text-lol-gold tracking-wide">Draft Complete</Text>
                <Text className="text-xs text-lol-text mt-0.5">
                  {winner === 'even'
                    ? 'Both teams drafted evenly \u2014 execution decides it.'
                    : `${winner === 'blue' ? 'Blue' : 'Red'} side has the draft advantage.`}
                </Text>
              </View>
              {winner !== 'even' && (
                <Text className={`text-2xl font-black ${winner === 'blue' ? 'text-lol-blue' : 'text-lol-red'}`}>
                  {winner === 'blue' ? '\uD83D\uDD35' : '\uD83D\uDD34'}
                </Text>
              )}
            </View>

            {/* Two-column comp summary */}
            <View className="p-4 flex-row gap-4">
              {/* Blue */}
              <View className="flex-1 gap-3">
                <ScoreMeter score={blueScore} team="blue" />
                <View className="gap-1.5">
                  {draft.picks.blue.map((id, i) => (
                    <ChampionRow key={i} championId={id} champions={champions} role={draft.pickRoles.blue[i] ?? undefined} />
                  ))}
                </View>
                {blueAnalysis.warnings.length > 0 && (
                  <View className="gap-1 mt-1">
                    {blueAnalysis.warnings.map((w, i) => (
                      <Text key={i} className="text-[10px] text-lol-gold/80">{'\u26A0'} {w}</Text>
                    ))}
                  </View>
                )}
              </View>
              {/* Red */}
              <View className="flex-1 gap-3">
                <ScoreMeter score={redScore} team="red" />
                <View className="gap-1.5">
                  {draft.picks.red.map((id, i) => (
                    <ChampionRow key={i} championId={id} champions={champions} role={draft.pickRoles.red[i] ?? undefined} />
                  ))}
                </View>
                {redAnalysis.warnings.length > 0 && (
                  <View className="gap-1 mt-1">
                    {redAnalysis.warnings.map((w, i) => (
                      <Text key={i} className="text-[10px] text-lol-gold/80">{'\u26A0'} {w}</Text>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Win conditions */}
            <View className="px-4 pb-3 flex-row gap-4 border-t border-lol-border/40 pt-3">
              <WinConditionBadge analysis={blueAnalysis} team="blue" />
              <WinConditionBadge analysis={redAnalysis} team="red" />
            </View>

            {/* Quick recs preview */}
            {recommendations.length > 0 && (
              <View className="px-4 pb-3 border-t border-lol-border/40 pt-3">
                <Text className="text-xs font-semibold text-lol-gold uppercase tracking-wide mb-2">Top Picks For You</Text>
                <View className="flex-row gap-2">
                  {recommendations.slice(0, 3).map((rec, i) => {
                    const champ = champions.find((c) => c.id === rec.championId);
                    return (
                      <View key={rec.championId} className="flex-row items-center gap-1.5 bg-lol-card rounded px-2 py-1 border border-lol-border flex-1">
                        {champ && <Image source={{ uri: getChampionImageUrl(champ.ddragonId) }} className="w-7 h-7 rounded" resizeMode="cover" />}
                        <View className="min-w-0 flex-1">
                          <Text className="text-[10px] font-bold text-lol-text-bright" numberOfLines={1}>#{i + 1} {rec.championName}</Text>
                          <Text className="text-[9px] text-lol-green">{rec.winProbability.toFixed(1)}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Actions */}
            <View className="px-4 py-3 border-t border-lol-border gap-2">
              <View className="flex-row gap-3">
                <Pressable onPress={onGetRecommendations} className="flex-1 py-2.5 rounded-lg bg-lol-gold items-center">
                  <Text className="text-lol-dark font-bold text-sm">{'\uD83C\uDFF9'} Full Recommendations</Text>
                </Pressable>
                <Pressable onPress={onContinueEditing} className="px-4 py-2.5 rounded-lg bg-lol-card border border-lol-border items-center">
                  <Text className="text-lol-text text-sm">{'\u21A9'} Keep Editing</Text>
                </Pressable>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleShare}
                  className={`flex-1 py-2 rounded-lg border items-center ${
                    copied ? 'bg-lol-green/20 border-lol-green/40' : 'bg-lol-card border-lol-border'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${copied ? 'text-lol-green' : 'text-lol-text'}`}>
                    {copied ? '\u2713 Copied!' : '\uD83D\uDCE4 Share Draft'}
                  </Text>
                </Pressable>
                {onViewHistory && (
                  <Pressable onPress={onViewHistory} className="flex-1 py-2 rounded-lg bg-lol-card border border-lol-border items-center">
                    <Text className="text-lol-text text-xs font-semibold">{'\uD83D\uDD50'} History</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

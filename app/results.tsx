// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import RecommendationCard from '../src/components/RecommendationCard';
import { getPickExplanation } from '../src/api/claude';
import { getChampionImageUrl } from '../src/components/ChampionCard';
import { analyzeComp, draftScore } from '../src/engine/compAnalysis';
import { redirectToCheckout } from '../src/api/stripe';
import championsData from '../src/data/champions.json';
import matchupsJson from '../src/data/matchups.json';
import type { Recommendation, Champion, CompAnalysis } from '../src/types';

const allChampions = championsData as Champion[];
const matchupsData = matchupsJson as Record<string, Record<string, number>>;

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[10px] text-lol-text w-10 uppercase tracking-wide">{label}</Text>
      <View className="flex-1 h-1.5 rounded-full bg-lol-darker overflow-hidden">
        <View className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-[10px] text-lol-text-bright w-6 text-right font-medium">{Math.round(value)}</Text>
    </View>
  );
}

function TeamPortraitRow({ pickIds }: { pickIds: string[] }) {
  return (
    <View className="flex-row gap-1">
      {pickIds.map((id) => {
        const c = allChampions.find((ch) => ch.id === id);
        return c ? (
          <Image key={id} source={{ uri: getChampionImageUrl(c.ddragonId) }} className="w-8 h-8 rounded border border-lol-border" resizeMode="cover" />
        ) : null;
      })}
      {pickIds.length === 0 && <Text className="text-[10px] text-lol-text/40 italic">No picks yet</Text>}
    </View>
  );
}

function PhaseBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const pct = (value / maxValue) * 100;
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-[9px] text-lol-text w-8">{label}</Text>
      <View className="flex-1 h-1 rounded-full bg-lol-darker overflow-hidden">
        <View className="h-full rounded-full bg-lol-purple/70" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

function CompPanel({ team, pickIds, analysis, score, color }: {
  team: string; pickIds: string[]; analysis: CompAnalysis; score: number; color: string;
}) {
  const phase = analysis.phaseStrength;
  return (
    <View className="flex-1 bg-lol-card border border-lol-border rounded-lg p-2 gap-1.5 min-w-0">
      <View className="flex-row items-center justify-between">
        <Text className={`text-xs font-bold uppercase tracking-wider ${color}`}>{team} Side</Text>
        <Text className={`text-lg font-black ${score >= 60 ? 'text-lol-green' : score >= 45 ? 'text-lol-text-bright' : 'text-lol-red'}`}>
          {score}
        </Text>
      </View>
      <TeamPortraitRow pickIds={pickIds} />
      <View className="gap-1 mt-1">
        <StatBar label="AD" value={analysis.adRatio * 100} max={100} color="bg-orange-400" />
        <StatBar label="AP" value={analysis.apRatio * 100} max={100} color="bg-blue-400" />
        <StatBar label="CC" value={analysis.totalCc} max={40} color="bg-yellow-400" />
      </View>
      <View className="gap-0.5 mt-1">
        <PhaseBar label="Early" value={phase.early} maxValue={10} />
        <PhaseBar label="Mid" value={phase.mid} maxValue={10} />
        <PhaseBar label="Late" value={phase.late} maxValue={10} />
      </View>
      {analysis.warnings.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-1">
          {analysis.warnings.map((w) => (
            <Text key={w} className="text-[9px] bg-lol-red/15 text-lol-red border border-lol-red/20 rounded px-1.5 py-0.5">
              {w}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function DraftScoreVerdict({ blueScore, redScore, playerTeam }: { blueScore: number; redScore: number; playerTeam: string }) {
  const diff = playerTeam === 'blue' ? blueScore - redScore : redScore - blueScore;
  const label = diff >= 15 ? 'Strong draft advantage'
    : diff >= 5 ? 'Slight advantage'
    : diff >= -5 ? 'Even draft'
    : diff >= -15 ? 'Slight disadvantage'
    : 'Difficult draft';
  const color = diff >= 5 ? 'text-lol-green' : diff >= -5 ? 'text-lol-gold' : 'text-lol-red';
  const icon = diff >= 5 ? '\u25B2' : diff >= -5 ? '\u25CF' : '\u25BC';

  return (
    <View className="flex-row items-center justify-center gap-2 py-2">
      <Text className={`text-xs font-bold ${color}`}>{icon} {label}</Text>
      <Text className="text-[10px] text-lol-text">({Math.abs(diff)} point {diff >= 0 ? 'lead' : 'deficit'})</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const { recommendations, draftSnapshot: draft, player, auth } = useAppContext();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const isPro = auth.isPro || auth.isGuest;

  if (!draft || !player) {
    router.replace('/');
    return null;
  }

  const enemyTeam = draft.playerTeam === 'blue' ? 'red' : 'blue';

  const blueIds = useMemo(() => draft.picks.blue.filter((id): id is string => id !== null), [draft.picks.blue]);
  const redIds  = useMemo(() => draft.picks.red.filter((id): id is string => id !== null), [draft.picks.red]);

  const blueAnalysis = useMemo(() => analyzeComp(blueIds, allChampions), [blueIds]);
  const redAnalysis  = useMemo(() => analyzeComp(redIds, allChampions), [redIds]);
  const blueScore = useMemo(() => draftScore(blueAnalysis), [blueAnalysis]);
  const redScore  = useMemo(() => draftScore(redAnalysis), [redAnalysis]);

  const enemyPicks = useMemo(() =>
    draft.picks[enemyTeam]
      .filter((id): id is string => id !== null)
      .map((id) => { const c = allChampions.find((ch) => ch.id === id); return c ? { id: c.id, name: c.name, ddragonId: c.ddragonId } : null; })
      .filter((x): x is { id: string; name: string; ddragonId: string } => x !== null),
    [draft.picks, enemyTeam]);

  const allyPicks = useMemo(() =>
    draft.picks[draft.playerTeam]
      .filter((id): id is string => id !== null)
      .map((id) => { const c = allChampions.find((ch) => ch.id === id); return c ? { id: c.id, name: c.name, ddragonId: c.ddragonId, tags: c.tags } : null; })
      .filter((x): x is { id: string; name: string; ddragonId: string; tags: string[] } => x !== null),
    [draft.picks, draft.playerTeam]);

  const handleAskAI = (rec: Recommendation) => async () => {
    const mastery = player.masteries.find((m) => m.championId === rec.championId);
    return getPickExplanation(rec, draft, mastery, allChampions);
  };

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      {/* Top Bar */}
      <View className="bg-lol-darker border-b border-lol-border px-3 py-2 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1">
          <Text className="text-lol-text text-sm">\u2190</Text>
          <Text className="text-lol-text text-sm">Back</Text>
        </Pressable>
        <Text className="text-lol-gold font-bold text-sm tracking-wide uppercase">Analysis</Text>
        <Text className="text-xs text-lol-text">{draft.playerRole.toUpperCase()}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="max-w-2xl self-center p-3 gap-3">
        {/* Comp Comparison */}
        {(blueIds.length > 0 || redIds.length > 0) && (
          <View className="gap-2">
            <Text className="text-xs font-semibold text-lol-text uppercase tracking-wider text-center">Draft Overview</Text>
            <View className="flex-row gap-2">
              <CompPanel team="Blue" pickIds={blueIds} analysis={blueAnalysis} score={blueScore} color="text-lol-blue" />
              <CompPanel team="Red" pickIds={redIds} analysis={redAnalysis} score={redScore} color="text-lol-red" />
            </View>
            <DraftScoreVerdict blueScore={blueScore} redScore={redScore} playerTeam={draft.playerTeam} />
          </View>
        )}

        {/* Recommendations header */}
        <View className="gap-1">
          <Text className="text-xs font-semibold text-lol-text uppercase tracking-wider">Best Picks For You</Text>
          <Text className="text-[10px] text-lol-text/60">
            Ranked by matchup advantage, comp fit, and your mastery.
          </Text>
        </View>

        {/* Recommendation cards */}
        {recommendations.map((rec, i) => (
          <RecommendationCard
            key={rec.championId}
            recommendation={rec}
            rank={i + 1}
            locked={!isPro && i > 0}
            onPick={() => router.back()}
            onAskAI={!isPro && i > 0 ? undefined : handleAskAI(rec)}
            enemyPicks={enemyPicks}
            allyPicks={allyPicks}
            matchupsData={matchupsData}
            mastery={player.masteries.find((m) => m.championId === rec.championId)}
          />
        ))}

        {/* Pro upsell */}
        {!isPro && (
          <View className="mt-2 bg-lol-card border border-lol-gold/30 rounded-lg p-4 items-center">
            <Text className="text-sm text-lol-gold-light font-semibold">Unlock DraftDiff Pro</Text>
            <View className="mt-2 gap-1 self-start">
              <Text className="text-xs text-lol-text">{'\u2713'} Full top-3 breakdown</Text>
              <Text className="text-xs text-lol-text">{'\u2713'} AI explanations on all picks</Text>
              <Text className="text-xs text-lol-text">{'\u2713'} Unlimited drafts per day</Text>
            </View>
            <Pressable
              onPress={async () => {
                if (!auth.user?.uid || !auth.user?.email) return;
                setCheckoutLoading(true);
                try { await redirectToCheckout(auth.user.uid, auth.user.email); }
                catch { setCheckoutLoading(false); }
              }}
              disabled={checkoutLoading || !auth.user?.uid}
              className={`mt-4 px-6 py-2 bg-lol-gold rounded ${checkoutLoading ? 'opacity-50' : ''}`}
            >
              <Text className="text-lol-dark font-bold text-sm">
                {checkoutLoading ? 'Redirecting...' : 'Get Pro \u2014 $4.99/mo'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

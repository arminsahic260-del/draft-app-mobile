// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getChampionImageUrl } from '../src/components/ChampionCard';
import { useAppContext } from '../src/context/AppContext';
import { analyzeComp, draftScore } from '../src/engine/compAnalysis';
import { redirectToCheckout } from '../src/api/stripe';
import championsData from '../src/data/champions.json';
import type { Champion, LocalDraftRecord, CompAnalysis } from '../src/types';

const allChamps = championsData as Champion[];

const ROLE_ICON: Record<string, string> = {
  top: '\uD83D\uDDE1\uFE0F', jungle: '\uD83C\uDF3F', mid: '\u2726', adc: '\uD83C\uDFF9', support: '\uD83D\uDC9B',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function champOf(id: string | null): Champion | null {
  if (!id) return null;
  return allChamps.find((c) => c.id === id) ?? null;
}

function slotDiff(aSlots: (string | null)[], bSlots: (string | null)[]): boolean[] {
  const len = Math.max(aSlots.length, bSlots.length);
  const out: boolean[] = [];
  for (let i = 0; i < len; i++) {
    out.push((aSlots[i] ?? null) !== (bSlots[i] ?? null));
  }
  return out;
}

function ChampSlot({ id, changed }: { id: string | null; changed: boolean }) {
  const c = champOf(id);
  const ringClass = changed ? 'border-2 border-lol-gold/70' : 'border border-lol-border/50';
  if (!c) {
    return (
      <View className={`w-9 h-9 rounded bg-lol-card/60 items-center justify-center ${ringClass}`}>
        <Text className="text-[10px] text-lol-text/30">{'\u2014'}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: getChampionImageUrl(c.ddragonId) }}
      className={`w-9 h-9 rounded ${ringClass}`}
      resizeMode="cover"
    />
  );
}

function TeamRow({
  label, color, slots, otherSlots,
}: {
  label: string; color: 'blue' | 'red';
  slots: (string | null)[]; otherSlots: (string | null)[];
}) {
  const diffs = slotDiff(slots, otherSlots);
  const colorClass = color === 'blue' ? 'text-lol-blue' : 'text-lol-red';
  return (
    <View className="gap-1">
      <Text className={`text-[10px] font-bold uppercase tracking-wide ${colorClass}`}>{label}</Text>
      <View className="flex-row gap-1 flex-wrap">
        {slots.map((id, i) => (
          <ChampSlot key={`${label}-${i}`} id={id} changed={diffs[i]} />
        ))}
      </View>
    </View>
  );
}

function DraftColumn({
  rec, otherRec, label,
}: {
  rec: LocalDraftRecord; otherRec: LocalDraftRecord; label: string;
}) {
  const winner = rec.blueScore > rec.redScore + 5 ? 'blue'
    : rec.redScore > rec.blueScore + 5 ? 'red' : 'even';

  return (
    <View className="bg-lol-darker border border-lol-border rounded-xl p-4 gap-3">
      <View className="flex-row items-center gap-2 flex-wrap">
        <Text className="text-[10px] font-bold text-lol-gold uppercase tracking-wider">{label}</Text>
        <Text className="text-lg">{ROLE_ICON[rec.playerRole] ?? '\u2753'}</Text>
        <Text className="text-xs text-lol-text capitalize">{rec.playerRole}</Text>
        <Text className="ml-auto text-[10px] text-lol-text/50">{formatDate(rec.createdAt)}</Text>
      </View>

      <TeamRow label="Bans · Blue" color="blue" slots={rec.bans.blue} otherSlots={otherRec.bans.blue} />
      <TeamRow label="Bans · Red"  color="red"  slots={rec.bans.red}  otherSlots={otherRec.bans.red} />
      <View className="border-t border-lol-border/40 my-1" />
      <TeamRow label="Picks · Blue" color="blue" slots={rec.picks.blue} otherSlots={otherRec.picks.blue} />
      <TeamRow label="Picks · Red"  color="red"  slots={rec.picks.red}  otherSlots={otherRec.picks.red} />

      <View className="flex-row items-center gap-3 border-t border-lol-border/40 pt-2">
        <Text className="text-[11px] text-lol-blue">Blue {rec.blueScore}</Text>
        <Text className="text-lol-text/40 text-[11px]">·</Text>
        <Text className="text-[11px] text-lol-red">Red {rec.redScore}</Text>
        <Text className={`ml-auto text-[11px] font-bold ${winner === 'blue' ? 'text-lol-blue' : winner === 'red' ? 'text-lol-red' : 'text-lol-text/60'}`}>
          {winner === 'blue' ? '\uD83D\uDD35 Blue wins' : winner === 'red' ? '\uD83D\uDD34 Red wins' : '\u2696 Even'}
        </Text>
      </View>
    </View>
  );
}

function pct(n: number): string { return `${Math.round(n * 100)}%`; }

function DeltaText({ a, b, fmt }: { a: number; b: number; fmt: (n: number) => string }) {
  const d = b - a;
  if (Math.abs(d) < 0.01) {
    return <Text className="text-lol-text/50 text-xs">{fmt(0)}</Text>;
  }
  const sign = d > 0 ? '+' : '';
  const cls = d > 0 ? 'text-emerald-400' : 'text-rose-400';
  return <Text className={`text-xs font-semibold ${cls}`}>{sign}{fmt(d)}</Text>;
}

function AnalysisRow({ label, a, b, fmt }: { label: string; a: number; b: number; fmt: (n: number) => string }) {
  return (
    <View className="flex-row items-center py-1 border-t border-lol-border/30">
      <Text className="text-xs text-lol-text/70 flex-1">{label}</Text>
      <Text className="text-xs text-lol-text w-12 text-center">{fmt(a)}</Text>
      <Text className="text-xs text-lol-text w-12 text-center">{fmt(b)}</Text>
      <View className="w-14 items-end">
        <DeltaText a={a} b={b} fmt={fmt} />
      </View>
    </View>
  );
}

function AnalysisTable({ titleA, titleB, ana, anb }: {
  titleA: string; titleB: string;
  ana: CompAnalysis; anb: CompAnalysis;
}) {
  const intFmt = (n: number) => String(Math.round(n));
  return (
    <View>
      <View className="flex-row pb-1">
        <Text className="text-[10px] uppercase tracking-wider text-lol-text/50 flex-1">Metric</Text>
        <Text className="text-[10px] uppercase tracking-wider text-lol-text/50 w-12 text-center">{titleA}</Text>
        <Text className="text-[10px] uppercase tracking-wider text-lol-text/50 w-12 text-center">{titleB}</Text>
        <Text className="text-[10px] uppercase tracking-wider text-lol-text/50 w-14 text-right">{'\u0394'}</Text>
      </View>
      <AnalysisRow label="AD ratio" a={ana.adRatio} b={anb.adRatio} fmt={pct} />
      <AnalysisRow label="AP ratio" a={ana.apRatio} b={anb.apRatio} fmt={pct} />
      <AnalysisRow label="Total CC" a={ana.totalCc} b={anb.totalCc} fmt={intFmt} />
      <AnalysisRow label="Early"    a={ana.phaseStrength.early} b={anb.phaseStrength.early} fmt={intFmt} />
      <AnalysisRow label="Mid"      a={ana.phaseStrength.mid}   b={anb.phaseStrength.mid}   fmt={intFmt} />
      <AnalysisRow label="Late"     a={ana.phaseStrength.late}  b={anb.phaseStrength.late}  fmt={intFmt} />
    </View>
  );
}

export default function DiffScreen() {
  const { diffPair, auth } = useAppContext();
  const isPro = auth.isPro;

  // Bounce back to history if no pair set (deep-link / refresh case).
  useEffect(() => {
    if (!diffPair) {
      router.replace('/history');
    }
  }, [diffPair]);

  const analysis = useMemo(() => {
    if (!diffPair) return null;
    const [a, b] = diffPair;
    const ids = (slots: (string | null)[]) => slots.filter((id): id is string => id !== null);
    return {
      blueA: analyzeComp(ids(a.picks.blue), allChamps),
      blueB: analyzeComp(ids(b.picks.blue), allChamps),
      redA:  analyzeComp(ids(a.picks.red),  allChamps),
      redB:  analyzeComp(ids(b.picks.red),  allChamps),
    };
  }, [diffPair]);

  if (!diffPair || !analysis) return null;
  const [a, b] = diffPair;

  const draftScoreDelta = {
    blue: draftScore(analysis.blueB) - draftScore(analysis.blueA),
    red:  draftScore(analysis.redB)  - draftScore(analysis.redA),
  };

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      <View className="bg-lol-darker border-b border-lol-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lol-text text-sm">{'\u2190'} Back</Text>
        </Pressable>
        <Text className="text-lol-gold font-bold text-base flex-1">Draft Diff</Text>
        {isPro && (
          <Text className="text-[10px] font-bold text-lol-gold border border-lol-gold/40 rounded px-1.5 py-px">PRO</Text>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
        <DraftColumn rec={a} otherRec={b} label="Draft A" />
        <DraftColumn rec={b} otherRec={a} label="Draft B" />

        <View className="bg-lol-darker border border-lol-border rounded-xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-bold text-lol-gold">Comp Analysis</Text>
            {!isPro && (
              <Text className="text-[10px] font-bold text-lol-gold border border-lol-gold/40 rounded px-1.5 py-px">PRO</Text>
            )}
          </View>

          {!isPro ? (
            <View className="gap-3 items-start">
              <Text className="text-sm text-lol-text/70">
                Unlock side-by-side comp analytics — AD/AP balance, total CC, and phase-power deltas
                between your two drafts.
              </Text>
              <Pressable
                onPress={() => { redirectToCheckout().catch(() => {}); }}
                className="px-4 py-2 rounded-lg bg-lol-gold"
              >
                <Text className="text-lol-dark font-bold text-sm">Get Pro {'\u2014'} {'\u20AC'}4.99/mo</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-6">
              <View className="gap-2">
                <Text className="text-xs font-bold text-lol-blue uppercase tracking-wide">Blue side</Text>
                <AnalysisTable titleA="A" titleB="B" ana={analysis.blueA} anb={analysis.blueB} />
                <View className="flex-row items-center mt-1 gap-2">
                  <Text className="text-[11px] text-lol-text/60">Draft score {'\u0394'}:</Text>
                  <DeltaText a={0} b={draftScoreDelta.blue} fmt={(n) => String(Math.round(n))} />
                </View>
              </View>
              <View className="gap-2">
                <Text className="text-xs font-bold text-lol-red uppercase tracking-wide">Red side</Text>
                <AnalysisTable titleA="A" titleB="B" ana={analysis.redA} anb={analysis.redB} />
                <View className="flex-row items-center mt-1 gap-2">
                  <Text className="text-[11px] text-lol-text/60">Draft score {'\u0394'}:</Text>
                  <DeltaText a={0} b={draftScoreDelta.red} fmt={(n) => String(Math.round(n))} />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

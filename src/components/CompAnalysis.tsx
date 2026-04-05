// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text } from 'react-native';
import type { CompAnalysis as CompAnalysisType } from '../types';

interface CompAnalysisProps {
  analysis: CompAnalysisType;
  team: 'blue' | 'red';
}

/* ── Sub-components ──────────────────────────────────────────── */

function TagBadge({ label, present }: { label: string; present: boolean }) {
  return (
    <Text
      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border ${
        present
          ? 'bg-lol-green/15 border-lol-green/40 text-lol-green'
          : 'bg-lol-card border-lol-border text-lol-text/30'
      }`}
    >
      {label}
    </Text>
  );
}

function WarningBadge({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded bg-lol-gold/10 border border-lol-gold/30">
      <Text className="text-lol-gold-light text-[10px]">{'\u26A0'}</Text>
      <Text className="text-lol-gold-light text-[10px]">{text}</Text>
    </View>
  );
}

function PhaseBar({ label, value, peak }: { label: string; value: number; peak: boolean }) {
  const pct = Math.round((value / 10) * 100);
  return (
    <View className="flex-1 items-center gap-0.5">
      <View className="w-full h-1.5 rounded-full bg-lol-darker overflow-hidden">
        <View
          className={`h-full rounded-full ${peak ? 'bg-lol-gold' : 'bg-lol-border'}`}
          style={{ width: `${pct}%` }}
        />
      </View>
      <Text
        className={`text-[8px] uppercase font-bold ${
          peak ? 'text-lol-gold' : 'text-lol-text/50'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

function getWinCondition(analysis: CompAnalysisType): { label: string; icon: string; color: string } {
  if (analysis.hasEngage && analysis.totalCc >= 20) return { label: 'Engage teamfight', icon: '\u2694\uFE0F', color: 'text-lol-red' };
  if (analysis.hasPoke && !analysis.hasEngage)      return { label: 'Poke & siege',     icon: '\uD83C\uDFF9',  color: 'text-lol-blue' };
  if (analysis.hasSplitpush)                        return { label: 'Split pressure',   icon: '\uD83D\uDDFA\uFE0F', color: 'text-lol-purple' };
  if (analysis.hasEngage)                           return { label: 'Pick & dive',      icon: '\uD83C\uDFAF',  color: 'text-lol-gold' };
  return                                                   { label: 'Scale & fight',    icon: '\u26A1',  color: 'text-lol-text' };
}

/* ── Main component ──────────────────────────────────────────── */

export default function CompAnalysis({ analysis, team }: CompAnalysisProps) {
  const teamColor = team === 'blue' ? 'text-lol-blue' : 'text-lol-red';
  const teamLabel = team === 'blue' ? 'Blue' : 'Red';
  const adPercent = Math.round(analysis.adRatio * 100);
  const apPercent = Math.round(analysis.apRatio * 100);
  const ccPercent = Math.min(100, Math.round((analysis.totalCc / 30) * 100));
  const winCond   = getWinCondition(analysis);

  const { early, mid, late } = analysis.phaseStrength;
  const peakPhase = early >= mid && early >= late ? 'early' : mid >= late ? 'mid' : 'late';

  return (
    <View className="bg-lol-card border border-lol-border rounded-lg px-3 py-2.5 gap-2">
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <Text className={`text-xs font-bold uppercase tracking-wide ${teamColor}`}>
          {teamLabel} Comp
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className={`text-[10px] ${winCond.color}`}>{winCond.icon}</Text>
          <Text className={`text-[10px] font-semibold ${winCond.color}`}>{winCond.label}</Text>
        </View>
      </View>

      {/* AD / AP bar */}
      <View className="gap-0.5">
        <View className="flex-row justify-between">
          <Text className="text-[10px] text-lol-red font-medium">AD {adPercent}%</Text>
          <Text className="text-[10px] text-lol-blue font-medium">AP {apPercent}%</Text>
        </View>
        <View className="h-2 rounded-full bg-lol-darker overflow-hidden flex-row">
          <View className="h-full bg-lol-red" style={{ flex: adPercent }} />
          <View className="h-full bg-lol-blue" style={{ flex: apPercent }} />
        </View>
      </View>

      {/* CC meter */}
      <View className="flex-row items-center gap-2">
        <Text className="text-[10px] text-lol-text w-14">CC Score</Text>
        <View className="flex-1 h-1.5 rounded-full bg-lol-darker overflow-hidden">
          <View
            className="h-full bg-lol-purple"
            style={{ width: `${ccPercent}%` }}
          />
        </View>
        <Text className="text-[10px] text-lol-text-bright w-6 text-right">{analysis.totalCc}</Text>
      </View>

      {/* Game phase power curve */}
      <View className="gap-1">
        <Text className="text-[9px] text-lol-text uppercase tracking-wide">
          Power spike:{' '}
          <Text className="text-lol-gold capitalize font-bold">{peakPhase} game</Text>
        </Text>
        <View className="flex-row gap-1.5">
          <PhaseBar label="Early" value={early} peak={peakPhase === 'early'} />
          <PhaseBar label="Mid"   value={mid}   peak={peakPhase === 'mid'}   />
          <PhaseBar label="Late"  value={late}  peak={peakPhase === 'late'}  />
        </View>
      </View>

      {/* Trait tags */}
      <View className="flex-row flex-wrap gap-1">
        <TagBadge label="Engage"    present={analysis.hasEngage}    />
        <TagBadge label="Poke"      present={analysis.hasPoke}      />
        <TagBadge label="Splitpush" present={analysis.hasSplitpush} />
      </View>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <View className="gap-1">
          {analysis.warnings.map((w, i) => <WarningBadge key={i} text={w} />)}
        </View>
      )}
    </View>
  );
}

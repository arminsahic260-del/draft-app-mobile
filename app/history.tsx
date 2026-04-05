// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChampionImageUrl } from '../src/components/ChampionCard';
import { useAppContext } from '../src/context/AppContext';
import { isFirebaseConfigured, loadRecentDrafts, type SavedDraftDoc } from '../src/api/firebase';
import { analyzeComp, draftScore } from '../src/engine/compAnalysis';
import championsData from '../src/data/champions.json';
import type { Champion, LocalDraftRecord } from '../src/types';

const allChamps = championsData as Champion[];

const ROLE_ICON: Record<string, string> = {
  top: '\uD83D\uDDE1\uFE0F', jungle: '\uD83C\uDF3F', mid: '\u2726', adc: '\uD83C\uDFF9', support: '\uD83D\uDC9B',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ScoreBadge({ score, team }: { score: number; team: 'blue' | 'red' }) {
  const label = score >= 75 ? '\uD83C\uDFC6' : score >= 55 ? '\u2705' : score >= 40 ? '\u26A0\uFE0F' : '\u274C';
  const color = team === 'blue' ? 'text-lol-blue border-lol-blue/30' : 'text-lol-red border-lol-red/30';
  return (
    <Text className={`text-[10px] font-bold border rounded px-1 py-px ${color}`}>
      {label} {score}
    </Text>
  );
}

function MiniPortraits({ picks }: { picks: (string | null)[] }) {
  const ids = picks.filter((id): id is string => id !== null);
  if (ids.length === 0) return <Text className="text-[10px] text-lol-text/40 italic">\u2014</Text>;
  return (
    <View className="flex-row gap-0.5 flex-wrap">
      {ids.map((id) => {
        const c = allChamps.find((ch) => ch.id === id);
        if (!c) return null;
        return (
          <Image
            key={id}
            source={{ uri: getChampionImageUrl(c.ddragonId) }}
            className="w-7 h-7 rounded border border-lol-border/50"
            resizeMode="cover"
          />
        );
      })}
    </View>
  );
}

async function loadHistory(): Promise<LocalDraftRecord[]> {
  try {
    const raw = await AsyncStorage.getItem('draft-history');
    return JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
}

async function clearHistory() {
  await AsyncStorage.removeItem('draft-history');
}

/** Convert a Firestore SavedDraftDoc into the LocalDraftRecord shape the UI expects. */
function toLocal(doc: SavedDraftDoc): LocalDraftRecord {
  const blueIds = doc.picks.blue.filter((id): id is string => id !== null);
  const redIds  = doc.picks.red.filter((id): id is string => id !== null);
  const blueA = blueIds.length > 0 ? analyzeComp(blueIds, allChamps) : null;
  const redA  = redIds.length > 0  ? analyzeComp(redIds, allChamps)  : null;
  return {
    id:               doc.id ?? doc.createdAt,
    createdAt:        doc.createdAt,
    playerRole:       doc.playerRole,
    picks:            doc.picks,
    bans:             doc.bans,
    topRecommendation: doc.topRecommendation,
    blueScore:        blueA ? draftScore(blueA) : 0,
    redScore:         redA  ? draftScore(redA)  : 0,
  };
}

export default function HistoryScreen() {
  const { auth } = useAppContext();
  const [records, setRecords] = useState<LocalDraftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource]   = useState<'cloud' | 'local'>('local');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let stale = false;
    (async () => {
      setLoading(true);
      // Prefer Firestore when signed in
      if (isFirebaseConfigured && auth.user?.uid) {
        try {
          const docs = await loadRecentDrafts(auth.user.uid, 50);
          if (stale) return;
          setRecords(docs.map(toLocal));
          setSource('cloud');
          setLoading(false);
          return;
        } catch { /* fall through to local */ }
      }
      // Fallback: AsyncStorage
      const local = await loadHistory();
      if (stale) return;
      setRecords(local);
      setSource('local');
      setLoading(false);
    })();
    return () => { stale = true; };
  }, [auth.user?.uid]);

  const handleClear = async () => {
    if (source === 'local') await clearHistory();
    setRecords([]);
    setConfirmClear(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      {/* Header */}
      <View className="bg-lol-darker border-b border-lol-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lol-text text-sm">\u2190 Back</Text>
        </Pressable>
        <Text className="text-lol-gold font-bold text-base flex-1">Draft History</Text>
        {source === 'cloud' && (
          <Text className="text-[9px] text-lol-blue border border-lol-blue/30 rounded px-1 py-px">{'\u2601'} Cloud</Text>
        )}
        {records.length > 0 && (
          confirmClear ? (
            <View className="flex-row gap-2 items-center">
              <Text className="text-xs text-lol-text/60">Clear all?</Text>
              <Pressable onPress={handleClear}>
                <Text className="text-xs text-lol-red font-semibold">Yes</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmClear(false)}>
                <Text className="text-xs text-lol-text/60">Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmClear(true)}>
              <Text className="text-xs text-lol-text/50">{'\uD83D\uDDD1'} Clear</Text>
            </Pressable>
          )
        )}
      </View>

      {/* Body */}
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {loading ? (
          <View className="items-center justify-center h-64 gap-3">
            <ActivityIndicator color="#c89b3c" />
            <Text className="text-lol-text/60 text-xs">Loading drafts...</Text>
          </View>
        ) : records.length === 0 ? (
          <View className="items-center justify-center h-64 gap-3">
            <Text className="text-4xl">{'\uD83D\uDCCB'}</Text>
            <Text className="text-lol-text/60 text-sm">No past drafts yet.</Text>
            <Text className="text-lol-text/40 text-xs">
              {auth.user ? 'Complete a draft to see it here.' : 'Sign in to sync drafts across devices.'}
            </Text>
            <Pressable onPress={() => router.replace('/')} className="mt-2 px-4 py-2 rounded-lg bg-lol-gold">
              <Text className="text-lol-dark text-sm font-bold">Start a Draft</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3 max-w-3xl self-center w-full">
            {records.map((rec) => {
              const winner =
                rec.blueScore > rec.redScore + 5 ? 'blue' :
                rec.redScore > rec.blueScore + 5 ? 'red' : 'even';
              const topRecChamp = rec.topRecommendation
                ? allChamps.find((c) => c.id === rec.topRecommendation) : null;

              return (
                <View key={rec.id} className="bg-lol-darker border border-lol-border rounded-xl p-4 gap-3">
                  {/* Meta row */}
                  <View className="flex-row items-center gap-3 flex-wrap">
                    <Text className="text-lg">{ROLE_ICON[rec.playerRole] ?? '\u2753'}</Text>
                    <Text className="text-xs font-semibold text-lol-text capitalize">{rec.playerRole}</Text>
                    <Text className="text-[10px] text-lol-text/50">{timeAgo(rec.createdAt)}</Text>
                    <View className="ml-auto">
                      {winner !== 'even' ? (
                        <Text className={`text-xs font-bold ${winner === 'blue' ? 'text-lol-blue' : 'text-lol-red'}`}>
                          {winner === 'blue' ? '\uD83D\uDD35 Blue' : '\uD83D\uDD34 Red'} wins draft
                        </Text>
                      ) : (
                        <Text className="text-xs text-lol-text/50">{'\u2696'} Even draft</Text>
                      )}
                    </View>
                  </View>

                  {/* Teams */}
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-1.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[10px] font-bold text-lol-blue uppercase tracking-wide">Blue</Text>
                        <ScoreBadge score={rec.blueScore} team="blue" />
                      </View>
                      <MiniPortraits picks={rec.picks.blue} />
                    </View>
                    <View className="flex-1 gap-1.5">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-[10px] font-bold text-lol-red uppercase tracking-wide">Red</Text>
                        <ScoreBadge score={rec.redScore} team="red" />
                      </View>
                      <MiniPortraits picks={rec.picks.red} />
                    </View>
                  </View>

                  {/* Top recommendation */}
                  {topRecChamp && (
                    <View className="flex-row items-center gap-2 border-t border-lol-border/40 pt-2">
                      <Text className="text-lol-gold text-xs">{'\u2605'}</Text>
                      <Text className="text-xs text-lol-text/70">Top pick:</Text>
                      <Image source={{ uri: getChampionImageUrl(topRecChamp.ddragonId) }} className="w-5 h-5 rounded" resizeMode="cover" />
                      <Text className="text-xs text-lol-text-bright font-medium">{topRecChamp.name}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

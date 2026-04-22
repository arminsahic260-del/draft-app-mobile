// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChampionImageUrl } from '../src/components/ChampionCard';
import { useAppContext } from '../src/context/AppContext';
import { isFirebaseConfigured, loadRecentDrafts, type SavedDraftDoc } from '../src/api/firebase';
import { fetchMatchReview } from '../src/api/riot';
import { analyzeComp, draftScore } from '../src/engine/compAnalysis';
import championsData from '../src/data/champions.json';
import type { Champion, LocalDraftRecord, DraftReviewStatus, DraftMatchResult } from '../src/types';

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

function formatMasteryPoints(p: number): string {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000)     return `${Math.round(p / 1_000)}K`;
  return String(p);
}

function EnemyComfortRow({ enemyMasteries }: { enemyMasteries: NonNullable<DraftMatchResult['enemyMasteries']> }) {
  if (enemyMasteries.length === 0) return null;
  return (
    <View className="border-t border-lol-border/40 pt-2 flex-row items-center gap-2 flex-wrap">
      <Text className="text-[10px] text-lol-text/50 uppercase tracking-wide">Enemy comfort</Text>
      <View className="flex-row gap-1">
        {enemyMasteries.map((m) => {
          const c = allChamps.find((ch) => ch.id === m.championId);
          if (!c) return null;
          return (
            <Image
              key={m.puuid}
              source={{ uri: getChampionImageUrl(c.ddragonId) }}
              accessibilityLabel={`${c.name} ${formatMasteryPoints(m.points)} pts`}
              className="w-5 h-5 rounded border border-lol-border/50"
              resizeMode="cover"
            />
          );
        })}
      </View>
    </View>
  );
}

function MiniPortraits({ picks }: { picks: (string | null)[] }) {
  const ids = picks.filter((id): id is string => id !== null);
  if (ids.length === 0) return <Text className="text-[10px] text-lol-text/40 italic">{'\u2014'}</Text>;
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

async function saveHistory(records: LocalDraftRecord[]) {
  try {
    await AsyncStorage.setItem('draft-history', JSON.stringify(records.slice(0, 50)));
  } catch { /* quota — silently skip */ }
}

async function clearHistory() {
  await AsyncStorage.removeItem('draft-history');
}

// Review policy — same thresholds as web.
const REVIEW_MIN_AGE_MS  = 10 * 60 * 1000;
const REVIEW_MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000;
const REVIEW_BACKOFF_MS  = 60 * 60 * 1000;

function needsReview(rec: LocalDraftRecord): boolean {
  if (!rec.summoner) return false;
  const age = Date.now() - new Date(rec.createdAt).getTime();
  if (age < REVIEW_MIN_AGE_MS || age > REVIEW_MAX_AGE_MS) return false;
  const status = rec.review;
  if (!status || status.kind === 'pending') return true;
  if (status.kind === 'reviewed') return false;
  const lastCheck = Date.now() - new Date(status.checkedAt).getTime();
  return lastCheck > REVIEW_BACKOFF_MS;
}

async function reviewRecord(rec: LocalDraftRecord): Promise<DraftReviewStatus> {
  if (!rec.summoner) return { kind: 'pending' };
  const res = await fetchMatchReview({
    puuid:     rec.summoner.puuid,
    region:    rec.summoner.region,
    sinceMs:   new Date(rec.createdAt).getTime(),
    bluePicks: rec.picks.blue.filter((x): x is string => !!x),
    redPicks:  rec.picks.red.filter((x): x is string => !!x),
  });
  if (!res.ok) return rec.review ?? { kind: 'pending' };
  if (res.result) {
    return {
      kind: 'reviewed',
      result: { ...res.result, reviewedAt: new Date().toISOString() },
    };
  }
  return {
    kind:      'no-match',
    reason:    res.reason ?? 'unknown',
    checkedAt: new Date().toISOString(),
  };
}

function formatGameDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ResultBadge({
  review,
  loading,
  canRetry,
  onRetry,
}: {
  review: DraftReviewStatus | undefined;
  loading: boolean;
  canRetry: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <Text className="text-[10px] text-lol-text/50 italic">Checking result\u2026</Text>;
  }
  if (review?.kind === 'reviewed') {
    const r = review.result;
    const champ = r.championId ? allChamps.find((c) => c.id === r.championId) : null;
    const tone = r.won
      ? 'text-lol-green border-lol-green/40 bg-lol-green/10'
      : 'text-lol-red border-lol-red/40 bg-lol-red/10';
    return (
      <View className={`flex-row items-center gap-2 border rounded px-2 py-1 ${tone}`}>
        <Text className={`text-[11px] font-semibold ${r.won ? 'text-lol-green' : 'text-lol-red'}`}>
          {r.won ? '\u2713 Win' : '\u2717 Loss'}
        </Text>
        {champ && (
          <Image
            source={{ uri: getChampionImageUrl(champ.ddragonId) }}
            className="w-4 h-4 rounded"
            resizeMode="cover"
          />
        )}
        <Text className="text-[11px] text-lol-text-bright font-semibold">
          {r.kills}/{r.deaths}/{r.assists}
        </Text>
        <Text className="text-[10px] text-lol-text/60">
          {r.cs} cs {'\u00B7'} {formatGameDuration(r.durationSec)}
        </Text>
      </View>
    );
  }
  if (canRetry) {
    return (
      <Pressable onPress={onRetry} className="border border-lol-border rounded px-2 py-1">
        <Text className="text-[10px] text-lol-text/50">Check result</Text>
      </Pressable>
    );
  }
  return null;
}

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
  const { auth, setDiffPair } = useAppContext();
  const [records, setRecords] = useState<LocalDraftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource]   = useState<'cloud' | 'local'>('local');
  const [confirmClear, setConfirmClear] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<Set<string>>(new Set());
  const autoReviewRan = useRef(false);

  const applyRecordUpdate = (id: string, status: DraftReviewStatus) => {
    setRecords((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, review: status } : r));
      // Persist to the device even when records came from the cloud, so a
      // reviewed outcome survives re-opens. Cloud-only records without a local
      // twin are re-saved here so the review sticks.
      saveHistory(next.filter((r) => r.summoner));
      return next;
    });
  };

  const runReview = async (rec: LocalDraftRecord) => {
    if (reviewing.has(rec.id)) return;
    setReviewing((s) => new Set(s).add(rec.id));
    try {
      const status = await reviewRecord(rec);
      applyRecordUpdate(rec.id, status);
    } finally {
      setReviewing((s) => {
        const next = new Set(s);
        next.delete(rec.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (autoReviewRan.current) return;
    if (records.length === 0) return;
    autoReviewRan.current = true;
    const candidates = records.filter(needsReview);
    if (candidates.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const rec of candidates) {
        if (cancelled) break;
        await runReview(rec);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.length]);

  useEffect(() => {
    let stale = false;
    (async () => {
      setLoading(true);
      if (isFirebaseConfigured && auth.user?.uid) {
        try {
          const docs = await loadRecentDrafts(auth.user.uid, 50);
          if (stale) return;
          const cloud = docs.map(toLocal);
          // Overlay local summoner + review state onto cloud records so post-game
          // outcomes persist across app restarts even when Firestore is the
          // primary store. Match by createdAt since IDs differ between stores.
          const local = await loadHistory();
          if (stale) return;
          const byTime = new Map(local.map((r) => [r.createdAt, r]));
          const merged = cloud.map((c) => {
            const l = byTime.get(c.createdAt);
            return l ? { ...c, summoner: l.summoner, review: l.review } : c;
          });
          setRecords(merged);
          setSource('cloud');
          setLoading(false);
          return;
        } catch { /* fall through to local */ }
      }
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

  const toggleCompareMode = () => {
    setCompareMode((m) => !m);
    setSelected([]);
  };

  const toggleSelect = (id: string) => {
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      if (sel.length >= 2) return [sel[1], id];
      return [...sel, id];
    });
  };

  const handleCompare = () => {
    if (selected.length !== 2) return;
    const a = records.find((r) => r.id === selected[0]);
    const b = records.find((r) => r.id === selected[1]);
    if (a && b) {
      setDiffPair([a, b]);
      router.push('/diff');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      {/* Header */}
      <View className="bg-lol-darker border-b border-lol-border px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-lol-text text-sm">{'\u2190'} Back</Text>
        </Pressable>
        <Text className="text-lol-gold font-bold text-base flex-1">Draft History</Text>
        {source === 'cloud' && (
          <Text className="text-[9px] text-lol-blue border border-lol-blue/30 rounded px-1 py-px">{'\u2601'} Cloud</Text>
        )}
        {records.length >= 2 && (
          <Pressable onPress={toggleCompareMode}>
            <Text className={`text-xs px-2 py-1 rounded ${compareMode ? 'bg-lol-gold text-lol-dark font-bold' : 'text-lol-text/60 border border-lol-border'}`}>
              {compareMode ? 'Cancel' : '\uD83D\uDD04 Compare'}
            </Text>
          </Pressable>
        )}
        {!compareMode && records.length > 0 && (
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

      {compareMode && (
        <View className="bg-lol-card/40 border-b border-lol-border px-4 py-2 flex-row items-center gap-3">
          <Text className="text-xs text-lol-text/70">
            Pick two drafts to compare ({selected.length}/2 selected)
          </Text>
          <Pressable
            onPress={handleCompare}
            disabled={selected.length !== 2}
            className={`ml-auto px-3 py-1 rounded ${selected.length === 2 ? 'bg-lol-gold' : 'bg-lol-gold/30'}`}
          >
            <Text className={`text-xs font-bold ${selected.length === 2 ? 'text-lol-dark' : 'text-lol-dark/50'}`}>
              Compare {'\u2192'}
            </Text>
          </Pressable>
        </View>
      )}

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
              const isSelected = selected.includes(rec.id);

              const cardClass = compareMode
                ? `border ${isSelected ? 'border-lol-gold' : 'border-lol-border'} bg-lol-darker rounded-xl p-4 gap-3`
                : 'border border-lol-border bg-lol-darker rounded-xl p-4 gap-3';

              const Card = (
                <View className={cardClass}>
                  {/* Meta row */}
                  <View className="flex-row items-center gap-3 flex-wrap">
                    {compareMode && (
                      <Text className={`w-4 h-4 text-[10px] font-bold text-center rounded border ${isSelected ? 'bg-lol-gold border-lol-gold text-lol-dark' : 'border-lol-border text-transparent'}`}>
                        {'\u2713'}
                      </Text>
                    )}
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

                  {/* Post-game review */}
                  {rec.summoner && !compareMode && (
                    <View className="flex-row items-center gap-2 border-t border-lol-border/40 pt-2 flex-wrap">
                      <Text className="text-[10px] text-lol-text/50 uppercase tracking-wide">Outcome</Text>
                      <ResultBadge
                        review={rec.review}
                        loading={reviewing.has(rec.id)}
                        canRetry={rec.review?.kind !== 'reviewed'}
                        onRetry={() => runReview(rec)}
                      />
                    </View>
                  )}

                  {/* Enemy comfort — what opponents were most played on */}
                  {!compareMode && rec.review?.kind === 'reviewed' && rec.review.result.enemyMasteries && (
                    <EnemyComfortRow enemyMasteries={rec.review.result.enemyMasteries} />
                  )}
                </View>
              );

              return compareMode ? (
                <Pressable key={rec.id} onPress={() => toggleSelect(rec.id)}>
                  {Card}
                </Pressable>
              ) : (
                <View key={rec.id}>{Card}</View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

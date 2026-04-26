// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import { useDraft } from '../src/hooks/useDraft';
import { useRemoteLiveDraft } from '../src/hooks/useRemoteLiveDraft';
import { useTimer } from '../src/hooks/useTimer';
import { useSettings } from '../src/hooks/useSettings';
import { useDraftSounds } from '../src/hooks/useDraftSounds';
import { usePatch } from '../src/hooks/PatchDataContext';
import ChampionGrid from '../src/components/ChampionGrid';
import CompactDraftStrip from '../src/components/CompactDraftStrip';
import Timer from '../src/components/Timer';
import PreDraftBansModal from '../src/components/PreDraftBansModal';
import DraftCompleteModal from '../src/components/DraftCompleteModal';
import ChampionDetailModal from '../src/components/ChampionDetailModal';
import { analyzeComp, draftScore } from '../src/engine/compAnalysis';
import { getRecommendations } from '../src/engine/recommend';
import { getBanSuggestions } from '../src/engine/banRecommend';
import { getBotAction } from '../src/engine/botDraft';
import { getChampionImageUrl } from '../src/components/ChampionCard';
import { saveDraft, isFirebaseConfigured } from '../src/api/firebase';
import championsData from '../src/data/champions.json';
import type { Champion, Role, Team, DraftAction, Recommendation, DraftState, CompAnalysis, LiveDraftEvent, LocalDraftRecord } from '../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const champions = championsData as Champion[];

function getWeaknessCallout(
  enemyAnalysis: CompAnalysis,
  allyAnalysis: CompAnalysis,
): { text: string; icon: string; color: string } | null {
  if (enemyAnalysis.adRatio >= 0.8 && enemyAnalysis.apRatio <= 0.2)
    return { text: 'Enemy is full AD \u2014 consider armour/peel', icon: '\uD83D\uDEE1\uFE0F', color: 'text-lol-gold' };
  if (enemyAnalysis.apRatio >= 0.8 && enemyAnalysis.adRatio <= 0.2)
    return { text: 'Enemy is full AP \u2014 pick MR / engage them', icon: '\u26A1', color: 'text-lol-blue' };
  if (enemyAnalysis.hasEngage && enemyAnalysis.totalCc >= 20 && !allyAnalysis.hasEngage)
    return { text: 'Enemy has heavy engage \u2014 pick disengage or poke', icon: '\uD83C\uDFF9', color: 'text-lol-text-bright' };
  if (!enemyAnalysis.hasEngage && !enemyAnalysis.hasPoke)
    return { text: 'Enemy has no engage \u2014 dive or teamfight freely', icon: '\u2694\uFE0F', color: 'text-lol-green' };
  if (enemyAnalysis.totalCc === 0)
    return { text: 'Enemy has zero CC \u2014 carry carries!', icon: '\uD83D\uDCA5', color: 'text-lol-green' };
  return null;
}

export default function DraftScreen() {
  const { player, role, auth, practiceMode, liveMode, setRecommendations, setDraftSnapshot, resetAll } = useAppContext();

  if (!player) {
    router.replace('/');
    return null;
  }

  const playerTeam: Team = 'blue';
  const { draft, pickChampion, banChampion, setAction, setRole, allPickedOrBanned, undo, canUndo, reset, syncLive } =
    useDraft(role, playerTeam);
  const timer = useTimer(30);
  const { data: patch } = usePatch();

  // Live mode — remote (Firestore relay from PC connector)
  const handleLiveEvent = useCallback((event: LiveDraftEvent) => {
    syncLive(event);
  }, [syncLive]);
  const handleSessionEnd = useCallback((reason: string) => {
    const message = reason === 'completed'
      ? 'The PC champ-select ended. Returning to setup.'
      : `Live session disconnected (${reason}).`;
    Alert.alert('Live mode ended', message, [
      { text: 'OK', onPress: () => { resetAll(); router.replace('/'); } },
    ]);
  }, [resetAll]);
  const { status: liveStatus } = useRemoteLiveDraft({
    uid: auth.user?.uid,
    onEvent: handleLiveEvent,
    onSessionEnd: handleSessionEnd,
    enabled: !!liveMode,
  });

  const [gridMode, setGridMode] = useState<DraftAction>(draft.currentAction);
  const [gridTeam, setGridTeam] = useState<Team>(draft.currentTeam);
  const [, setBotThinking] = useState(false);
  const [showPreDraft, setShowPreDraft] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [detailChampId, setDetailChampId] = useState<string | null>(null);

  // Ref for latest draft so bot timeout always reads fresh state
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; });

  // Sync grid when draft advances
  useEffect(() => {
    setGridMode(draft.currentAction);
    setGridTeam(draft.currentTeam);
    if (draft.phase === 'complete') setShowComplete(true);
    else timer.reset(30);
    // eslint-disable-next-line react-hooks/exhaustive-deps — timer.reset is stable (useCallback)
  }, [draft.currentTeam, draft.phase, draft.currentAction]);

  // Bot auto-picks in practice mode
  useEffect(() => {
    if (!practiceMode || draft.phase === 'complete' || draft.currentTeam !== 'red') {
      setBotThinking(false);
      return;
    }
    setBotThinking(true);
    const t = setTimeout(() => {
      const d = draftRef.current;
      const unavailable: string[] = [];
      for (const slot of [...d.picks.blue, ...d.picks.red, ...d.bans.blue, ...d.bans.red]) {
        if (slot) unavailable.push(slot);
      }
      const id = getBotAction(d, d.currentAction, champions, unavailable, patch.tierlist);
      if (!id) return;
      if (d.currentAction === 'ban') banChampion(id, 'red');
      else pickChampion(id, 'red');
      setBotThinking(false);
    }, 1100);
    return () => clearTimeout(t);
  }, [draft.currentTeam, draft.currentAction, draft.phase, practiceMode, banChampion, pickChampion, patch.tierlist]);

  const handlePreDraftBan = (championId: string) => {
    banChampion(championId, 'blue');
  };

  const detailChampion = useMemo(() =>
    detailChampId ? champions.find((c) => c.id === detailChampId) ?? null : null,
    [detailChampId]);

  const handleModeChange = (newMode: DraftAction, newTeam: Team) => {
    setGridMode(newMode);
    setGridTeam(newTeam);
    setAction(newMode, newTeam);
  };

  const handleChampionSelect = (championId: string) => {
    if (liveMode) return;
    if (draft.phase === 'complete') return;
    if (practiceMode && draft.currentTeam !== 'blue') return;
    if (gridMode === 'ban') banChampion(championId, gridTeam);
    else pickChampion(championId, gridTeam);
  };

  const blueAnalysis = useMemo(() =>
    analyzeComp(draft.picks.blue.filter((id): id is string => id !== null), champions),
    [draft.picks.blue]);
  const redAnalysis = useMemo(() =>
    analyzeComp(draft.picks.red.filter((id): id is string => id !== null), champions),
    [draft.picks.red]);

  const recommendations = useMemo(() => {
    const total = draft.picks.blue.filter(Boolean).length + draft.picks.red.filter(Boolean).length;
    return total >= 2 ? getRecommendations(draft, player.masteries, 3, patch.matchups) : [];
  }, [draft, player.masteries, patch.matchups]);

  // Auto-save to AsyncStorage + Firestore on draft completion
  useEffect(() => {
    if (draft.phase !== 'complete') return;
    const blueIds = draft.picks.blue.filter((id): id is string => id !== null);
    const redIds  = draft.picks.red.filter((id): id is string => id !== null);
    if (blueIds.length === 0 && redIds.length === 0) return;
    const blueA = analyzeComp(blueIds, champions);
    const redA  = analyzeComp(redIds,  champions);
    const record: LocalDraftRecord = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      playerRole: role,
      picks: draft.picks,
      bans: draft.bans,
      blueScore: draftScore(blueA),
      redScore:  draftScore(redA),
      summoner:  player.puuid && player.region ? {
        puuid:  player.puuid,
        region: player.region,
        name:   player.summonerName,
        tag:    player.tagLine,
      } : undefined,
      review:    player.puuid ? { kind: 'pending' } : undefined,
    };
    // AsyncStorage (local)
    AsyncStorage.getItem('draft-history').then((raw) => {
      let existing: LocalDraftRecord[] = [];
      try {
        existing = JSON.parse(raw ?? '[]');
      } catch (err) {
        console.warn('[draft] corrupt draft-history, resetting:', (err as Error)?.message);
      }
      const last = existing[0];
      if (!last || Math.abs(Number(record.id) - Number(last.id)) > 5000) {
        existing.unshift(record);
        AsyncStorage.setItem('draft-history', JSON.stringify(existing.slice(0, 50))).catch(
          (err) => console.warn('[draft] failed to write history:', err?.message ?? err),
        );
      }
    }).catch((err) => console.warn('[draft] failed to read history:', err?.message ?? err));
    // Firestore (cloud)
    if (isFirebaseConfigured && auth.user?.uid) {
      saveDraft({
        uid: auth.user.uid,
        createdAt: new Date().toISOString(),
        playerRole: role,
        picks: draft.picks,
        bans: draft.bans,
        topRecommendation: recommendations[0]?.championId,
      }).catch((err) => console.warn('[draft] failed to save to Firestore:', err?.message ?? err));
    }
  }, [draft.phase, role, auth.user?.uid, recommendations]);

  const banSuggestions = useMemo(() =>
    getBanSuggestions(allPickedOrBanned, player.masteries, 5, role, patch.tierlist, patch.matchups),
    [allPickedOrBanned, player.masteries, role, patch.tierlist, patch.matchups]);

  const handleGetRecommendations = () => {
    const recs = getRecommendations(draft, player.masteries, 3, patch.matchups);
    setRecommendations(recs);
    setDraftSnapshot(draft);
    router.push('/results');
  };

  const handleReset = () => {
    reset();
    resetAll();
    router.replace('/');
  };

  const totalPicks = draft.picks.blue.filter(Boolean).length + draft.picks.red.filter(Boolean).length;
  const hasPicks = draft.picks.blue.some(Boolean) || draft.picks.red.some(Boolean);
  const isBotTurn = practiceMode && draft.currentTeam === 'red' && draft.phase !== 'complete';
  const isGridDisabled = !!liveMode || isBotTurn;
  const isYourTurn = draft.currentTeam === playerTeam && draft.currentAction === 'pick' && draft.phase !== 'complete';

  const { settings } = useSettings();
  useDraftSounds({
    enabled: settings.soundEnabled,
    isYourTurn,
    liveMode: !!liveMode,
  });

  const enemyPickCount = draft.picks.red.filter(Boolean).length;
  const weaknessCallout = useMemo(() => {
    if (enemyPickCount < 2) return null;
    return getWeaknessCallout(redAnalysis, blueAnalysis);
  }, [redAnalysis, blueAnalysis, enemyPickCount]);

  const liveStatusLabel =
    liveStatus === 'active'   ? 'Live from PC'
    : liveStatus === 'waiting' ? 'Waiting for PC connector...'
    : liveStatus === 'stale'  ? 'Connector stopped updating \u2014 is it still running?'
    : liveStatus === 'ended'  ? 'Champion select ended'
    : liveStatus === 'error'  ? 'Connection error \u2014 check sign-in'
    : 'Idle';

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      {/* Live mode banner */}
      {liveMode && (
        <View className="bg-emerald-500/15 border-b border-emerald-500/40 px-4 py-1.5 flex-row items-center justify-center gap-3">
          <View className={`w-2 h-2 rounded-full ${
            liveStatus === 'active' ? 'bg-emerald-400'
            : liveStatus === 'error' ? 'bg-red-400'
            : 'bg-yellow-400'
          }`} />
          <Text className="text-xs font-semibold text-emerald-400">Live Mode</Text>
          <Text className="text-[10px] text-lol-text flex-1">{liveStatusLabel}</Text>
          <Pressable onPress={() => { resetAll(); router.replace('/'); }}>
            <Text className="text-[10px] text-lol-text/70 underline">Exit</Text>
          </Pressable>
        </View>
      )}

      {/* Practice mode banner */}
      {practiceMode && (
        <View className="bg-lol-purple/20 border-b border-lol-purple/40 px-4 py-1.5 flex-row items-center justify-center gap-3">
          <Text className="text-xs font-semibold text-lol-purple">{'Practice Mode \u2014 vs Meta Bot'}</Text>
          {isBotTurn && <Text className="text-[10px] text-lol-text">Bot is thinking...</Text>}
        </View>
      )}

      {/* Top Bar */}
      <View className="bg-lol-darker border-b border-lol-border px-2 py-1.5 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 flex-1 min-w-0">
          <Text className="text-lol-gold font-bold text-sm">DraftDiff</Text>
          <Text className="text-lol-text text-xs" numberOfLines={1}>
            {player.summonerName} {'\u00B7'} {role.toUpperCase()}
          </Text>
        </View>
        <Timer seconds={timer.seconds} isActive={timer.isActive} />
        <View className="flex-row gap-1">
          <Pressable
            onPress={undo}
            disabled={!canUndo || !!liveMode}
            className={`px-2 py-1 bg-lol-card border border-lol-border rounded ${(!canUndo || !!liveMode) ? 'opacity-30' : ''}`}
          >
            <Text className="text-lol-text text-[10px]">{'\u21A9'}</Text>
          </Pressable>
          {draft.phase === 'complete' && (
            <Pressable onPress={() => setShowComplete(true)} className="px-2 py-1 bg-lol-gold rounded">
              <Text className="text-lol-dark text-[10px] font-bold">Summary</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleGetRecommendations}
            disabled={totalPicks < 2}
            className={`px-2 py-1 bg-lol-purple rounded ${totalPicks < 2 ? 'opacity-40' : ''}`}
          >
            <Text className="text-white text-[10px] font-bold">Get Picks</Text>
          </Pressable>
          <Pressable onPress={handleReset} className="px-2 py-1 bg-lol-card border border-lol-border rounded">
            <Text className="text-lol-text text-[10px]">Reset</Text>
          </Pressable>
        </View>
      </View>

      {/* Draft Strip — compact pick/ban visualization */}
      <CompactDraftStrip draft={draft} champions={champions} />

      {/* Suggestion chips — horizontal scroll */}
      {(weaknessCallout || banSuggestions.length > 0 || recommendations.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-3 py-1.5 gap-2 items-center"
          className="border-b border-lol-border"
          style={{ maxHeight: 40 }}
        >
          {weaknessCallout && (
            <View className="flex-row items-center gap-1 bg-lol-card border border-lol-gold/20 rounded-full px-2.5 py-1">
              <Text className="text-xs">{weaknessCallout.icon}</Text>
              <Text className={`text-[10px] font-semibold ${weaknessCallout.color}`} numberOfLines={1}>
                {weaknessCallout.text}
              </Text>
            </View>
          )}
          {draft.currentAction === 'ban' && banSuggestions.map((ban) => (
            <Pressable
              key={ban.championId}
              onPress={() => banChampion(ban.championId, draft.currentTeam)}
              className="flex-row items-center gap-1.5 bg-lol-card border border-lol-red/30 rounded-full px-2 py-1"
            >
              <Image
                source={{ uri: getChampionImageUrl(ban.ddragonId) }}
                className="w-5 h-5 rounded-full"
                resizeMode="cover"
              />
              <Text className="text-[10px] text-lol-text-bright font-medium">{ban.championName}</Text>
            </Pressable>
          ))}
          {draft.currentAction === 'pick' && recommendations.map((rec) => {
            const champ = champions.find((c) => c.id === rec.championId);
            return (
              <Pressable
                key={rec.championId}
                onPress={() => pickChampion(rec.championId, gridTeam)}
                className="flex-row items-center gap-1.5 bg-lol-card border border-lol-green/30 rounded-full px-2 py-1"
              >
                {champ && (
                  <Image
                    source={{ uri: getChampionImageUrl(champ.ddragonId) }}
                    className="w-5 h-5 rounded-full"
                    resizeMode="cover"
                  />
                )}
                <Text className="text-[10px] text-lol-text-bright font-medium">{rec.championName}</Text>
                <Text className="text-[10px] text-lol-green font-bold">{rec.winProbability.toFixed(0)}%</Text>
              </Pressable>
            );
          })}
          {recommendations.length > 0 && (
            <Pressable onPress={handleGetRecommendations} className="flex-row items-center gap-1 bg-lol-gold/20 border border-lol-gold/40 rounded-full px-2.5 py-1">
              <Text className="text-[10px] text-lol-gold font-semibold">{'Full Analysis \u2192'}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Your turn banner */}
      {isYourTurn && !liveMode && (
        <View className="mx-3 mt-1.5 flex-row items-center gap-2 bg-lol-gold/10 border border-lol-gold/40 rounded-md px-3 py-1.5">
          <Text className="text-lol-gold text-xs font-bold uppercase tracking-widest">Your Turn!</Text>
        </View>
      )}

      {/* Champion grid — full width */}
      <View className={`flex-1 px-2 pt-1.5 ${isGridDisabled ? 'opacity-50' : ''}`} pointerEvents={isGridDisabled ? 'none' : 'auto'}>
        <ChampionGrid
          onSelect={handleChampionSelect}
          onChampionInfo={setDetailChampId}
          disabledIds={allPickedOrBanned}
          mode={gridMode}
          currentTeam={gridTeam}
          masteries={player.masteries}
          playerRole={role}
          playerTeam={playerTeam}
          onModeChange={(practiceMode || liveMode) ? undefined : handleModeChange}
        />
      </View>
      {/* Modals */}
      {showPreDraft && banSuggestions.length > 0 && draft.phase !== 'complete' && (
        <PreDraftBansModal
          suggestions={banSuggestions}
          onBan={handlePreDraftBan}
          onClose={() => setShowPreDraft(false)}
          playerRole={role}
        />
      )}

      {showComplete && (
        <DraftCompleteModal
          draft={draft}
          champions={champions}
          recommendations={recommendations}
          onGetRecommendations={handleGetRecommendations}
          onContinueEditing={() => setShowComplete(false)}
          onViewHistory={() => { setShowComplete(false); router.push('/history'); }}
        />
      )}

      {detailChampion && (
        <ChampionDetailModal
          champion={detailChampion}
          onClose={() => setDetailChampId(null)}
        />
      )}
    </SafeAreaView>
  );
}

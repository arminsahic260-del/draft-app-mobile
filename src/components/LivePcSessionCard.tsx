// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.
//
// SetupScreen card that surfaces an active live-draft session being
// published by the PC connector. When the user has a linked Riot ID,
// they can jump straight into live mode.

import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../api/firebase';
import type { PlayerProfile, Role } from '../types';
import { useAppContext } from '../context/AppContext';
import { router } from 'expo-router';

const STALE_AFTER_MS = 5 * 60 * 1000;

function formatLastSync(updatedMs: number | null): string | null {
  if (!updatedMs) return null;
  const diff = Math.max(0, Date.now() - updatedMs);
  if (diff < 2_000)   return 'just now';
  if (diff < 60_000)  return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

type LiveDoc = {
  status?: 'active' | 'ended';
  updatedAt?: Timestamp;
  playerTeam?: 'blue' | 'red';
  playerRole?: Role;
  phase?: string;
};

type Status = 'hidden' | 'active' | 'stale';

interface Props {
  player: PlayerProfile | null;
  selectedRole: Role | null;
}

function tsToMs(t: unknown): number | null {
  if (!t) return null;
  if (t instanceof Timestamp) return t.toMillis();
  if (typeof t === 'object' && t !== null && 'seconds' in t) {
    return (t as { seconds: number }).seconds * 1000;
  }
  return null;
}

export default function LivePcSessionCard({ player, selectedRole }: Props) {
  const { auth, setPlayer, setRole, setPracticeMode, setLiveMode } = useAppContext();
  const [status, setStatus] = useState<Status>('hidden');
  const [sessionRole, setSessionRole] = useState<Role | null>(null);
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  // Ticker that forces the "Xs ago" badge to re-render every second so the
  // connector liveness signal feels real-time.
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!isFirebaseConfigured || !auth.user?.uid) {
      setStatus('hidden');
      return;
    }

    const ref = doc(getFirebaseDb(), 'liveSessions', auth.user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) { setStatus('hidden'); setSessionRole(null); setLastSyncMs(null); return; }
        const data = snap.data() as LiveDoc;
        const updatedMs = tsToMs(data.updatedAt);
        setLastSyncMs(updatedMs);
        if (updatedMs && Date.now() - updatedMs > STALE_AFTER_MS) {
          setStatus('stale');
        } else {
          setStatus('active');
        }
        setSessionRole(data.playerRole ?? null);
      },
      () => setStatus('hidden'),
    );
    return unsub;
  }, [auth.user?.uid]);

  // 1-second tick while the card is visible. No interval when hidden.
  useEffect(() => {
    if (status === 'hidden') return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'hidden') return null;

  const lastSyncLabel = formatLastSync(lastSyncMs);
  void nowTick; // keep the lint quiet — we depend on it for re-render cadence

  const handleEnterLive = () => {
    if (!player) return;
    setPlayer(player);
    setRole(selectedRole ?? sessionRole ?? 'mid');
    setPracticeMode(false);
    setLiveMode(true);
    router.push('/draft');
  };

  const canEnter = !!player;
  const isStale = status === 'stale';

  return (
    <View className={`rounded-lg p-4 gap-2 border ${isStale ? 'bg-lol-card border-yellow-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
      <View className="flex-row items-center gap-2">
        <View className={`w-2 h-2 rounded-full ${isStale ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
        <Text className={`text-xs font-bold uppercase tracking-wider ${isStale ? 'text-yellow-400' : 'text-emerald-400'}`}>
          {isStale ? 'PC connector idle' : '\uD83C\uDFAE PC champ select active'}
        </Text>
        {lastSyncLabel && (
          <Text className={`ml-auto text-[10px] ${isStale ? 'text-yellow-400/70' : 'text-emerald-400/70'}`}>
            sync {lastSyncLabel}
          </Text>
        )}
      </View>

      {isStale ? (
        <Text className="text-[11px] text-lol-text/70">
          Your connector stopped publishing updates ({'>'}5 min). Check the script on PC.
        </Text>
      ) : (
        <Text className="text-[11px] text-lol-text/80">
          {sessionRole ? `Role: ${sessionRole.toUpperCase()} \u00B7 ` : ''}Mirror picks/bans from your PC in real time.
        </Text>
      )}

      {!isStale && (
        <Pressable
          onPress={handleEnterLive}
          disabled={!canEnter}
          className={`mt-1 self-start px-3 py-1.5 rounded ${canEnter ? 'bg-emerald-500' : 'bg-emerald-500/40'}`}
        >
          <Text className={`text-xs font-bold ${canEnter ? 'text-lol-dark' : 'text-lol-dark/50'}`}>
            {canEnter ? 'Enter Live Draft \u2192' : 'Link your Riot ID above first'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

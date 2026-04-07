// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppContext } from '../src/context/AppContext';
import { usePlayer } from '../src/hooks/usePlayer';
import RolePicker from '../src/components/RolePicker';
import { isFirebaseConfigured, FREE_DRAFT_LIMIT } from '../src/api/firebase';
import { redirectToCheckout, redirectToPortal } from '../src/api/stripe';
import { ENV } from '../src/config/env';
import type { Role } from '../src/types';

const REGIONS = [
  { label: 'EUW',  value: 'euw1' },
  { label: 'EUNE', value: 'eun1' },
  { label: 'NA',   value: 'na1'  },
  { label: 'KR',   value: 'kr'   },
  { label: 'BR',   value: 'br1'  },
  { label: 'JP',   value: 'jp1'  },
  { label: 'LAN',  value: 'la1'  },
  { label: 'LAS',  value: 'la2'  },
  { label: 'OCE',  value: 'oc1'  },
  { label: 'TR',   value: 'tr1'  },
  { label: 'RU',   value: 'ru'   },
];

export default function SetupScreen() {
  const { auth, setPlayer, setRole, setPracticeMode, role } = useAppContext();
  const [name, setName] = useState('');
  const [region, setRegion] = useState(ENV.RIOT_REGION || 'euw1');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const { player, loading, error, lookupPlayer } = usePlayer();

  const proxyConfigured = !!ENV.RIOT_PROXY_URL;
  const API_BASE = ENV.API_BASE;
  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region.toUpperCase();

  const handleSearch = () => {
    if (name.trim()) lookupPlayer(name.trim(), region);
  };

  const canStart = player !== null && selectedRole !== null;

  const handleStart = () => {
    if (!canStart) return;
    setPlayer(player);
    setRole(selectedRole!);
    setPracticeMode(false);
    setLiveMode(false);
    router.push('/draft');
  };

  const handlePractice = () => {
    if (!canStart) return;
    setPlayer(player);
    setRole(selectedRole!);
    setPracticeMode(true);
    setLiveMode(false);
    router.push('/draft');
  };

  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-4 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md self-center gap-5">

          {/* Logo */}
          <View className="items-center">
            <Text className="text-3xl font-bold text-lol-gold-light tracking-tight">
              DraftDiff
            </Text>
            <Text className="text-sm text-lol-text mt-1">
              Smart champion recommendations for your ranked games
            </Text>
          </View>

          {/* Auth bar */}
          {isFirebaseConfigured && (
            <View className="bg-lol-card border border-lol-border rounded-lg px-4 py-3 flex-row items-center justify-between gap-3">
              {auth.user ? (
                <>
                  <View className="flex-row items-center gap-2 flex-1 min-w-0">
                    {auth.user.photoURL && (
                      <Image
                        source={{ uri: auth.user.photoURL }}
                        className="w-7 h-7 rounded-full"
                      />
                    )}
                    <View className="min-w-0 flex-1">
                      <Text className="text-xs font-semibold text-lol-text-bright" numberOfLines={1}>
                        {auth.user.displayName}
                      </Text>
                      <Text className="text-[10px] text-lol-text">
                        {auth.isPro
                          ? '⭐ Pro'
                          : `Free · ${Math.max(0, FREE_DRAFT_LIMIT - auth.draftCount)} drafts left today`}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end gap-1">
                    {auth.isPro && (
                      <Pressable onPress={() => {
                        if (API_BASE) {
                          auth.user && redirectToPortal(auth.user.uid);
                        } else {
                          Alert.alert('Coming soon', 'Subscription management is not yet available.');
                        }
                      }}>
                        <Text className="text-[10px] text-lol-gold/70">Manage subscription</Text>
                      </Pressable>
                    )}
                    {!auth.isPro && auth.user?.email && (
                      <Pressable onPress={() => {
                        if (API_BASE) {
                          redirectToCheckout(auth.user!.uid, auth.user!.email!);
                        } else {
                          Alert.alert('Coming soon', 'Pro upgrade is not yet available.');
                        }
                      }}>
                        <Text className="text-[10px] text-lol-gold font-semibold">Upgrade to Pro</Text>
                      </Pressable>
                    )}
                  </View>
                  <Pressable onPress={auth.signOut}>
                    <Text className="text-[10px] text-lol-text/60">Sign out</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="text-xs text-lol-text flex-1">Sign in to track drafts & unlock Pro</Text>
                  <Pressable
                    onPress={auth.signIn}
                    className="px-3 py-1.5 bg-lol-card border border-lol-gold/40 rounded"
                  >
                    <Text className="text-lol-gold text-xs font-semibold">Sign in with Google</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Summoner Search */}
          <View className="bg-lol-card border border-lol-border rounded-lg p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-lol-gold uppercase tracking-wide">
                Link Your Account
              </Text>
              {!proxyConfigured && (
                <Text className="text-[9px] text-lol-text/40 italic">mock data mode</Text>
              )}
            </View>

            {/* Region selector */}
            <View className="gap-1.5">
              <Text className="text-[10px] text-lol-text uppercase tracking-wide">Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
                {REGIONS.map((r) => (
                  <Pressable
                    key={r.value}
                    onPress={() => setRegion(r.value)}
                    className={`px-2.5 py-1 rounded ${
                      region === r.value
                        ? 'bg-lol-gold'
                        : 'bg-lol-darker border border-lol-border'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${
                      region === r.value ? 'text-lol-dark font-bold' : 'text-lol-text'
                    }`}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Summoner name input */}
            <View className="flex-row gap-2">
              <TextInput
                placeholder={proxyConfigured ? `SummonerName#${regionLabel}` : 'Any name (demo mode)'}
                placeholderTextColor="rgba(160,155,140,0.5)"
                value={name}
                onChangeText={setName}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                className="flex-1 bg-lol-darker border border-lol-border rounded px-3 py-2 text-sm text-lol-text-bright"
              />
              <Pressable
                onPress={handleSearch}
                disabled={!name.trim() || loading}
                className={`px-4 py-2 rounded ${
                  !name.trim() || loading ? 'bg-lol-gold/40' : 'bg-lol-gold'
                }`}
              >
                <Text className="text-lol-dark text-sm font-bold">
                  {loading ? '...' : 'Search'}
                </Text>
              </Pressable>
            </View>
            {error && <Text className="text-lol-red text-xs">{error}</Text>}
          </View>

          {/* Player Profile Card */}
          {player && (
            <View className="bg-lol-card border border-lol-border rounded-lg p-4 gap-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <View className="flex-row items-baseline">
                    <Text className="text-lg font-bold text-lol-text-bright">
                      {player.summonerName}
                    </Text>
                    <Text className="text-lol-text text-sm ml-1">#{player.tagLine}</Text>
                  </View>
                  <Text className="text-sm text-lol-gold">
                    {player.tier} {player.division} — {player.lp} LP
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm text-lol-text-bright">
                    {player.wins}W {player.losses}L
                  </Text>
                  <Text className="text-xs text-lol-text">
                    {player.wins + player.losses > 0
                      ? `${((player.wins / (player.wins + player.losses)) * 100).toFixed(1)}% WR`
                      : 'No ranked games'}
                  </Text>
                </View>
              </View>

              {/* Champion Pool */}
              <View>
                <Text className="text-xs font-semibold text-lol-text uppercase tracking-wide">
                  Champion Pool
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {player.masteries.slice(0, 8).map((m) => (
                    <View key={m.championId} className="bg-lol-darker border border-lol-border rounded px-2 py-1 flex-row items-center">
                      <Text className="text-lol-text-bright font-medium text-xs capitalize">
                        {m.championId}
                      </Text>
                      <Text className="text-lol-text text-xs ml-1">
                        M{m.masteryLevel}
                        {m.gamesPlayed > 0 ? ` · ${m.gamesPlayed}G` : ''}
                        {m.winRate !== null && m.winRate !== undefined ? (
                          <Text className={
                            m.winRate >= 55 ? 'text-lol-green'
                            : m.winRate <= 45 ? 'text-lol-red'
                            : ''
                          }> · {m.winRate}%</Text>
                        ) : null}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Role Picker */}
              <View>
                <Text className="text-xs font-semibold text-lol-text uppercase tracking-wide mb-2">
                  Primary Role
                </Text>
                <RolePicker selected={selectedRole} onSelect={setSelectedRole} />
              </View>
            </View>
          )}

          {/* Start Buttons */}
          {player && (
            <View className="gap-2">
              {!selectedRole && (
                <Text className="text-center text-xs text-lol-gold/70">
                  {'\u2191'} Select your role to start
                </Text>
              )}
              <Pressable
                onPress={handleStart}
                disabled={!canStart}
                className={`w-full py-3 rounded-lg items-center ${
                  canStart ? 'bg-lol-gold' : 'bg-lol-gold/30'
                }`}
              >
                <Text className={`font-bold text-sm uppercase tracking-wider ${
                  canStart ? 'text-lol-dark' : 'text-lol-dark/50'
                }`}>
                  Start Draft
                </Text>
              </Pressable>

              <Pressable
                onPress={handlePractice}
                disabled={!canStart}
                className={`w-full py-2 rounded-lg bg-lol-card border items-center flex-row justify-center gap-2 ${
                  canStart ? 'border-lol-purple/40' : 'border-lol-border'
                }`}
              >
                <Text className={`text-xs font-semibold ${
                  canStart ? 'text-lol-purple' : 'text-lol-purple/30'
                }`}>
                  Practice vs Meta Bot
                </Text>
              </Pressable>

            </View>
          )}

          {/* Footer links */}
          <View className="flex-row items-center justify-center gap-3">
            <Pressable onPress={() => router.push('/history')}>
              <Text className="py-2 text-xs text-lol-text/50">🕐 View Draft History</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/terms')}>
              <Text className="py-2 text-xs text-lol-text/50">Terms of Service</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

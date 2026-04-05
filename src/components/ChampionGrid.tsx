// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import type { Champion, Role, DamageType, PlayerMastery, Team, DraftAction } from '../types';
import ChampionCard from './ChampionCard';
import championsData from '../data/champions.json';
import tierlistData from '../data/tierlist.json';

type RoleFilter = 'all' | Role;
type DmgFilter  = 'all' | DamageType;

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: 'All',     value: 'all'     },
  { label: 'Top',     value: 'top'     },
  { label: 'Jungle',  value: 'jungle'  },
  { label: 'Mid',     value: 'mid'     },
  { label: 'ADC',     value: 'adc'     },
  { label: 'Support', value: 'support' },
];

const DMG_FILTERS: { label: string; value: DmgFilter; active: string; inactive: string }[] = [
  { label: 'All',   value: 'all',   active: 'bg-lol-gold text-lol-dark border-lol-gold',   inactive: 'border-lol-border text-lol-text' },
  { label: 'AD',    value: 'AD',    active: 'bg-lol-red text-white border-lol-red',         inactive: 'border-lol-red/40 text-lol-red' },
  { label: 'AP',    value: 'AP',    active: 'bg-lol-blue text-white border-lol-blue',       inactive: 'border-lol-blue/40 text-lol-blue' },
  { label: 'Mix',   value: 'mixed', active: 'bg-lol-purple text-white border-lol-purple',   inactive: 'border-lol-purple/40 text-lol-purple' },
];

const tierlist = tierlistData as Record<string, string[]>;
function getTier(id: string): string | undefined {
  for (const [tier, ids] of Object.entries(tierlist)) {
    if (ids.includes(id)) return tier;
  }
  return undefined;
}

const ACTION_BUTTONS: { label: string; mode: DraftAction; team: Team; active: string; inactive: string }[] = [
  { label: 'Blue Pick', mode: 'pick', team: 'blue', active: 'bg-lol-blue text-white border-lol-blue', inactive: 'border-lol-blue/40 text-lol-blue' },
  { label: 'Red Pick',  mode: 'pick', team: 'red',  active: 'bg-lol-red text-white border-lol-red',   inactive: 'border-lol-red/40 text-lol-red' },
  { label: 'Ban',       mode: 'ban',  team: 'blue', active: 'bg-gray-600 text-white border-gray-600', inactive: 'border-gray-600 text-lol-text' },
];

interface ChampionGridProps {
  onSelect: (championId: string) => void;
  onChampionInfo?: (championId: string) => void;
  disabledIds: string[];
  mode: DraftAction;
  currentTeam: Team;
  masteries?: PlayerMastery[];
  playerRole?: Role;
  playerTeam?: Team;
  onModeChange?: (mode: DraftAction, team: Team) => void;
}

export default function ChampionGrid({
  onSelect, onChampionInfo, disabledIds, mode, currentTeam, masteries = [],
  playerRole, playerTeam, onModeChange,
}: ChampionGridProps) {
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(playerRole ?? 'all');
  const [dmgFilter, setDmgFilter]   = useState<DmgFilter>('all');

  const champions = championsData as Champion[];

  useEffect(() => {
    const isYourPick = mode === 'pick' && playerTeam !== undefined && currentTeam === playerTeam;
    setRoleFilter(isYourPick ? (playerRole ?? 'all') : 'all');
  }, [mode, playerRole, currentTeam, playerTeam]);

  const masteryMap = useMemo(() => {
    const m: Record<string, PlayerMastery> = {};
    for (const entry of masteries) m[entry.championId] = entry;
    return m;
  }, [masteries]);

  const filtered = useMemo(() => {
    return champions
      .filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
        const matchesRole   = roleFilter === 'all' || c.roles.includes(roleFilter as Role);
        const matchesDmg    = dmgFilter  === 'all' || c.damageType === dmgFilter;
        return matchesSearch && matchesRole && matchesDmg;
      })
      .sort((a, b) => {
        const mA = masteryMap[a.id]?.gamesPlayed ?? 0;
        const mB = masteryMap[b.id]?.gamesPlayed ?? 0;
        if (mA !== mB) return mB - mA;
        const tScore: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };
        const tA = tScore[getTier(a.id) ?? 'C'] ?? 0;
        const tB = tScore[getTier(b.id) ?? 'C'] ?? 0;
        return tB - tA;
      });
  }, [champions, search, roleFilter, dmgFilter, masteryMap]);

  const isBanMode = mode === 'ban';
  const headerColor = isBanMode ? 'text-lol-red' : currentTeam === 'blue' ? 'text-lol-blue' : 'text-lol-red';
  const headerLabel = isBanMode
    ? `Ban Phase \u2014 ${currentTeam === 'blue' ? 'Blue' : 'Red'} Side`
    : `Pick Phase \u2014 ${currentTeam === 'blue' ? 'Blue' : 'Red'} Side`;

  return (
    <View className="flex-1 gap-2">
      {/* Header */}
      <View className="rounded-md border border-lol-border bg-lol-card px-3 py-2 gap-2">
        <View className="flex-row items-center justify-between">
          <Text className={`text-xs font-semibold tracking-wide uppercase ${headerColor}`}>
            {headerLabel}
          </Text>
        </View>

        {/* Mode change buttons */}
        {onModeChange && (
          <View className="flex-row gap-1">
            {ACTION_BUTTONS.map((btn) => {
              const isActive = btn.mode === mode && (btn.mode === 'ban' || btn.team === currentTeam);
              return (
                <Pressable
                  key={btn.label}
                  onPress={() => onModeChange(btn.mode, btn.team)}
                  className={`px-2 py-1 rounded border ${isActive ? btn.active : `bg-lol-card ${btn.inactive}`}`}
                >
                  <Text className={`text-[10px] font-semibold ${isActive ? 'text-white' : ''}`}>{btn.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Search */}
        <TextInput
          placeholder="Search champion..."
          placeholderTextColor="rgba(160,155,140,0.5)"
          value={search}
          onChangeText={setSearch}
          className="bg-lol-darker border border-lol-border rounded px-2 py-1 text-sm text-lol-text-bright"
        />

        {/* Role filters */}
        <View className="flex-row gap-1 flex-wrap">
          {ROLE_FILTERS.map((rf) => (
            <Pressable
              key={rf.value}
              onPress={() => setRoleFilter(rf.value)}
              className={`px-2 py-0.5 rounded ${
                roleFilter === rf.value
                  ? 'bg-lol-gold'
                  : 'bg-lol-card border border-lol-border'
              }`}
            >
              <Text className={`text-xs font-medium ${
                roleFilter === rf.value ? 'text-lol-dark font-bold' : 'text-lol-text'
              }`}>
                {rf.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Damage type filters */}
        <View className="flex-row gap-1">
          {DMG_FILTERS.map((df) => (
            <Pressable
              key={df.value}
              onPress={() => setDmgFilter(df.value)}
              className={`px-2 py-0.5 rounded border ${dmgFilter === df.value ? df.active : `bg-lol-card ${df.inactive}`}`}
            >
              <Text className={`text-xs font-medium ${dmgFilter === df.value ? '' : ''}`}>{df.label}</Text>
            </Pressable>
          ))}
          <Text className="ml-auto text-[10px] text-lol-text/50 self-center">{filtered.length} champs</Text>
        </View>
      </View>

      {/* Champion grid */}
      {filtered.length === 0 ? (
        <View className="items-center justify-center h-24">
          <Text className="text-lol-text text-sm">No champions found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={6}
          contentContainerClassName="gap-1"
          columnWrapperClassName="gap-1"
          renderItem={({ item: champion }) => {
            const isDisabled = disabledIds.includes(champion.id);
            return (
              <ChampionCard
                champion={champion}
                onPress={() => onSelect(champion.id)}
                onLongPress={onChampionInfo ? () => onChampionInfo(champion.id) : undefined}
                disabled={isDisabled}
                banned={isDisabled && mode === 'ban'}
                size="md"
                mastery={masteryMap[champion.id]}
                tier={getTier(champion.id)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

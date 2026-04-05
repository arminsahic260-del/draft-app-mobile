// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { PlayerProfile, PlayerMastery } from '../types';
import mockPlayerData from '../data/mockPlayer.json';
import { ENV } from '../config/env';

const PROXY_URL   = ENV.RIOT_PROXY_URL || undefined;
const RIOT_REGION = ENV.RIOT_REGION || 'euw1';

export function parseSummonerInput(raw: string): { name: string; tag: string } {
  const parts = raw.trim().split('#');
  return {
    name: parts[0].trim(),
    tag:  parts[1]?.trim() ?? RIOT_REGION.toUpperCase(),
  };
}

interface ProxySummonerResponse {
  summonerName: string;
  tagLine: string;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  masteries: PlayerMastery[];
}

export async function fetchPlayer(summonerInput: string): Promise<PlayerProfile> {
  const { name, tag } = parseSummonerInput(summonerInput);
  if (PROXY_URL) return fetchViaProxy(name, tag);
  return fetchMock(name, tag);
}

async function fetchViaProxy(name: string, tag: string): Promise<PlayerProfile> {
  const url = `${PROXY_URL}/summoner?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&region=${RIOT_REGION}`;
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Summoner not found: ${msg}`);
  }
  const data: ProxySummonerResponse = await res.json();
  return {
    summonerName: data.summonerName,
    tagLine:      data.tagLine,
    tier:         data.tier,
    division:     data.division,
    lp:           data.lp,
    wins:         data.wins,
    losses:       data.losses,
    masteries:    data.masteries,
  };
}

async function fetchMock(name: string, tag: string): Promise<PlayerProfile> {
  await new Promise((r) => setTimeout(r, 400));
  const mock = mockPlayerData as PlayerProfile;
  return { ...mock, summonerName: name, tagLine: tag };
}

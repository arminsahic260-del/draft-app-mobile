// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { PlayerProfile, PlayerMastery, DraftMatchResult } from '../types';
import mockPlayerData from '../data/mockPlayer.json';
import { ENV } from '../config/env';

const PROXY_URL   = ENV.RIOT_PROXY_URL || undefined;
const RIOT_REGION = ENV.RIOT_REGION || 'euw1';

export function parseSummonerInput(raw: string, region?: string): { name: string; tag: string } {
  const parts = raw.trim().split('#');
  const defaultRegion = region || RIOT_REGION;
  return {
    name: parts[0].trim(),
    tag:  parts[1]?.trim() || defaultRegion.toUpperCase(),
  };
}

interface ProxySummonerResponse {
  summonerName: string;
  tagLine: string;
  puuid?: string;
  region?: string;
  tier: string;
  division: string;
  lp: number;
  wins: number;
  losses: number;
  masteries: PlayerMastery[];
}

export async function fetchPlayer(summonerInput: string, region?: string): Promise<PlayerProfile> {
  const activeRegion = region || RIOT_REGION;
  const { name, tag } = parseSummonerInput(summonerInput, activeRegion);
  if (PROXY_URL) return fetchViaProxy(name, tag, activeRegion);
  return fetchMock(name, tag);
}

async function fetchViaProxy(name: string, tag: string, region: string): Promise<PlayerProfile> {
  const url = `${PROXY_URL}/summoner?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&region=${region}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Summoner not found: ${msg}`);
    }
    const data: ProxySummonerResponse = await res.json();
    return {
      summonerName: data.summonerName,
      tagLine:      data.tagLine,
      puuid:        data.puuid,
      region:       data.region ?? region,
      tier:         data.tier,
      division:     data.division,
      lp:           data.lp,
      wins:         data.wins,
      losses:       data.losses,
      masteries:    data.masteries,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out — check your connection.');
    }
    throw err;
  }
}

async function fetchMock(name: string, tag: string): Promise<PlayerProfile> {
  await new Promise((r) => setTimeout(r, 400));
  const mock = mockPlayerData as PlayerProfile;
  return { ...mock, summonerName: name, tagLine: tag };
}

// ── Match review ─────────────────────────────────────────────────────────────

interface MatchReviewResponse {
  result: DraftMatchResult | null;
  reason?: string;
}

export async function fetchMatchReview(args: {
  puuid: string;
  region: string;
  sinceMs: number;
  bluePicks: string[];
  redPicks: string[];
}): Promise<
  | { ok: true; result: DraftMatchResult | null; reason?: string }
  | { ok: false; error: string }
> {
  if (!PROXY_URL) {
    return { ok: true, result: null, reason: 'mock-mode' };
  }

  const params = new URLSearchParams({
    puuid:          args.puuid,
    region:         args.region,
    sinceTimestamp: String(args.sinceMs),
    blue:           args.bluePicks.filter(Boolean).join(','),
    red:            args.redPicks.filter(Boolean).join(','),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `${PROXY_URL}/match-review?${params.toString()}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as MatchReviewResponse;
    return { ok: true, result: data.result, reason: data.reason };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out' };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// Copyright (c) 2026 Armin Sahic. All rights reserved.
// GET /api/summoner?name=...&tag=...&region=euw1
// Lightweight Riot API proxy for Vercel serverless.

import { checkRateLimit } from './_ratelimit.js';

const REGIONAL = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  euw1: 'europe',  eun1: 'europe',  tr1: 'europe',   ru: 'europe',
  kr: 'asia',      jp1: 'asia',
  oc1: 'sea',      ph2: 'sea',      sg2: 'sea',      th2: 'sea',
  tw2: 'sea',      vn2: 'sea',
};

let _champIdMap = null;

async function getChampIdMap() {
  if (_champIdMap) return _champIdMap;
  let version = '16.7.1';
  try {
    const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const vList = await vRes.json();
    version = vList[0] ?? version;
  } catch { /* pinned fallback */ }

  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  const data = await res.json();

  _champIdMap = {};
  for (const [, info] of Object.entries(data.data)) {
    _champIdMap[Number(info.key)] = info.name.toLowerCase().replace(/[^a-z]/g, '');
  }
  return _champIdMap;
}

async function riotFetch(host, path, apiKey) {
  const url = `https://${host}.api.riotgames.com${path}`;
  const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } });

  if (res.status === 429) {
    const err = new Error('Rate limited — try again in a few seconds');
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const msg = res.status === 404 ? 'Summoner not found'
      : res.status === 403 ? 'Invalid or expired API key'
      : `Riot API error ${res.status}: ${body}`;
    const err = new Error(msg);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 403 : 502;
    throw err;
  }
  return res.json();
}

// Batch match-v5 lookups so a single user can't consume the entire 20 req/s
// dev-key budget.
const MATCH_FETCH_CONCURRENCY = 4;

async function fetchChampStats(cluster, puuid, matchIds, idMap, apiKey) {
  if (!matchIds.length) return {};

  const stats = {};
  for (let i = 0; i < matchIds.length; i += MATCH_FETCH_CONCURRENCY) {
    const batch = matchIds.slice(i, i + MATCH_FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((id) => riotFetch(cluster, `/lol/match/v5/matches/${id}`, apiKey)),
    );
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const participant = result.value.info?.participants?.find(
        (p) => p.puuid === puuid,
      );
      if (!participant) continue;
      const champId = idMap[participant.championId];
      if (!champId) continue;
      if (!stats[champId]) stats[champId] = { wins: 0, games: 0 };
      stats[champId].games++;
      if (participant.win) stats[champId].wins++;
    }
  }
  return stats;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Per-IP rate limit: 10 lookups burst, refill 1 every 6s (= 10/min).
  // Protects the Riot dev key (20 req/s global) from a single hot client.
  const limit = checkRateLimit(req, { bucket: 'summoner', capacity: 10, refillSeconds: 6 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfter));
    return res.status(429).json({ error: 'Too many lookups — try again in a moment.' });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RIOT_API_KEY not configured on server' });

  const { name, tag, region: rawRegion } = req.query;
  const region = (rawRegion || 'euw1').toLowerCase();

  if (!name || !tag) return res.status(400).json({ error: 'name and tag query params are required' });
  if (!REGIONAL[region]) {
    return res.status(400).json({ error: `Unsupported region: ${rawRegion}` });
  }

  const cluster = REGIONAL[region];

  try {
    const account = await riotFetch(
      cluster,
      `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      apiKey,
    );

    const [ranked, masteries, idMap, matchIds] = await Promise.all([
      riotFetch(region, `/lol/league/v4/entries/by-puuid/${account.puuid}`, apiKey),
      riotFetch(region, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}/top?count=25`, apiKey),
      getChampIdMap(),
      riotFetch(cluster, `/lol/match/v5/matches/by-puuid/${account.puuid}/ids?type=ranked&start=0&count=10`, apiKey)
        .catch(() => []),
    ]);

    // 5s safety timeout. If we lose the race, signal statsPartial so the
    // client can distinguish "new user" from "we timed out".
    const TIMEOUT_SENTINEL = Symbol('timeout');
    const raced = await Promise.race([
      fetchChampStats(cluster, account.puuid, matchIds, idMap, apiKey),
      new Promise((resolve) => setTimeout(() => resolve(TIMEOUT_SENTINEL), 5000)),
    ]);
    const timedOut = raced === TIMEOUT_SENTINEL;
    const champStats = timedOut ? {} : raced;

    const solo = ranked.find((e) => e.queueType === 'RANKED_SOLO_5x5') ?? {
      tier: 'UNRANKED', rank: '', leaguePoints: 0, wins: 0, losses: 0,
    };

    const mappedMasteries = masteries
      .map((m) => {
        const champId = idMap[m.championId] ?? null;
        const stats   = champId ? (champStats[champId] ?? null) : null;
        return {
          championId:    champId,
          masteryLevel:  m.championLevel,
          masteryPoints: m.championPoints,
          gamesPlayed:   stats?.games ?? 0,
          winRate:       stats && stats.games > 0
            ? Math.round((stats.wins / stats.games) * 1000) / 10
            : null,
        };
      })
      .filter((m) => m.championId !== null);

    return res.status(200).json({
      summonerName: account.gameName,
      tagLine:      account.tagLine,
      puuid:        account.puuid,
      region,
      tier:         solo.tier === 'UNRANKED' ? 'Unranked' : cap(solo.tier),
      division:     solo.rank,
      lp:           solo.leaguePoints,
      wins:         solo.wins,
      losses:       solo.losses,
      masteries:    mappedMasteries,
      statsPartial: timedOut,
    });
  } catch (err) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
}

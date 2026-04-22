// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.
//
// GET /api/match-review?puuid=...&region=euw1&sinceTimestamp=<ms>
//                     &blue=aatrox,ahri,...&red=zed,...
//
// Finds the ranked match played by `puuid` after `sinceTimestamp` whose team
// composition overlaps the supplied draft picks, and returns a compact outcome
// summary (win/loss, KDA, CS, damage, gold, duration).

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
    const msg = res.status === 404 ? 'Match not found'
      : res.status === 403 ? 'Invalid or expired API key'
      : `Riot API error ${res.status}: ${body}`;
    const err = new Error(msg);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 403 : 502;
    throw err;
  }
  return res.json();
}

function parsePickList(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const MIN_OVERLAP = 7;

function matchOverlapsDraft(match, idMap, draftPickSet) {
  const parts = match.info?.participants ?? [];
  if (parts.length !== 10) return false;
  let hits = 0;
  for (const p of parts) {
    const id = idMap[p.championId];
    if (id && draftPickSet.has(id)) hits++;
  }
  return hits >= MIN_OVERLAP;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = checkRateLimit(req, { bucket: 'summoner', capacity: 10, refillSeconds: 6 });
  if (!limit.allowed) {
    res.setHeader('Retry-After', Math.ceil(limit.retryAfter));
    return res.status(429).json({ error: 'Too many lookups — try again in a moment.' });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RIOT_API_KEY not configured on server' });

  const { puuid, region: rawRegion, sinceTimestamp } = req.query;
  const region = (rawRegion || 'euw1').toLowerCase();

  if (!puuid)          return res.status(400).json({ error: 'puuid is required' });
  if (!sinceTimestamp) return res.status(400).json({ error: 'sinceTimestamp is required' });
  if (!REGIONAL[region]) {
    return res.status(400).json({ error: `Unsupported region: ${rawRegion}` });
  }

  const sinceMs = Number(sinceTimestamp);
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) {
    return res.status(400).json({ error: 'sinceTimestamp must be a positive number (ms)' });
  }

  const draftPickSet = new Set([
    ...parsePickList(req.query.blue),
    ...parsePickList(req.query.red),
  ]);
  if (draftPickSet.size < MIN_OVERLAP) {
    return res.status(400).json({ error: 'Not enough picks to identify the match' });
  }

  const cluster = REGIONAL[region];
  const startTimeSec = Math.floor(sinceMs / 1000);

  try {
    const idMap = await getChampIdMap();

    const matchIds = await riotFetch(
      cluster,
      `/lol/match/v5/matches/by-puuid/${puuid}/ids?type=ranked&startTime=${startTimeSec}&start=0&count=5`,
      apiKey,
    );

    if (!matchIds.length) {
      return res.status(200).json({ result: null, reason: 'no-matches-yet' });
    }

    for (const id of matchIds) {
      const match = await riotFetch(cluster, `/lol/match/v5/matches/${id}`, apiKey);
      if (!matchOverlapsDraft(match, idMap, draftPickSet)) continue;

      const participants = match.info?.participants ?? [];
      const player = participants.find((p) => p.puuid === puuid);
      if (!player) continue;

      const championId = idMap[player.championId] ?? null;
      const durationSec = Number(match.info?.gameDuration ?? 0);
      if (durationSec > 0 && durationSec < 300) continue;

      // Fan out to champion-mastery for each enemy's top pick. allSettled so
      // an opted-out player doesn't tank the review.
      const enemyParticipants = participants.filter(
        (p) => p.teamId !== player.teamId && p.puuid,
      );
      const masteryResults = await Promise.allSettled(
        enemyParticipants.map((p) =>
          riotFetch(region, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${p.puuid}/top?count=1`, apiKey),
        ),
      );
      const enemyMasteries = masteryResults
        .map((r, i) => {
          if (r.status !== 'fulfilled') return null;
          const top = Array.isArray(r.value) ? r.value[0] : null;
          if (!top) return null;
          const slug = idMap[top.championId];
          if (!slug) return null;
          return {
            puuid:      enemyParticipants[i].puuid,
            championId: slug,
            points:     top.championPoints ?? 0,
            level:      top.championLevel ?? 0,
          };
        })
        .filter((m) => m !== null)
        .sort((a, b) => b.points - a.points);

      return res.status(200).json({
        result: {
          matchId:       id,
          won:           !!player.win,
          championId,
          championName:  player.championName,
          kills:         player.kills,
          deaths:        player.deaths,
          assists:       player.assists,
          cs:            (player.totalMinionsKilled ?? 0) + (player.neutralMinionsKilled ?? 0),
          damage:        player.totalDamageDealtToChampions ?? 0,
          gold:          player.goldEarned ?? 0,
          durationSec,
          gameEndMs:     Number(match.info?.gameEndTimestamp ?? 0),
          queueId:       match.info?.queueId ?? null,
          enemyMasteries,
        },
      });
    }

    return res.status(200).json({ result: null, reason: 'no-overlap' });
  } catch (err) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
}

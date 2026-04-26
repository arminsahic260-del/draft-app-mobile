// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/claude-explain — server-side wrapper around Anthropic's Messages
// API. Requires a verified Firebase ID token; reads CLAUDE_API_KEY from
// Vercel env. The prompt is built server-side from structured input so the
// Claude key is never shipped in the APK.

import { verifyAuth } from './_firebase.js';
import { checkRateLimit } from './_ratelimit.js';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

function safeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s) => typeof s === 'string' && s.length > 0 && s.length < 60)
    .slice(0, 10);
}

function buildPrompt({ championName, playerRole, allyPicks, enemyPicks, bans, mastery }) {
  const safeName = String(championName ?? '').slice(0, 40);
  const safeRole = String(playerRole ?? '').slice(0, 20);
  const allies = safeList(allyPicks);
  const enemies = safeList(enemyPicks);
  const banList = safeList(bans);

  let masteryLine = '';
  if (mastery && typeof mastery.gamesPlayed === 'number' && mastery.gamesPlayed > 0) {
    if (typeof mastery.winRate === 'number') {
      masteryLine = `\n- Player has ${mastery.gamesPlayed} games on this champion at ${mastery.winRate}% win rate`;
    } else {
      masteryLine = `\n- Player has ${mastery.gamesPlayed} games on this champion this season`;
    }
  }

  return `You are a League of Legends draft coach. Explain in 2-3 concise sentences why ${safeName} is a strong pick in this specific draft situation.

Draft context:
- Player role: ${safeRole}
- Ally picks so far: ${allies.length ? allies.join(', ') : 'none yet'}
- Enemy picks: ${enemies.length ? enemies.join(', ') : 'none yet'}
- Banned: ${banList.length ? banList.join(', ') : 'none'}${masteryLine}

Focus on: win condition, synergies with allies, counters to enemies, or power spike. Be specific, not generic.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' });
  }

  const decoded = await verifyAuth(req, res);
  if (!decoded) return; // 401 already sent

  // Per-user budget: 30-burst, refills at 1 token / 120s -> ~30 calls/hour
  // sustained. Caps cost amplification if a Firebase token leaks.
  const rl = checkRateLimit(req, {
    bucket: 'claude',
    capacity: 30,
    refillSeconds: 120,
    identifier: decoded.uid,
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfter)));
    return res.status(429).json({ error: 'AI explanation rate limit reached — try again in a moment.' });
  }

  const body = req.body ?? {};
  const parsed = typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : body;

  if (!parsed || typeof parsed.championName !== 'string' || !parsed.championName) {
    return res.status(400).json({ error: 'championName is required' });
  }

  const prompt = buildPrompt(parsed);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(502).json({ error: `Claude API error ${response.status}: ${text.slice(0, 200)}` });
    }

    const data = await response.json();
    const explanation = data.content?.[0]?.text ?? 'No explanation available.';
    return res.status(200).json({ explanation });
  } catch (err) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI explanation timed out — try again.' });
    }
    return res.status(500).json({ error: err.message ?? 'Unexpected error' });
  }
}

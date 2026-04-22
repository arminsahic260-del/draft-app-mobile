// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.
//
// Live patch data hook. Reads `patchData/<bucket>` from Firestore — kept
// fresh by the /api/cron/update-patches cron on the web project — and
// falls back to the bundled JSON if Firebase isn't configured or the
// document is missing.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../api/firebase';
import tierlistJson from '../data/tierlist.json';
import matchupsJson from '../data/matchups.json';
import metaJson from '../data/patch-meta.json';
import { DEFAULT_BUCKET, type RankBucket } from '../utils/rankBucket';

export interface PatchMeta {
  updatedAt: string;
  patch: string;
  tier: string;
  source: 'lolalytics' | 'u.gg' | 'fallback' | 'bundled';
  championsWithTierData: number;
  championsWithMatchupData: number;
  bucket?: RankBucket;
}

export interface PatchData {
  tierlist: { S: string[]; A: string[]; B: string[]; C: string[] };
  matchups: Record<string, Record<string, number>>;
  meta: PatchMeta;
  isLive: boolean;
}

const BUNDLED: PatchData = {
  tierlist: tierlistJson as PatchData['tierlist'],
  matchups: matchupsJson as PatchData['matchups'],
  meta: {
    updatedAt: metaJson.lastUpdated,
    patch: metaJson.patch,
    tier: metaJson.tier,
    source: 'bundled',
    championsWithTierData: metaJson.championsWithTierData,
    championsWithMatchupData: metaJson.championsWithMatchupData,
  },
  isLive: false,
};

const _cached: Map<RankBucket, PatchData> = new Map();
const _inflight: Map<RankBucket, Promise<PatchData>> = new Map();

async function loadOnce(bucket: RankBucket): Promise<PatchData> {
  const hit = _cached.get(bucket);
  if (hit) return hit;

  if (!isFirebaseConfigured) {
    _cached.set(bucket, BUNDLED);
    return BUNDLED;
  }
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'patchData', bucket));
    if (!snap.exists()) {
      _cached.set(bucket, BUNDLED);
      return BUNDLED;
    }
    const data = snap.data() as Partial<PatchData> & { meta?: Partial<PatchMeta> };
    if (!data.tierlist || !data.matchups || !data.meta) {
      _cached.set(bucket, BUNDLED);
      return BUNDLED;
    }
    const resolved: PatchData = {
      tierlist: data.tierlist,
      matchups: data.matchups,
      meta: { ...BUNDLED.meta, ...data.meta, source: data.meta.source ?? 'lolalytics', bucket },
      isLive: true,
    };
    _cached.set(bucket, resolved);
    return resolved;
  } catch {
    _cached.set(bucket, BUNDLED);
    return BUNDLED;
  }
}

export function usePatchData(bucket: RankBucket = DEFAULT_BUCKET): { data: PatchData; loading: boolean } {
  const [state, setState] = useState<{ data: PatchData; loading: boolean }>(
    () => {
      const cached = _cached.get(bucket);
      return { data: cached ?? BUNDLED, loading: !cached };
    },
  );

  useEffect(() => {
    const cached = _cached.get(bucket);
    if (cached) {
      setState({ data: cached, loading: false });
      return;
    }
    let cancelled = false;
    let inflight = _inflight.get(bucket);
    if (!inflight) {
      inflight = loadOnce(bucket);
      _inflight.set(bucket, inflight);
    }
    setState((prev) => ({ ...prev, loading: true }));
    inflight.then((data) => {
      if (cancelled) return;
      setState({ data, loading: false });
    });
    return () => { cancelled = true; };
  }, [bucket]);

  return state;
}

export function getBundledPatchData(): PatchData {
  return BUNDLED;
}

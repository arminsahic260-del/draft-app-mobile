// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

/**
 * Maps a Riot-reported summoner tier to one of four meta buckets that
 * lolalytics / u.gg actually have data for. Sub-Gold tiers share the
 * gold_plus baseline — the sample size at lower ranks is too small and
 * off-meta enough that "what's good at Gold+" is a better signal than
 * "what's good at Bronze today".
 */
export type RankBucket = 'gold_plus' | 'platinum_plus' | 'diamond_plus' | 'master_plus';

export const RANK_BUCKETS: RankBucket[] = [
  'gold_plus', 'platinum_plus', 'diamond_plus', 'master_plus',
];

export const DEFAULT_BUCKET: RankBucket = 'gold_plus';

const BUCKET_LABELS: Record<RankBucket, string> = {
  gold_plus:     'Gold+',
  platinum_plus: 'Platinum+',
  diamond_plus:  'Diamond+',
  master_plus:   'Master+',
};

export function rankBucketLabel(bucket: RankBucket): string {
  return BUCKET_LABELS[bucket];
}

export function rankToBucket(tier: string | null | undefined): RankBucket {
  const t = (tier ?? '').toLowerCase().trim();
  if (t === 'master' || t === 'grandmaster' || t === 'challenger') return 'master_plus';
  if (t === 'diamond') return 'diamond_plus';
  if (t === 'platinum' || t === 'emerald') return 'platinum_plus';
  return 'gold_plus';
}

// Copyright (c) 2026 Armin Šahić. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { createContext, useContext, type ReactNode } from 'react';
import { usePatchData, type PatchData, getBundledPatchData } from './usePatchData';
import { DEFAULT_BUCKET, type RankBucket } from '../utils/rankBucket';

interface PatchContextValue {
  data: PatchData;
  loading: boolean;
  bucket: RankBucket;
}

const PatchContext = createContext<PatchContextValue | null>(null);

interface ProviderProps {
  bucket?: RankBucket;
  children: ReactNode;
}

export function PatchDataProvider({ bucket = DEFAULT_BUCKET, children }: ProviderProps) {
  const { data, loading } = usePatchData(bucket);
  return (
    <PatchContext.Provider value={{ data, loading, bucket }}>
      {children}
    </PatchContext.Provider>
  );
}

// Hook that always returns a usable PatchData, even outside a provider
// (falls back to bundled). That keeps isolated stories / tests working
// without forcing every render-path through the provider.
export function usePatch(): PatchContextValue {
  const ctx = useContext(PatchContext);
  if (ctx) return ctx;
  return { data: getBundledPatchData(), loading: false, bucket: DEFAULT_BUCKET };
}

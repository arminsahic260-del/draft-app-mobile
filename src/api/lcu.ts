// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import type { LcuStatus } from '../types';
import { ENV } from '../config/env';
import RNEventSource from 'react-native-sse';

const PROXY_URL = ENV.RIOT_PROXY_URL || undefined;

export type LcuEventTypes = 'status' | 'session_start' | 'session_update' | 'session_end';

export async function fetchLcuStatus(): Promise<LcuStatus | null> {
  if (!PROXY_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${PROXY_URL}/lcu/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export function openLcuEventStream(): RNEventSource<LcuEventTypes> | null {
  if (!PROXY_URL) return null;
  return new RNEventSource<LcuEventTypes>(`${PROXY_URL}/lcu/events`);
}

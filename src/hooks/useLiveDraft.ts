// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useEffect, useState, useRef } from 'react';
import { openLcuEventStream } from '../api/lcu';
import type { LiveDraftEvent, LcuStatus } from '../types';
import type { CustomEvent } from 'react-native-sse';

export type LiveConnectionStatus = 'connecting' | 'connected' | 'waiting' | 'active' | 'ended' | 'error';

interface UseLiveDraftOptions {
  onEvent: (event: LiveDraftEvent) => void;
  onSessionEnd?: (reason: string) => void;
  enabled: boolean;
}

export function useLiveDraft({ onEvent, onSessionEnd, enabled }: UseLiveDraftOptions) {
  const [status, setStatus] = useState<LiveConnectionStatus>('connecting');
  const onEventRef = useRef(onEvent);
  const onSessionEndRef = useRef(onSessionEnd);

  onEventRef.current = onEvent;
  onSessionEndRef.current = onSessionEnd;

  useEffect(() => {
    if (!enabled) return;

    const es = openLcuEventStream();
    if (!es) {
      setStatus('error');
      return;
    }

    setStatus('connecting');

    es.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data ?? '') as LcuStatus;
        if (data.inChampSelect) setStatus('active');
        else if (data.connected) setStatus('waiting');
        else if (data.clientDetected) setStatus('connected');
        else setStatus('connecting');
      } catch { /* ignore */ }
    });

    es.addEventListener('session_start', (e) => {
      try {
        const data = JSON.parse(e.data ?? '') as LiveDraftEvent;
        setStatus('active');
        onEventRef.current(data);
      } catch { /* ignore */ }
    });

    es.addEventListener('session_update', (e) => {
      try {
        const data = JSON.parse(e.data ?? '') as LiveDraftEvent;
        setStatus('active');
        onEventRef.current(data);
      } catch { /* ignore */ }
    });

    es.addEventListener('session_end', (e) => {
      try {
        const data = JSON.parse(e.data ?? '') as LiveDraftEvent;
        setStatus('ended');
        onSessionEndRef.current?.(data.reason ?? 'completed');
      } catch { /* ignore */ }
    });

    return () => {
      es.close();
    };
  }, [enabled]);

  return { status };
}

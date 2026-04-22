// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.
//
// Mobile live-draft hook that mirrors PC champ-select state via Firestore.
// The PC runs server/connector.js which publishes to liveSessions/{uid};
// this hook onSnapshot-subscribes and emits LiveDraftEvent updates that
// plug straight into the existing useDraft reducer via syncLive().

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../api/firebase';
import type { LiveDraftEvent } from '../types';

export type RemoteLiveStatus = 'idle' | 'waiting' | 'active' | 'stale' | 'ended' | 'error';

// If the connector stops publishing for this long, we treat the session as
// stale (it probably crashed or the user closed it without session_end).
const STALE_AFTER_MS = 5 * 60 * 1000;

interface Options {
  uid: string | null | undefined;
  onEvent: (event: LiveDraftEvent) => void;
  onSessionEnd?: (reason: string) => void;
  enabled: boolean;
}

function tsToMs(t: unknown): number | null {
  if (!t) return null;
  if (t instanceof Timestamp) return t.toMillis();
  if (typeof t === 'object' && t !== null && 'seconds' in t) {
    return (t as { seconds: number }).seconds * 1000;
  }
  return null;
}

export function useRemoteLiveDraft({ uid, onEvent, onSessionEnd, enabled }: Options) {
  const [status, setStatus] = useState<RemoteLiveStatus>('idle');
  const onEventRef = useRef(onEvent);
  const onSessionEndRef = useRef(onSessionEnd);
  const wasActiveRef = useRef(false);

  useEffect(() => { onEventRef.current = onEvent; });
  useEffect(() => { onSessionEndRef.current = onSessionEnd; });

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (!isFirebaseConfigured || !uid) {
      setStatus('error');
      return;
    }

    setStatus('waiting');

    const ref = doc(getFirebaseDb(), 'liveSessions', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (wasActiveRef.current) {
            wasActiveRef.current = false;
            setStatus('ended');
            onSessionEndRef.current?.('completed');
          } else {
            setStatus('waiting');
          }
          return;
        }

        const data = snap.data() as {
          status?: string;
          updatedAt?: Timestamp;
          playerTeam?: 'blue' | 'red';
          playerRole?: LiveDraftEvent['playerRole'];
          phase?: LiveDraftEvent['phase'];
          timer?: number;
          picks?: LiveDraftEvent['picks'];
          bans?:  LiveDraftEvent['bans'];
          pickRoles?: LiveDraftEvent['pickRoles'];
        };

        const updatedMs = tsToMs(data.updatedAt);
        if (updatedMs && Date.now() - updatedMs > STALE_AFTER_MS) {
          setStatus('stale');
          return;
        }

        const event: LiveDraftEvent = {
          type: wasActiveRef.current ? 'session_update' : 'session_start',
          playerTeam: data.playerTeam,
          playerRole: data.playerRole,
          phase:      data.phase,
          timer:      data.timer,
          picks:      data.picks,
          bans:       data.bans,
          pickRoles:  data.pickRoles,
        };

        wasActiveRef.current = true;
        setStatus('active');
        onEventRef.current(event);
      },
      (err) => {
        console.warn('[useRemoteLiveDraft]', err.message);
        setStatus('error');
      },
    );

    return () => {
      unsub();
      wasActiveRef.current = false;
    };
  }, [enabled, uid]);

  return { status };
}

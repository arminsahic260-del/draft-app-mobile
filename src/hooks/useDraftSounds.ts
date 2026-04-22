// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useEffect, useRef } from 'react';
import { notifyYourTurn } from '../utils/notifications';

interface Args {
  enabled: boolean;
  isYourTurn: boolean;
  // Only fire during live-relay drafts — notifications when the user is
  // actively tapping through a local practice/manual draft would be noise.
  liveMode: boolean;
}

export function useDraftSounds({ enabled, isYourTurn, liveMode }: Args): void {
  const prevTurn = useRef(isYourTurn);

  useEffect(() => {
    if (enabled && liveMode && isYourTurn && !prevTurn.current) {
      void notifyYourTurn();
    }
    prevTurn.current = isYourTurn;
  }, [enabled, liveMode, isYourTurn]);
}

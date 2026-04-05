// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { createContext, useContext, useState, useCallback } from 'react';
import type { PlayerProfile, Role, Recommendation, DraftState } from '../types';
import type { AuthState } from '../hooks/useAuth';

interface AppContextValue {
  // Player
  player: PlayerProfile | null;
  setPlayer: (p: PlayerProfile | null) => void;
  role: Role;
  setRole: (r: Role) => void;

  // Modes
  practiceMode: boolean;
  liveMode: boolean;
  setPracticeMode: (v: boolean) => void;
  setLiveMode: (v: boolean) => void;

  // Results
  recommendations: Recommendation[];
  setRecommendations: (r: Recommendation[]) => void;
  draftSnapshot: DraftState | null;
  setDraftSnapshot: (d: DraftState | null) => void;

  // Auth
  auth: AuthState;

  // Reset
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be inside AppProvider');
  return ctx;
}

export function AppProvider({ children, auth }: { children: React.ReactNode; auth: AuthState }) {
  const [player, setPlayer]                   = useState<PlayerProfile | null>(null);
  const [role, setRole]                       = useState<Role>('mid');
  const [practiceMode, setPracticeMode]       = useState(false);
  const [liveMode, setLiveMode]               = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [draftSnapshot, setDraftSnapshot]     = useState<DraftState | null>(null);

  const resetAll = useCallback(() => {
    setPlayer(null);
    setPracticeMode(false);
    setLiveMode(false);
    setRecommendations([]);
    setDraftSnapshot(null);
  }, []);

  return (
    <AppContext.Provider value={{
      player, setPlayer,
      role, setRole,
      practiceMode, liveMode,
      setPracticeMode, setLiveMode,
      recommendations, setRecommendations,
      draftSnapshot, setDraftSnapshot,
      auth,
      resetAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

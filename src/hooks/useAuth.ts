// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  onAuthChanged,
  signInWithGoogle,
  signOut,
  getUserDoc,
  type UserDoc,
} from '../api/firebase';

export interface AuthState {
  user:       User | null;
  userDoc:    UserDoc | null;
  loading:    boolean;
  isPro:      boolean;
  draftCount: number;
  isGuest:    boolean;
  signIn:     () => Promise<void>;
  signOut:    () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user,    setUser]    = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onAuthChanged(async (u) => {
      setUser(u);
      if (u) {
        const doc = await getUserDoc(u.uid);
        setUserDoc(doc);
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const u   = await signInWithGoogle();
      const doc = await getUserDoc(u.uid);
      setUserDoc(doc);
    } catch (err) {
      // User cancelled or network error — don't crash
      console.warn('Sign-in failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn('Sign-out failed:', err);
    }
    setUser(null);
    setUserDoc(null);
  };

  return {
    user,
    userDoc,
    loading,
    isPro:      userDoc?.isPro ?? false,
    draftCount: userDoc?.dailyDraftCount ?? 0,
    isGuest:    !isFirebaseConfigured,
    signIn:     handleSignIn,
    signOut:    handleSignOut,
  };
}

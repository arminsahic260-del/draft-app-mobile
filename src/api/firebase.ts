// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { initializeApp, type FirebaseApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence is re-exported from firebase/auth/react-native
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ENV } from '../config/env';

// ── Config ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:      ENV.FIREBASE_API_KEY,
  authDomain:  ENV.FIREBASE_AUTH_DOMAIN,
  projectId:   ENV.FIREBASE_PROJECT_ID,
  appId:       ENV.FIREBASE_APP_ID,
};

export const isFirebaseConfigured: boolean =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

// ── Lazy singletons ────────────────────────────────────────────────────────
let _app:  FirebaseApp | null = null;
let _auth: Auth        | null = null;
let _db:   Firestore   | null = null;

function getApp(): FirebaseApp {
  if (!_app) _app = initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    try {
      _auth = initializeAuth(getApp(), {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // initializeAuth throws if called twice; fall back to getAuth
      _auth = getAuth(getApp());
    }
  }
  return _auth;
}

// Configure native Google Sign-In — must be called once at app startup
let _googleConfigured = false;
export function configureGoogleSignIn(): void {
  if (_googleConfigured) return;
  if (!ENV.GOOGLE_SIGNIN_WEB_CLIENT_ID) {
    console.warn('GOOGLE_SIGNIN_WEB_CLIENT_ID not set; Google Sign-In will not work');
    return;
  }
  GoogleSignin.configure({
    webClientId: ENV.GOOGLE_SIGNIN_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  _googleConfigured = true;
}

export function getFirebaseDb(): Firestore {
  if (!_db) _db = getFirestore(getApp());
  return _db;
}

// ── Auth helpers ────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<User> {
  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;
  if (!idToken) throw new Error('No ID token from Google Sign-In');

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getFirebaseAuth(), credential);
  await ensureUserDoc(result.user);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  await GoogleSignin.signOut();
}

export function onAuthChanged(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

// ── Firestore helpers ───────────────────────────────────────────────────────
export interface UserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isPro: boolean;
  dailyDraftCount: number;
  lastDraftDate: string;
  createdAt: string;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function ensureUserDoc(user: User): Promise<UserDoc> {
  const db  = getFirebaseDb();
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const newDoc: UserDoc = {
      uid:             user.uid,
      email:           user.email,
      displayName:     user.displayName,
      photoURL:        user.photoURL,
      isPro:           false,
      dailyDraftCount: 0,
      lastDraftDate:   today(),
      createdAt:       new Date().toISOString(),
    };
    await setDoc(ref, newDoc);
    return newDoc;
  }
  return snap.data() as UserDoc;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const db   = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function incrementDraftCount(uid: string): Promise<{ count: number; isPro: boolean }> {
  const db  = getFirebaseDb();
  const ref = doc(db, 'users', uid);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return { count: 0, isPro: false };

    const data = snap.data() as UserDoc;
    const isNewDay = data.lastDraftDate !== today();
    const newCount = isNewDay ? 1 : data.dailyDraftCount + 1;

    transaction.update(ref, { dailyDraftCount: newCount, lastDraftDate: today() });
    return { count: newCount, isPro: data.isPro };
  });
}

export const FREE_DRAFT_LIMIT = 3;

// ── Saved drafts ────────────────────────────────────────────────────────────
export interface SavedDraftDoc {
  id?: string;
  uid: string;
  createdAt: string;
  playerRole: string;
  picks: { blue: (string | null)[]; red: (string | null)[] };
  bans:  { blue: (string | null)[]; red: (string | null)[] };
  topRecommendation?: string;
}

export async function saveDraft(draft: SavedDraftDoc): Promise<string> {
  const db  = getFirebaseDb();
  const col = collection(db, 'users', draft.uid, 'drafts');
  const ref = await addDoc(col, { ...draft, createdAt: new Date().toISOString() });
  return ref.id;
}

export async function loadRecentDrafts(uid: string, count = 10): Promise<SavedDraftDoc[]> {
  const db  = getFirebaseDb();
  const col = collection(db, 'users', uid, 'drafts');
  const q   = query(col, orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedDraftDoc));
}

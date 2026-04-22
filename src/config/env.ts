// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

/**
 * Centralized environment config — replaces import.meta.env from Vite.
 * Values come from app.json > expo > extra (via expo-constants).
 */
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const ENV = {
  RIOT_PROXY_URL: (extra.riotProxyUrl as string) ?? '',
  RIOT_REGION:    (extra.riotRegion as string) ?? 'euw1',
  API_BASE:       (extra.apiBase as string) ?? '',

  // Firebase
  FIREBASE_API_KEY:             (extra.firebaseApiKey as string) ?? '',
  FIREBASE_AUTH_DOMAIN:         (extra.firebaseAuthDomain as string) ?? '',
  FIREBASE_PROJECT_ID:          (extra.firebaseProjectId as string) ?? '',
  FIREBASE_STORAGE_BUCKET:      (extra.firebaseStorageBucket as string) ?? '',
  FIREBASE_MESSAGING_SENDER_ID: (extra.firebaseMessagingSenderId as string) ?? '',
  FIREBASE_APP_ID:              (extra.firebaseAppId as string) ?? '',

  // Google Sign-In (native)
  GOOGLE_SIGNIN_WEB_CLIENT_ID:  (extra.googleSignInWebClientId as string) ?? '',
};

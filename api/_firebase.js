// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Shared Firebase Admin singleton + auth helpers for Vercel serverless functions.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function ensureApp() {
  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    }
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
}

function getDb() {
  ensureApp();
  return getFirestore();
}

function getAdminAuth() {
  ensureApp();
  return getAuth();
}

/**
 * Verify the Firebase ID token on the Authorization header.
 * Returns the decoded token ({ uid, email, ... }) or sends a 401 and returns null.
 */
async function verifyAuth(req, res) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing bearer token' });
    return null;
  }
  try {
    return await getAdminAuth().verifyIdToken(match[1]);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

export { getDb, getAdminAuth, verifyAuth };

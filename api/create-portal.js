// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/create-portal
// Creates a Stripe Customer Portal session so users can manage their subscription.
// Requires a Firebase ID token in the Authorization: Bearer header.

import Stripe from 'stripe';
import { getDb, verifyAuth } from './_firebase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DEFAULT_ORIGIN = 'https://drafthelper.app';
const ALLOWED_ORIGINS = new Set([
  DEFAULT_ORIGIN,
  'https://draft-app-mobile.vercel.app',
  'http://localhost:8081',
]);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe env vars not configured on server' });
  }

  const decoded = await verifyAuth(req, res);
  if (!decoded) return;

  try {
    const db = getDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    let customerId = userSnap.data()?.stripeCustomerId;

    // Fall back to Stripe customer search if the Firestore link was created
    // before stripeCustomerId persistence was in place.
    if (!customerId) {
      // Fall back to Stripe customer search. Query both metadata casings for
      // compatibility with customers created before the web/mobile naming was
      // standardized.
      const [byLower, byUpper] = await Promise.all([
        stripe.customers.search({ query: `metadata["firebaseUid"]:"${decoded.uid}"` }).catch(() => ({ data: [] })),
        stripe.customers.search({ query: `metadata["firebaseUID"]:"${decoded.uid}"` }).catch(() => ({ data: [] })),
      ]);
      const match = byLower.data[0] || byUpper.data[0];
      if (match) {
        customerId = match.id;
        await db.collection('users').doc(decoded.uid).set(
          { stripeCustomerId: customerId },
          { merge: true },
        );
      }
    }

    if (!customerId) {
      return res.status(404).json({ error: 'No Stripe customer found for this user' });
    }

    const returnOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnOrigin,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-portal error:', err);
    return res.status(err.statusCode ?? 500).json({ error: err.message });
  }
}

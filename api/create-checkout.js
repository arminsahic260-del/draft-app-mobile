// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/create-checkout
// Creates a Stripe Checkout session for a Pro subscription.
// Requires a Firebase ID token in the Authorization: Bearer header — uid and
// email are taken from the verified token, never from the request body.

import Stripe from 'stripe';
import { getDb, verifyAuth } from './_firebase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const DEFAULT_ORIGIN = 'https://drafthelper.app';
const ALLOWED_ORIGINS = new Set([
  DEFAULT_ORIGIN,
  'https://draft-app-mobile.vercel.app',
  'http://localhost:8081',
]);

function resolveOrigin(req) {
  const o = req.headers.origin;
  return o && ALLOWED_ORIGINS.has(o) ? o : DEFAULT_ORIGIN;
}

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

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Stripe env vars not configured on server' });
  }

  const decoded = await verifyAuth(req, res);
  if (!decoded) return;

  const uid = decoded.uid;
  const email = decoded.email;
  if (!email) {
    return res.status(400).json({ error: 'Account has no verified email' });
  }

  try {
    const db = getDb();
    const userRef = db.collection('users').doc(uid);

    let customerId = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      return snap.data()?.stripeCustomerId ?? null;
    });

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { firebaseUid: uid, firebaseUID: uid },
      });
      customerId = customer.id;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const existing = snap.data()?.stripeCustomerId;
        if (existing) {
          customerId = existing;
        } else {
          tx.set(userRef, { stripeCustomerId: customerId }, { merge: true });
        }
      });
    }

    const successOrigin = resolveOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: uid,
      success_url: `${successOrigin}?checkout=success`,
      cancel_url: `${successOrigin}?checkout=cancel`,
      metadata: { firebaseUid: uid, firebaseUID: uid },
      subscription_data: { metadata: { firebaseUid: uid, firebaseUID: uid } },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(err.statusCode ?? 500).json({ error: err.message });
  }
}

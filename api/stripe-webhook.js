// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/stripe-webhook
// Handles Stripe webhook events to sync subscription state with Firestore.

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialise Firebase Admin once across warm invocations.
function getDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// Read raw body for Stripe signature verification.
function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Server env vars not configured' });
  }

  // Verify Stripe signature against raw body.
  const rawBody = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  const db = getDb();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.client_reference_id;
      const stripeCustomerId = session.customer;

      if (!uid) {
        console.error('checkout.session.completed missing client_reference_id');
        return res.status(400).json({ error: 'Missing client_reference_id' });
      }

      // Tag the Stripe customer with the Firebase UID for portal lookups.
      await stripe.customers.update(stripeCustomerId, {
        metadata: { firebaseUID: uid },
      });

      await db.collection('users').doc(uid).set(
        { isPro: true, stripeCustomerId },
        { merge: true },
      );

      console.log(`User ${uid} upgraded to Pro`);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      // Find the user doc by stripeCustomerId.
      const snapshot = await db
        .collection('users')
        .where('stripeCustomerId', '==', stripeCustomerId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        await userDoc.ref.set({ isPro: false }, { merge: true });
        console.log(`User ${userDoc.id} downgraded from Pro`);
      } else {
        console.warn(`No user found for stripeCustomerId ${stripeCustomerId}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Disable Vercel body parsing so we can read the raw body for signature verification.
export const config = {
  api: { bodyParser: false },
};

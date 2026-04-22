// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/stripe-webhook
// Handles Stripe webhook events to sync subscription state with Firestore.

import Stripe from 'stripe';
import { getDb } from './_firebase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Read raw body for Stripe signature verification.
function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// Subscription statuses that should revoke Pro access.
// past_due = Stripe is still retrying payment; do NOT revoke on that.
const REVOKE_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).json({ error: 'Server env vars not configured' });
  }

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

  // Idempotency: ack immediately if we've already processed this event.id.
  // Otherwise run the handler; only mark the event processed AFTER success,
  // so a crashed handler leaves the event retryable by Stripe.
  const eventRef = db.collection('stripeWebhookEvents').doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    await processEvent(db, event);
  } catch (err) {
    console.error(`Webhook handler failed for event ${event.id}:`, err);
    return res.status(500).json({ error: 'Handler failed; will retry' });
  }

  await eventRef.set({
    type: event.type,
    processedAt: new Date().toISOString(),
  });

  return res.status(200).json({ received: true });
}

async function processEvent(db, event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const uid = session.client_reference_id
        || session.metadata?.firebaseUid
        || session.metadata?.firebaseUID;
      const stripeCustomerId = session.customer;
      if (!uid) {
        console.error('checkout.session.completed missing firebase uid');
        break;
      }

      // Back-fill metadata so subsequent events (and portal lookups) can find
      // the uid by both casings.
      await stripe.customers.update(stripeCustomerId, {
        metadata: { firebaseUid: uid, firebaseUID: uid },
      });

      await db.collection('users').doc(uid).set(
        { isPro: true, stripeCustomerId },
        { merge: true },
      );
      console.log(`User ${uid} upgraded to Pro`);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const uid = await findUidByCustomer(db, invoice.customer);
      if (uid) {
        await db.collection('users').doc(uid).set({ isPro: true }, { merge: true });
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const uid = sub.metadata?.firebaseUid
        || sub.metadata?.firebaseUID
        || await findUidByCustomer(db, sub.customer);
      if (!uid) break;

      if (REVOKE_STATUSES.has(sub.status) || event.type === 'customer.subscription.deleted') {
        await db.collection('users').doc(uid).set({ isPro: false }, { merge: true });
        console.log(`User ${uid} downgraded (status=${sub.status})`);
      } else if (sub.status === 'active' || sub.status === 'trialing') {
        await db.collection('users').doc(uid).set({ isPro: true }, { merge: true });
      }
      // past_due / incomplete: leave isPro untouched.
      break;
    }
    // invoice.payment_failed intentionally not handled — Stripe retries for
    // ~3 weeks; revoking on the first failure punishes transient card issues.
  }
}

async function findUidByCustomer(db, customerId) {
  const snap = await db
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

// Disable Vercel body parsing so we can read the raw body for signature verification.
export const config = {
  api: { bodyParser: false },
};

// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/create-portal
// Creates a Stripe Customer Portal session so users can manage their subscription.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe env vars not configured on server' });
  }

  const { uid } = req.body ?? {};

  if (!uid) {
    return res.status(400).json({ error: 'uid is required' });
  }

  try {
    const customers = await stripe.customers.search({
      query: `metadata["firebaseUID"]:"${uid}"`,
    });

    if (!customers.data.length) {
      return res.status(404).json({ error: 'No Stripe customer found for this user' });
    }

    const customer = customers.data[0];
    const origin = req.headers.origin || req.headers.referer || 'https://drafthelper.app';

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: origin,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-portal error:', err);
    return res.status(err.statusCode ?? 500).json({ error: err.message });
  }
}

// Copyright (c) 2026 Armin Sahic. All rights reserved.
// POST /api/create-checkout
// Creates a Stripe Checkout session for a Pro subscription.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Stripe env vars not configured on server' });
  }

  const { uid, email } = req.body ?? {};

  if (!uid || !email) {
    return res.status(400).json({ error: 'uid and email are required' });
  }

  const origin = req.headers.origin || req.headers.referer || 'https://drafthelper.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: uid,
      customer_email: email,
      success_url: `${origin}?checkout=success`,
      cancel_url: `${origin}?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(err.statusCode ?? 500).json({ error: err.message });
  }
}

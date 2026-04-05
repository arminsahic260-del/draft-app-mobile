// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { ENV } from '../config/env';

const API_BASE = ENV.API_BASE || '';

export async function redirectToCheckout(uid: string, email: string): Promise<void> {
  if (!API_BASE) {
    Alert.alert('Setup incomplete', 'API_BASE is not configured. Checkout is unavailable.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error ?? 'Failed to create checkout session');
    }
    const { url } = await res.json();
    if (!url) throw new Error('No checkout URL returned from server');
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn('Checkout error:', err);
    Alert.alert('Checkout failed', err instanceof Error ? err.message : 'An error occurred');
  }
}

export async function redirectToPortal(uid: string): Promise<void> {
  if (!API_BASE) {
    Alert.alert('Setup incomplete', 'API_BASE is not configured. Portal is unavailable.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/create-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(data.error ?? 'Failed to create portal session');
    }
    const { url } = await res.json();
    if (!url) throw new Error('No portal URL returned from server');
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn('Portal error:', err);
    Alert.alert('Portal failed', err instanceof Error ? err.message : 'An error occurred');
  }
}

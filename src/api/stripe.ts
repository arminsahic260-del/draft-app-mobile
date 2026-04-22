// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { ENV } from '../config/env';
import { getFirebaseAuth } from './firebase';

const API_BASE = ENV.API_BASE || '';

async function authedPost(path: string): Promise<{ url: string }> {
  if (!API_BASE) {
    throw new Error('API_BASE is not configured.');
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }
  const token = await user.getIdToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: '{}',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error ?? `Request to ${path} failed`);
  }
  const body = await res.json();
  if (!body?.url) throw new Error(`No URL returned from ${path}`);
  return body;
}

export async function redirectToCheckout(): Promise<void> {
  try {
    const { url } = await authedPost('/create-checkout');
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn('Checkout error:', err);
    Alert.alert('Checkout failed', err instanceof Error ? err.message : 'An error occurred');
  }
}

export async function redirectToPortal(): Promise<void> {
  try {
    const { url } = await authedPost('/create-portal');
    await WebBrowser.openBrowserAsync(url);
  } catch (err) {
    console.warn('Portal error:', err);
    Alert.alert('Portal failed', err instanceof Error ? err.message : 'An error occurred');
  }
}

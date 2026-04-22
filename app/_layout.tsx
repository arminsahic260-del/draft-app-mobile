// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContext } from '../src/context/AppContext';
import { useAuth } from '../src/hooks/useAuth';
import { configureGoogleSignIn, isFirebaseConfigured } from '../src/api/firebase';
import { requestPermissions, scheduleDailyReset, cancelDailyReset } from '../src/utils/notifications';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { PatchDataProvider } from '../src/hooks/PatchDataContext';
import { rankToBucket } from '../src/utils/rankBucket';

// Bridges AppContext → PatchDataProvider. Must be rendered INSIDE AppProvider
// so the patch bucket can follow the currently-linked summoner's rank tier.
function PatchBucketBridge({ children }: { children: React.ReactNode }) {
  const { player } = useAppContext();
  const bucket = rankToBucket(player?.tier);
  return <PatchDataProvider bucket={bucket}>{children}</PatchDataProvider>;
}

export default function RootLayout() {
  useEffect(() => {
    if (isFirebaseConfigured) {
      configureGoogleSignIn();
    }
  }, []);

  const auth = useAuth();

  // Schedule or cancel daily reset notification based on Pro status.
  useEffect(() => {
    if (auth.loading) return;
    (async () => {
      if (auth.user && !auth.isPro) {
        const granted = await requestPermissions();
        if (granted) await scheduleDailyReset();
      } else {
        // Pro users or signed-out users don't need the reminder.
        await cancelDailyReset();
      }
    })();
  }, [auth.loading, auth.user, auth.isPro]);

  if (auth.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-lol-dark">
        <Text className="text-lol-gold text-sm">Loading...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider auth={auth}>
          <PatchBucketBridge>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a13' },
                animation: 'slide_from_right',
              }}
            />
          </PatchBucketBridge>
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

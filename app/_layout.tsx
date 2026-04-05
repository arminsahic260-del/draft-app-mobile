// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/context/AppContext';
import { useAuth } from '../src/hooks/useAuth';
import { configureGoogleSignIn, isFirebaseConfigured } from '../src/api/firebase';

export default function RootLayout() {
  useEffect(() => {
    if (isFirebaseConfigured) {
      configureGoogleSignIn();
    }
  }, []);

  const auth = useAuth();

  if (auth.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-lol-dark">
        <Text className="text-lol-gold text-sm">Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider auth={auth}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0a0a13' },
            animation: 'slide_from_right',
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}

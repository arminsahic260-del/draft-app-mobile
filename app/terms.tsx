// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-lol-dark">
      <View className="flex-1">
        <View className="px-4 py-3 border-b border-lol-border flex-row items-center">
          <Pressable onPress={() => router.back()}>
            <Text className="text-lol-text text-sm">← Back</Text>
          </Pressable>
          <Text className="text-lol-gold font-bold text-sm ml-4">Terms of Service</Text>
        </View>
        <ScrollView className="flex-1 px-4 py-4">
          <Text className="text-lol-text text-xs leading-5">
            DraftDiff is an independent fan project and is not endorsed by or affiliated with Riot Games, Inc.
            League of Legends and all related properties are trademarks or registered trademarks of Riot Games, Inc.
            {'\n\n'}
            DraftDiff is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
            {'\n\n'}
            By using DraftDiff, you agree to use it responsibly and in accordance with Riot Games' Terms of Service.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

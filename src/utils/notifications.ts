// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_RESET_ID = 'daily-draft-reset';

// Configure how notifications appear when app is in foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Request notification permissions. Returns true if granted. */
export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a daily notification reminding the user their drafts have reset.
 * Fires every day at 09:00 local time.
 * Only schedules if not already scheduled.
 */
export async function scheduleDailyReset(): Promise<void> {
  // Cancel any existing one first to avoid duplicates.
  await cancelDailyReset();

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_RESET_ID,
    content: {
      title: 'DraftDiff',
      body: 'Your daily drafts have reset! You have 3 free drafts ready.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}

/** Cancel the daily reset notification. */
export async function cancelDailyReset(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_RESET_ID);
}

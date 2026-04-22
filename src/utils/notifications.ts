// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_RESET_ID = 'daily-draft-reset';
const TURN_NOTIFICATION_PREFIX = 'turn-alert-';

// Configure how notifications appear when app is in foreground.
// expo-notifications 0.28+ split shouldShowAlert into shouldShowBanner +
// shouldShowList. Keep the old field so older SDKs still behave correctly.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const id = notification.request.identifier;
    // Turn alerts must make sound in foreground too — that's their whole job.
    // Daily-reset reminders stay silent so they don't startle during a draft.
    const playSound = id.startsWith(TURN_NOTIFICATION_PREFIX);
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: playSound,
      shouldSetBadge: false,
    };
  },
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

/**
 * Fire an immediate local notification that it's the user's turn to pick
 * during a live champ-select relay. Sound is enabled so it pulls attention
 * when the phone is face-down / screen off — the whole point of the relay.
 */
export async function notifyYourTurn(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${TURN_NOTIFICATION_PREFIX}${Date.now()}`,
      content: {
        title: 'Your turn to pick!',
        body: 'DraftDiff has a recommendation ready.',
        sound: true,
        priority: Platform.OS === 'android' ? Notifications.AndroidNotificationPriority.HIGH : undefined,
      },
      trigger: null,
    });
  } catch {
    // Permission denied or scheduling failed — silent no-op; the on-screen
    // banner still communicates the turn change.
  }
}

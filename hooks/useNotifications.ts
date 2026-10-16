import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useRegisterPushToken } from './useRegisterPushToken';

// Push permission grant + token registration for the signed-in user. Runs
// only once a session exists, so tokens are always tied to a real user.
export function useNotifications(userId: string | null) {
  const { register } = useRegisterPushToken(userId);

  useEffect(() => {
    // Android remote notifications are unavailable in Expo Go. Keep the app
    // bootable there, while allowing them in a development build.
    if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') return;
    if (!userId) return;

    // Lazy-load so Expo Go does not evaluate expo-notifications on Android.
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    let cancelled = false;
    Notifications.requestPermissionsAsync()
      .then(() => Notifications.getExpoPushTokenAsync())
      .then(({ data: token }) => {
        if (token && !cancelled) return register(token);
      })
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(({ notification }) => {
      const screen = notification.request.content.data?.screen;
      if (typeof screen === 'string') router.push(screen as never);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId, register]);
}

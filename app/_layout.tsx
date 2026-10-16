import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthSession } from '../hooks/useAuthSession';
import { useNotifications } from '../hooks/useNotifications';
import { CoupleProvider } from '../lib/coupleContext';
import { c } from '../components/theme';

// Pushed detail screens get a native header so they always have a back
// affordance and iOS swipe-back works; everything else is headerless.
const detailHeader = {
  headerShown: true,
  headerBackTitle: 'Back',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: c.cream },
  headerTintColor: c.plum,
  headerTitleStyle: { color: c.ink, fontFamily: 'Georgia' },
} as const;

export default function RootLayout() {
  const { session, restored } = useAuthSession();
  useNotifications(session?.user?.id ?? null);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {restored ? (
        <CoupleProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: c.cream },
            }}
          >
            <Stack.Screen name="question" options={{ ...detailHeader, title: 'Daily Question' }} />
            <Stack.Screen name="picture" options={{ ...detailHeader, title: 'Daily Picture' }} />
          </Stack>
        </CoupleProvider>
      ) : null}
    </SafeAreaProvider>
  );
}

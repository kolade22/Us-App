import { Stack } from 'expo-router';
import { c } from '../../components/theme';

// Authenticated area. Deliberately a plain Stack: the tab bar lives one level
// down in (tabs)/_layout.tsx, so this group is free to gain an auth guard or
// full-screen routes (modals, players) later without disturbing the tabs.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.cream },
      }}
    />
  );
}

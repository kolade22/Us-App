import { Redirect } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useCoupleContext } from '../lib/coupleContext';
import { AsyncError } from '../components/AsyncError';
import { Screen } from '../components/Screen';
import { c, s, space } from '../components/theme';

// Entry routing waits for the session restore AND the couple fetch. A FAILED
// fetch is not the same as "no couple": a signed-in user with a real couple
// must never be routed into create/join by a transient error — they get a
// retry state instead, and only a clean "no active couple" goes to onboarding.
export default function HomeScreen() {
  const { restored, userId, loading, error, couple, refresh } = useCoupleContext();

  if (!restored) return null;
  if (userId === null) return <Redirect href="/onboarding" />;
  // Only a settle with no data and no error shows nothing; a retry keeps the
  // error on screen so the user can see it working.
  if (loading && !couple && error === null) return null;
  // Fetch errored with no couple data: retry, never redirect to onboarding.
  // (error with a stale couple still routes on that couple — real data beats
  // a dead end, and the app screens surface their own errors.)
  if (error !== null && couple === null) {
    return (
      <Screen>
        <Text style={s.eyebrow}>US / YOUR PRIVATE SPACE</Text>
        <Text style={s.title}>One moment.</Text>
        <Text style={styles.body}>
          We couldn't reach your space. This looks temporary — nothing about your couple has changed.
        </Text>
        <AsyncError
          message="Couldn't load your space."
          retryLabel={loading ? 'Retrying…' : 'Try again'}
          onRetry={refresh}
        />
      </Screen>
    );
  }
  if (couple?.status === 'active') return <Redirect href="/(app)/(tabs)/home" />;
  return <Redirect href="/onboarding" />;
}

const styles = StyleSheet.create({
  body: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: space.md },
});

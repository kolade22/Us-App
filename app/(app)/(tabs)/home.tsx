import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { usePet } from '../../../hooks/usePet';
import { usePresence } from '../../../hooks/usePresence';
import { useCoupleContext } from '../../../lib/coupleContext';
import { lastSeenText, todayLabel } from '../../../lib/format';
import { AsyncError } from '../../../components/AsyncError';
import { Press } from '../../../components/Press';
import { Screen } from '../../../components/Screen';
import { Skeleton } from '../../../components/Skeleton';
import { c, radius, s, shadow, space } from '../../../components/theme';

// Presence indicator that breathes while the partner is actually connected.
function LiveDot({ online }: { online: boolean }) {
  const pulse = useState(() => new Animated.Value(1))[0];

  useEffect(() => {
    if (!online) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [online, pulse]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, { opacity: pulse }]} />
      <View style={[styles.dot, !online && styles.dotOff]} />
    </View>
  );
}

function Counter({ startDate }: { startDate: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - new Date(startDate).getTime()) / 1000));
  const units: [number, string][] = [
    [Math.floor(seconds / 86400), 'days'],
    [Math.floor(seconds / 3600) % 24, 'hrs'],
    [Math.floor(seconds / 60) % 60, 'min'],
  ];

  return (
    <View style={[styles.counter, shadow.lifted]}>
      <Text style={styles.counterLabel}>TOGETHER FOR</Text>
      <View style={styles.counterRow}>
        {units.map(([value, label], index) => (
          <View key={label} style={[styles.counterUnit, index > 0 && styles.counterUnitDivided]}>
            <Text style={styles.counterValue}>{value}</Text>
            <Text style={styles.counterUnitLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PetStat({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Home() {
  const { userId, coupleId, partnerId, profile, couple, partner } = useCoupleContext();
  const presence = usePresence(coupleId, userId, partnerId);
  const { pet, loading: petLoading, careAction } = usePet(coupleId, userId);
  const [careBusy, setCareBusy] = useState(false);
  const [careError, setCareError] = useState<string | null>(null);
  const partnerName = partner?.display_name ?? 'your person';
  const userName = profile?.display_name ?? 'you';

  // Pet stats are server-owned (pet_state via Postgres Changes) — this only
  // records the care action; no local mutation.
  const care = async () => {
    if (careBusy) return;
    setCareBusy(true);
    setCareError(null);
    try {
      await careAction('care');
    } catch {
      setCareError('Could not reach the little one.');
    } finally {
      setCareBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={s.eyebrow}>{todayLabel()}</Text>
      <Text style={s.display}>
        A space for {userName}
        {'\n'}& {partnerName}.
      </Text>

      <View style={styles.presence}>
        <LiveDot online={presence.partnerOnline} />
        <Text style={styles.presenceText}>
          {partnerName} {presence.partnerOnline ? 'is here' : `is ${lastSeenText(presence.partnerLastSeen)}`}
        </Text>
      </View>

      {couple && <Counter startDate={couple.relationship_start_date} />}

      <Text style={styles.section}>THE LITTLE THINGS</Text>
      <Press
        style={[s.card, styles.row]}
        onPress={() => router.push('/(app)/(tabs)/chat')}
        accessibilityLabel="Open your conversation"
      >
        <Text style={styles.rowIcon}>••</Text>
        <View style={styles.rowText}>
          <Text style={s.heading}>Send a note</Text>
          <Text style={s.caption}>Pick up your conversation</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Press>
      <Press
        style={[s.card, styles.row]}
        onPress={() => router.push('/(app)/(tabs)/thoughts')}
        accessibilityLabel="Open shared thoughts"
      >
        <Text style={styles.rowIcon}>~</Text>
        <View style={styles.rowText}>
          <Text style={s.heading}>Open Thoughts</Text>
          <Text style={s.caption}>Write in the same moment</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Press>

      <Text style={styles.section}>YOUR LITTLE CREATURE</Text>
      <View style={[s.card, shadow.soft]}>
        <Text style={s.eyebrow}>SHARED · CORE</Text>
        <Text style={styles.petName}>Your little creature</Text>
        {petLoading ? (
          <View style={styles.stats}>
            <Skeleton width={64} height={54} radius={radius.md} />
            <Skeleton width={64} height={54} radius={radius.md} />
            <Skeleton width={64} height={54} radius={radius.md} />
          </View>
        ) : pet ? (
          <View style={styles.stats}>
            <PetStat label="Health" value={pet.health} />
            <PetStat label="Hunger" value={pet.hunger} />
            <PetStat label="Joy" value={pet.happiness} />
          </View>
        ) : (
          <Text style={[s.body, { marginTop: space.sm }]}>Your little creature is still arriving.</Text>
        )}
        <Press
          style={[styles.care, careBusy && styles.careBusy]}
          onPress={() => { void care(); }}
          disabled={careBusy}
          accessibilityLabel="Care for your pet"
        >
          <Text style={styles.careText}>{careBusy ? 'Caring…' : 'Care for it'}</Text>
        </Press>
        {careError !== null && (
          <AsyncError message={careError} retryLabel="Try again" onRetry={() => { void care(); }} />
        )}
      </View>

      <Text style={styles.section}>COMING SOON</Text>
      <View style={styles.locked}>
        <Text style={s.body}>Games and Memories will live here when they are ready.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presence: {
    alignItems: 'center',
    backgroundColor: c.sage,
    borderRadius: radius.md,
    flexDirection: 'row',
    marginTop: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  dotWrap: { alignItems: 'center', height: 14, justifyContent: 'center', marginRight: space.sm, width: 14 },
  dotHalo: { backgroundColor: c.sageDeep, borderRadius: 7, height: 14, position: 'absolute', width: 14 },
  dot: { backgroundColor: c.sageDeep, borderRadius: 4, height: 8, width: 8 },
  dotOff: { backgroundColor: c.muted },
  presenceText: { color: c.ink, flexShrink: 1, fontSize: 13, fontWeight: '700' },

  counter: { backgroundColor: c.plum, borderRadius: radius.xl, marginTop: space.lg, padding: space.lg },
  counterLabel: { color: c.blush, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  counterRow: { flexDirection: 'row', marginTop: space.md },
  counterUnit: { flex: 1, paddingLeft: space.sm },
  counterUnitDivided: { borderLeftColor: 'rgba(255,255,255,0.2)', borderLeftWidth: 1 },
  counterValue: { color: c.white, fontFamily: 'Georgia', fontSize: 34, lineHeight: 40 },
  counterUnitLabel: { color: c.blush, fontSize: 11, fontWeight: '700', marginTop: 2 },

  section: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: space.md, marginTop: space.xxl },
  row: { alignItems: 'center', flexDirection: 'row', marginBottom: space.sm },
  rowIcon: { color: c.coral, fontFamily: 'Courier', fontSize: 20, marginRight: space.lg, width: 26 },
  rowText: { flex: 1 },
  arrow: { color: c.plum, fontSize: 20, marginLeft: space.sm },

  petName: { color: c.ink, fontFamily: 'Georgia', fontSize: 22, marginTop: space.xs, marginBottom: space.md },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { alignItems: 'center', backgroundColor: c.blush, borderRadius: radius.md, flex: 1, paddingVertical: space.md },
  statValue: { color: c.plumDeep, fontFamily: 'Georgia', fontSize: 22 },
  statLabel: { color: c.plum, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 2 },
  care: { alignItems: 'center', backgroundColor: c.plum, borderRadius: radius.md, marginTop: space.lg, paddingVertical: space.md },
  careBusy: { opacity: 0.6 },
  careText: { color: c.white, fontSize: 13, fontWeight: '800' },

  locked: { borderColor: c.line, borderRadius: radius.md, borderWidth: 1, padding: space.lg },
});

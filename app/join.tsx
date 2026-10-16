import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useCoupleContext } from '../lib/coupleContext';
import { edgeErrorMessage } from '../lib/edge';
import { AsyncError } from '../components/AsyncError';
import { Press } from '../components/Press';
import { Screen } from '../components/Screen';
import { c, s, space } from '../components/theme';

export default function Join() {
  const { userId, couple, refresh } = useCoupleContext();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (userId && couple) router.replace('/(app)/(tabs)/home'); }, [userId, couple]);

  const join = async () => {
    if (busy || !userId) return;
    if (!code.trim()) { setError('Enter the invite code they shared.'); return; }
    setBusy(true); setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<{ couple_id: string }>('join-couple', { body: { invite_code: code.trim() } });
      if (fnError) throw new Error(await edgeErrorMessage(fnError, data, 'Could not join. Check the code and try again.'));
      refresh();
      router.replace('/(app)/(tabs)/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen avoidKeyboard>
      <Text style={s.eyebrow}>JOIN YOUR PERSON</Text>
      <Text style={s.title}>Bring your code.</Text>
      <Text style={styles.lede}>Enter the invite they shared with you.</Text>

      <TextInput
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
        placeholder="K7X9-P2"
        placeholderTextColor={c.muted}
        accessibilityLabel="Invite code"
        style={[s.input, styles.code]}
      />

      <Press
        style={[s.primary, busy && styles.busy]}
        disabled={busy}
        onPress={userId ? join : () => router.push('/onboarding')}
        accessibilityLabel={userId ? 'Join your person' : 'Sign in to join'}
      >
        <Text style={s.primaryText}>{busy ? 'Joining…' : userId ? 'Continue' : 'Sign in to join'}</Text>
      </Press>

      {error !== null && <AsyncError message={error} onRetry={join} />}

      <Text style={styles.hint}>Codes are single-use and expire 7 days after they are made.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: space.md },
  code: { fontFamily: 'Courier', fontSize: 25, letterSpacing: 3, marginBottom: space.lg, marginTop: space.xxl, textAlign: 'center' },
  busy: { opacity: 0.6 },
  hint: { color: c.muted, fontSize: 11, lineHeight: 17, marginTop: space.xxl, textAlign: 'center' },
});

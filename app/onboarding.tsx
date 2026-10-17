import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useCoupleContext } from '../lib/coupleContext';
import { edgeErrorMessage } from '../lib/edge';
import { deviceTimezone } from '../lib/format';
import { AsyncError } from '../components/AsyncError';
import { Press } from '../components/Press';
import { Screen } from '../components/Screen';
import { c, radius, s, shadow, space } from '../components/theme';

type CreateCoupleResponse = { couple_id: string; invite_code: string; invite_code_expires_at: string; status: string };

export default function Onboarding() {
  const { userId, profile, couple, refresh } = useCoupleContext();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const authed = userId !== null;
  const pendingCode = couple?.status === 'pending' && couple.invite_code ? couple.invite_code : null;
  const code = inviteCode ?? pendingCode;

  // Already part of an active couple -> straight into the app.
  useEffect(() => { if (userId && couple?.status === 'active' && !inviteCode) router.replace('/(app)/(tabs)/home'); }, [userId, couple, inviteCode]);
  // Prefill the name of a returning signed-in user.
  useEffect(() => { if (!name && profile?.display_name) setName(profile.display_name); }, [profile, name]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // The context userId is stale right after signUp/signIn — read the fresh session.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in first.');
    const { error: profileError } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', session.user.id);
    if (profileError) throw profileError;
  };

  const authenticate = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError(null);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) { setMode('signin'); setError('Check your email to confirm your account, then sign in.'); return; }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
      await saveName();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const createCouple = async () => {
    if (busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) { setError('Enter your start date as YYYY-MM-DD.'); return; }
    setBusy(true); setError(null);
    try {
      await saveName();
      const { data, error: fnError } = await supabase.functions.invoke<CreateCoupleResponse>('create-couple', { body: { relationship_start_date: date } });
      if (fnError || !data) throw new Error(await edgeErrorMessage(fnError, data, 'Could not create your space. Try again.'));
      // Anchor the couple's "today" to the creator's zone so the server's
      // daily boundaries match the people using it. Non-fatal on failure.
      try {
        await supabase
          .from('couple_settings')
          .update({ timezone: deviceTimezone() })
          .eq('couple_id', data.couple_id);
      } catch {
        // The couple still works on UTC.
      }
      setInviteCode(data.invite_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your space. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const enterSpace = () => { refresh(); router.replace('/(app)/(tabs)/home'); };

  if (code) {
    return (
      <Screen avoidKeyboard>
        <Text style={s.eyebrow}>US / YOUR PRIVATE SPACE</Text>
        <Text style={styles.logo}>us<Text style={styles.logoDot}>.</Text></Text>
        <Text style={s.title}>Your space is open.{'\n'}Now bring them in.</Text>
        <Text style={styles.lede}>Share this invite code with your person. It lasts 7 days.</Text>
        <View style={[styles.codeCard, shadow.lifted]}>
          <Text style={styles.codeLabel}>INVITE CODE</Text>
          <Text style={styles.code} selectable>{code}</Text>
        </View>
        <Press style={s.primary} onPress={enterSpace} accessibilityLabel="Continue to your shared space">
          <Text style={s.primaryText}>Continue to our space</Text>
        </Press>
        <Text style={styles.footnote}>You can wait here together — or step inside and they will follow.</Text>
      </Screen>
    );
  }

  return (
    <Screen avoidKeyboard>
      <Text style={s.eyebrow}>US / YOUR PRIVATE SPACE</Text>
      <Text style={styles.logo}>us<Text style={styles.logoDot}>.</Text></Text>
      <Text style={s.title}>Start with the date{'\n'}you became us.</Text>
      <Text style={styles.lede}>A simple home for the small things that belong to both of you.</Text>

      {!authed && (
        <>
          <Text style={s.label}>EMAIL</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={c.muted}
            accessibilityLabel="Email"
            style={s.input}
          />
          <Text style={s.label}>PASSWORD</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={c.muted}
            accessibilityLabel="Password"
            style={s.input}
          />
        </>
      )}

      <Text style={s.label}>YOUR NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Kolade"
        placeholderTextColor={c.muted}
        accessibilityLabel="Your name"
        style={s.input}
      />

      <Text style={s.label}>RELATIONSHIP START DATE</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.muted}
        accessibilityLabel="Relationship start date"
        style={s.input}
      />

      <Press
        style={[s.primary, styles.submit, busy && styles.busy]}
        disabled={busy}
        onPress={authed ? createCouple : authenticate}
        accessibilityLabel={authed ? 'Enter our space' : mode === 'signup' ? 'Create your account' : 'Sign in'}
      >
        <Text style={s.primaryText}>
          {busy ? 'One moment…' : authed ? 'Enter our space' : mode === 'signup' ? 'Create your account' : 'Sign in'}
        </Text>
      </Press>

      {error !== null && (
        <AsyncError message={error} onRetry={authed ? createCouple : authenticate} retryLabel={busy ? '…' : 'Try again'} />
      )}

      {!authed && (
        <Press style={styles.switch} accessibilityRole="link" onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}>
          <Text style={styles.join}>
            {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <Text style={styles.joinStrong}>{mode === 'signup' ? 'Sign in' : 'Create your account'}</Text>
          </Text>
        </Press>
      )}
      {authed && (
        <Press style={styles.switch} accessibilityRole="link" onPress={() => router.push('/join')}>
          <Text style={styles.join}>
            Joining with an invite code? <Text style={styles.joinStrong}>Join your person</Text>
          </Text>
        </Press>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { color: c.ink, fontFamily: 'Georgia', fontSize: 68, marginTop: space.lg },
  logoDot: { color: c.coral },
  lede: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: space.md },
  submit: { marginTop: space.xxl },
  busy: { opacity: 0.6 },
  switch: { marginTop: space.xl },
  join: { color: c.muted, fontSize: 13, textAlign: 'center' },
  joinStrong: { color: c.plum, fontWeight: '800' },
  codeCard: {
    alignItems: 'center',
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: space.xxl,
    padding: space.xl,
  },
  codeLabel: { color: c.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  code: { color: c.plum, fontFamily: 'Courier', fontSize: 34, fontWeight: '800', letterSpacing: 5, marginTop: space.sm },
  footnote: { color: c.muted, fontSize: 12, lineHeight: 18, marginTop: space.lg, textAlign: 'center' },
});

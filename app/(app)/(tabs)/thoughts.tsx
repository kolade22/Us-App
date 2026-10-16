import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useOpenThoughts } from '../../../hooks/useOpenThoughts';
import { useCoupleContext } from '../../../lib/coupleContext';
import { Screen } from '../../../components/Screen';
import { c, radius, s, shadow, space } from '../../../components/theme';

export default function Thoughts() {
  const { coupleId, partner } = useCoupleContext();
  const { partnerText, sendThought } = useOpenThoughts(coupleId);
  const [text, setText] = useState('');
  const partnerName = partner?.display_name ?? 'Your person';

  // The hook throttles the ephemeral broadcast; typing here is its own
  // channel, unrelated to chat's typing indicator.
  const onTextChange = (value: string) => { setText(value); sendThought(value); };

  return (
    <Screen avoidKeyboard contentStyle={styles.root}>
      <Text style={s.eyebrow}>A SHARED PAGE</Text>
      <Text style={s.title}>Open Thoughts</Text>
      <Text style={styles.intro}>
        No sending. No polishing. Just leave a thought here and let them find you in it.
      </Text>

      <View style={[styles.paper, shadow.soft]}>
        <TextInput
          multiline
          value={text}
          onChangeText={onTextChange}
          placeholder="Start writing..."
          placeholderTextColor={c.muted}
          accessibilityLabel="Your shared thought"
          style={styles.writing}
        />
      </View>

      <View style={styles.live}>
        <View style={[styles.liveDot, partnerText ? styles.liveOn : styles.liveOff]} />
        <Text style={[styles.liveText, partnerText ? styles.liveTextOn : null]}>
          {partnerText ? `${partnerName} is writing nearby` : 'Your words stay soft until you are ready'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space.lg },
  intro: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: space.md },
  paper: { backgroundColor: '#FFF8EE', borderColor: '#E8D8C8', borderRadius: radius.xl, borderWidth: 1, marginTop: space.xxl, minHeight: 390, padding: space.xl },
  writing: { color: c.ink, flex: 1, fontFamily: 'Georgia', fontSize: 24, lineHeight: 34, minHeight: 330, textAlignVertical: 'top' },
  live: { alignItems: 'center', flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  liveDot: { borderRadius: 4, height: 8, width: 8 },
  liveOn: { backgroundColor: c.coral },
  liveOff: { backgroundColor: c.line },
  liveText: { color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7 },
  liveTextOn: { color: c.coral },
});

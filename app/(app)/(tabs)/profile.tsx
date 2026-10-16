import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCoupleContext } from '../../../lib/coupleContext';
import { Press } from '../../../components/Press';
import { Screen } from '../../../components/Screen';
import { c, radius, s, shadow, space } from '../../../components/theme';

function Action({
  glyph,
  title,
  caption,
  onPress,
  accessibilityLabel,
}: {
  glyph: string;
  title: string;
  caption: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Press style={[s.card, styles.action]} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.actionIcon}>
        <Text style={styles.actionGlyph}>{glyph}</Text>
      </View>
      <View style={styles.actionText}>
        <Text style={s.heading}>{title}</Text>
        <Text style={s.caption}>{caption}</Text>
      </View>
      <Text style={styles.arrow}>→</Text>
    </Press>
  );
}

export default function Profile() {
  const { profile, partner } = useCoupleContext();
  const name = profile?.display_name ?? 'Your profile';
  const initial = profile?.display_name?.trim()?.[0]?.toUpperCase() ?? '○';

  return (
    <Screen>
      <Text style={s.eyebrow}>YOUR SPACE</Text>
      <Text style={s.title}>Profile</Text>

      <View style={[styles.identity, shadow.soft]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={s.caption}>
            {partner?.display_name ? `Private to you & ${partner.display_name}` : 'Private to your couple'}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>RITUALS</Text>
      <Action
        glyph="◇"
        title="Daily Question"
        caption="Answer and reveal"
        onPress={() => router.push('/question')}
        accessibilityLabel="Open daily question"
      />
      <Action
        glyph="▢"
        title="Daily Picture"
        caption="Share today's frame"
        onPress={() => router.push('/picture')}
        accessibilityLabel="Open daily picture"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: space.xl,
    padding: space.lg,
  },
  avatar: { alignItems: 'center', backgroundColor: c.blush, borderRadius: 34, height: 68, justifyContent: 'center', marginRight: space.lg, width: 68 },
  avatarText: { color: c.plum, fontFamily: 'Georgia', fontSize: 30 },
  identityText: { flex: 1 },
  name: { color: c.ink, fontFamily: 'Georgia', fontSize: 23, marginBottom: 3 },

  section: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: space.md, marginTop: space.xxl },
  action: { alignItems: 'center', flexDirection: 'row', marginBottom: space.sm },
  actionIcon: { alignItems: 'center', backgroundColor: c.coralWash, borderRadius: radius.md, height: 42, justifyContent: 'center', marginRight: space.lg, width: 42 },
  actionGlyph: { color: c.coral, fontSize: 17 },
  actionText: { flex: 1 },
  arrow: { color: c.plum, fontSize: 20, marginLeft: space.sm },
});

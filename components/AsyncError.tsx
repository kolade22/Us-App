import { StyleSheet, Text, View } from 'react-native';
import { Press } from './Press';
import { c, radius, space } from './theme';

// The app's single async-failure pattern: inline message + retry button.
// Chat sends, auth, couple create/join, daily answers, picture uploads and
// pet care all render this — never a per-screen error design.
export function AsyncError({
  message,
  onRetry,
  retryLabel = 'Try again',
  align = 'left',
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  align?: 'left' | 'right';
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, align === 'right' && styles.right]}
    >
      <Text style={styles.text}>{message}</Text>
      <Press onPress={onRetry} style={styles.retry} accessibilityLabel={retryLabel}>
        <Text style={styles.retryText}>{retryLabel}</Text>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: c.coralWash,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  right: { alignSelf: 'flex-end' },
  text: { color: c.coral, flexShrink: 1, fontSize: 12, fontWeight: '700' },
  retry: {
    borderColor: c.coral,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  retryText: { color: c.coral, fontSize: 11, fontWeight: '800' },
});

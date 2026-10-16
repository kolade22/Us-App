import { type ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, space } from './theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  // Pinned below the scroll area (e.g. a chat composer) — never scrolled.
  footer?: ReactNode;
  // False when a navigation header already covers the status bar.
  topInset?: boolean;
  // Lift content above the keyboard (screens with text inputs).
  avoidKeyboard?: boolean;
};

// Shared screen shell: safe-area top inset, cream background, and a short
// fade-and-rise entrance so every route arrives instead of appearing.
export function Screen({
  children,
  scroll = true,
  contentStyle,
  footer,
  topInset = true,
  avoidKeyboard = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, speed: 13, bounciness: 5, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fade, rise]);

  const entrance = { opacity: fade, transform: [{ translateY: rise }] };

  const body = (
    <>
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={entrance}>{children}</Animated.View>
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>
          <Animated.View style={[styles.fill, entrance]}>{children}</Animated.View>
        </View>
      )}
      {footer}
    </>
  );

  return (
    <View style={[styles.screen, topInset && { paddingTop: insets.top }]}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: c.cream, flex: 1 },
  content: { padding: space.xl, paddingBottom: space.xxl },
  fill: { flex: 1 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMessages, type ChatMessage } from '../../../hooks/useMessages';
import { usePresence } from '../../../hooks/usePresence';
import { useTypingIndicator } from '../../../hooks/useTypingIndicator';
import { useCoupleContext } from '../../../lib/coupleContext';
import { lastSeenText, timeOf } from '../../../lib/format';
import { AsyncError } from '../../../components/AsyncError';
import { Press } from '../../../components/Press';
import { Screen } from '../../../components/Screen';
import { Skeleton } from '../../../components/Skeleton';
import { c, radius, s, shadow, space } from '../../../components/theme';

// Three dots that ripple while the partner is composing.
function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 360, useNativeDriver: true }),
          Animated.delay((2 - index) * 150),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.dots} accessibilityLabel="Partner is typing">
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.dotDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

// Bubbles fade and lift on mount — new messages arrive rather than pop in.
function MessageBubble({ message, mine, onRetry }: { message: ChatMessage; mine: boolean; onRetry: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fade, lift]);

  return (
    <Animated.View style={[styles.line, mine && styles.mine, { opacity: fade, transform: [{ translateY: lift }] }]}>
      <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble, mine && shadow.soft]}>
        <Text style={[styles.message, mine && styles.myMessage]}>{message.content ?? ''}</Text>
        <Text style={[styles.time, mine && styles.myTime]}>
          {timeOf(message.created_at)}
          {mine ? (message.status === 'sending' ? '  ·' : message.status === 'sent' ? '  ✓✓' : '') : ''}
        </Text>
      </View>
      {mine && message.status === 'failed' && (
        <AsyncError align="right" message="Didn't send." retryLabel="Resend" onRetry={onRetry} />
      )}
    </Animated.View>
  );
}

export default function Chat() {
  const { userId, coupleId, partnerId, partner } = useCoupleContext();
  const { messages, sendMessage, retryMessage, markRead } = useMessages(coupleId, userId);
  const presence = usePresence(coupleId, userId, partnerId);
  const { partnerTyping, notifyTyping } = useTypingIndicator(coupleId, userId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<ScrollView>(null);
  // Auto-follow new messages only while the reader is already at the bottom.
  const atBottomRef = useRef(true);
  const partnerName = partner?.display_name ?? 'your person';

  // Read receipts are batched server-side: one UPDATE for every unread
  // incoming message, fired when the screen gains focus and once per new
  // incoming batch — not once per message.
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  useEffect(() => {
    if (!focused || messages === null || userId === null) return;
    if (!messages.some((message) => message.sender_id !== userId && message.read_at === null)) return;
    void markRead().catch(() => undefined);
  }, [focused, messages, userId, markRead]);

  // Follow new messages only when already at the bottom — never yank the
  // reader out of history they scrolled back to.
  useEffect(() => {
    if (!messages?.length || !atBottomRef.current) return;
    listRef.current?.scrollToEnd({ animated: messages.length > 1 });
  }, [messages?.length]);

  // Typing lives in useTypingIndicator (ephemeral broadcast) — fully separate
  // from the message-sending path below.
  const onDraftChange = (text: string) => { setDraft(text); notifyTyping(); };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(body);
    } catch {
      // the failed row shows inline retry
    } finally {
      setSending(false);
    }
  };

  const retry = (clientGeneratedId: string) => { void retryMessage(clientGeneratedId).catch(() => undefined); };

  return (
    <Screen
      scroll={false}
      avoidKeyboard
      contentStyle={styles.root}
      footer={
        <View style={styles.compose}>
          <TextInput
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Write something..."
            placeholderTextColor={c.muted}
            accessibilityLabel="Message"
            multiline
            style={[s.input, styles.draft]}
          />
          <Press
            disabled={!draft.trim() || sending}
            style={[styles.send, (!draft.trim() || sending) && styles.sendOff]}
            onPress={() => { void send(); }}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendText}>↑</Text>
          </Press>
        </View>
      }
    >
      <View style={styles.head}>
        <Text style={s.eyebrow}>YOUR THREAD</Text>
        <Text style={styles.title}>{partnerName}</Text>
        <View style={styles.statusRow}>
          {partnerTyping ? (
            <>
              <TypingDots />
              <Text style={styles.status}>{partnerName} is typing</Text>
            </>
          ) : (
            <>
              <View style={[styles.statusDot, !presence.partnerOnline && styles.statusDotOff]} />
              <Text style={styles.status}>
                {presence.partnerOnline ? 'online' : lastSeenText(presence.partnerLastSeen)}
              </Text>
            </>
          )}
        </View>
      </View>

      <ScrollView
        ref={listRef}
        style={s.fill}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          atBottomRef.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
        }}
        onContentSizeChange={() => {
          if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {messages === null && (
          <View style={styles.skeleton}>
            <Skeleton width="62%" height={44} radius={radius.lg} />
            <Skeleton width="48%" height={44} radius={radius.lg} style={styles.skeletonMine} />
            <Skeleton width="70%" height={44} radius={radius.lg} />
          </View>
        )}
        {messages !== null && messages.length === 0 && (
          <Text style={styles.hint}>Nothing here yet. Say something first.</Text>
        )}
        {messages?.map((message) => (
          <MessageBubble
            key={message.client_generated_id}
            message={message}
            mine={message.sender_id === userId}
            onRetry={() => retry(message.client_generated_id)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { padding: 0 },
  head: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  title: { color: c.ink, fontFamily: 'Georgia', fontSize: 30, lineHeight: 36, marginTop: 3 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  status: { color: c.sageDeep, fontSize: 12, fontWeight: '700' },
  statusDot: { backgroundColor: c.sageDeep, borderRadius: 4, height: 8, width: 8 },
  statusDotOff: { backgroundColor: c.muted },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  dotDot: { backgroundColor: c.coral, borderRadius: 3, height: 6, width: 6 },

  list: { padding: space.xl, paddingTop: space.sm },
  skeleton: { gap: space.md, marginTop: space.lg },
  skeletonMine: { alignSelf: 'flex-end' },
  hint: { color: c.muted, fontSize: 13, marginTop: space.xxl, textAlign: 'center' },

  line: { alignItems: 'flex-start', marginBottom: space.md },
  mine: { alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, maxWidth: '82%', paddingHorizontal: space.lg, paddingVertical: space.md },
  theirBubble: { backgroundColor: c.paper, borderColor: c.line, borderWidth: 1 },
  myBubble: { backgroundColor: c.plum },
  message: { color: c.ink, fontSize: 15, lineHeight: 21 },
  myMessage: { color: c.white },
  time: { color: c.muted, fontSize: 10, marginTop: 5 },
  myTime: { color: c.blush },

  compose: {
    alignItems: 'flex-end',
    backgroundColor: c.paper,
    borderTopColor: c.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
  },
  draft: { flex: 1, maxHeight: 120, minHeight: 46, paddingVertical: space.md },
  send: { alignItems: 'center', backgroundColor: c.coral, borderRadius: radius.pill, height: 46, justifyContent: 'center', width: 46 },
  sendOff: { opacity: 0.4 },
  sendText: { color: c.white, fontSize: 22, fontWeight: '800' },
});

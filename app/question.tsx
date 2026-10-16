import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDailyQuestion, type PartnerReveal } from '../hooks/useDailyQuestion';
import { useCoupleContext } from '../lib/coupleContext';
import { timeOf } from '../lib/format';
import { AsyncError } from '../components/AsyncError';
import { Press } from '../components/Press';
import { Screen } from '../components/Screen';
import { Skeleton } from '../components/Skeleton';
import { c, radius, s, shadow, space } from '../components/theme';

export default function Question() {
  const { userId, coupleId } = useCoupleContext();
  const { current, loading, answering, submitAnswer, partnerReveal, refresh } = useDailyQuestion(coupleId, userId);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<PartnerReveal | null>(null);
  const answered = current?.instance.answered_at != null;

  // Re-read on focus: their answer may have landed while this was in the
  // background, and today's question may have rolled over.
  useFocusEffect(
    useCallback(() => {
      refresh();
      void partnerReveal().then(setReveal).catch(() => undefined);
    }, [refresh, partnerReveal]),
  );

  const submit = async () => {
    if (!current || answered || answering || !answer.trim()) return;
    setError(null);
    try {
      await submitAnswer(answer.trim());
      setReveal(await partnerReveal());
    } catch {
      setError('Could not save your answer.');
    }
  };

  return (
    <Screen topInset={false} avoidKeyboard>
      <Text style={s.eyebrow}>TODAY'S QUESTION</Text>

      {loading ? (
        <>
          <Skeleton width="82%" height={32} radius={radius.md} style={styles.skeletonTitle} />
          <Skeleton width="58%" height={32} radius={radius.md} style={styles.skeletonTitleTight} />
          <Skeleton height={140} radius={radius.md} style={styles.skeletonAnswer} />
        </>
      ) : (
        <>
          <Text style={s.title}>{current?.questionText || 'No question waiting today.'}</Text>
          {current && (
            <>
              <TextInput
                multiline
                editable={!answered}
                value={answered ? (current.instance.answer_text ?? '') : answer}
                onChangeText={setAnswer}
                placeholder="Write a little something..."
                placeholderTextColor={c.muted}
                accessibilityLabel="Your answer"
                style={[s.input, styles.answer]}
              />
              {!answered && (
                <Press
                  style={[s.primary, answering && styles.busy]}
                  disabled={answering}
                  onPress={() => { void submit(); }}
                  accessibilityLabel="Submit answer"
                >
                  <Text style={s.primaryText}>{answering ? 'Submitting…' : 'Submit answer'}</Text>
                </Press>
              )}
              {error !== null && (
                <AsyncError message={error} retryLabel="Try again" onRetry={() => { void submit(); }} />
              )}
            </>
          )}
        </>
      )}

      <View style={[s.card, shadow.soft, styles.reveal]}>
        <Text style={s.eyebrow}>PARTNER'S ANSWER</Text>
        <Text style={styles.revealText}>
          {reveal
            ? reveal.answerText
            : answered
              ? 'Their answer will appear here when they answer one of yours.'
              : 'Answer yours first to unlock the reveal.'}
        </Text>
        {reveal && (
          <Text style={styles.revealMeta}>{reveal.questionText} · {timeOf(reveal.answeredAt)}</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletonTitle: { marginTop: space.md },
  skeletonTitleTight: { marginTop: space.sm },
  skeletonAnswer: { marginTop: space.xl },
  answer: { height: 140, marginBottom: space.lg, marginTop: space.xl, textAlignVertical: 'top' },
  busy: { opacity: 0.6 },
  reveal: { marginTop: space.xxl },
  revealText: { color: c.ink, fontFamily: 'Georgia', fontSize: 20, lineHeight: 28, marginTop: space.md },
  revealMeta: { color: c.muted, fontSize: 11, marginTop: space.md },
});

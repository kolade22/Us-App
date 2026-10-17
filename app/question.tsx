import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDailyQuestion, type PartnerReveal } from '../hooks/useDailyQuestion';
import { useCoupleContext } from '../lib/coupleContext';
import { supabase } from '../lib/supabase';
import { timeOf } from '../lib/format';
import { AsyncError } from '../components/AsyncError';
import { Press } from '../components/Press';
import { Screen } from '../components/Screen';
import { Skeleton } from '../components/Skeleton';
import { c, radius, s, shadow, space } from '../components/theme';

export default function Question() {
  const { userId, coupleId, partnerId, partner } = useCoupleContext();
  const { current, loading, answering, submitAnswer, partnerReveal, refresh } = useDailyQuestion(coupleId, userId);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<PartnerReveal | null>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionSent, setQuestionSent] = useState(false);
  const answered = current?.instance.answered_at != null;
  const partnerName = partner?.display_name ?? 'your person';

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

  // Written for the partner, not for me: issue_daily_question hands it over
  // on their next load (RLS requires target_user_id <> auth.uid()).
  const askPartner = async () => {
    const text = draftQuestion.trim();
    if (!text || sendingQuestion || !coupleId || !userId || !partnerId) return;
    setSendingQuestion(true);
    setQuestionError(null);
    setQuestionSent(false);
    try {
      const { error: insertError } = await supabase.from('questions').insert({
        couple_id: coupleId,
        created_by: userId,
        target_user_id: partnerId,
        question_text: text,
      });
      if (insertError) throw insertError;
      setDraftQuestion('');
      setQuestionSent(true);
    } catch {
      setQuestionError('Could not save your question.');
    } finally {
      setSendingQuestion(false);
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

      {partnerId && (
        <View style={[s.card, shadow.soft, styles.ask]}>
          <Text style={s.eyebrow}>ASK {partnerName.toUpperCase()} SOMETHING</Text>
          <TextInput
            multiline
            value={draftQuestion}
            onChangeText={(value) => {
              setDraftQuestion(value);
              setQuestionSent(false);
            }}
            placeholder="What do you want to know about them?"
            placeholderTextColor={c.muted}
            accessibilityLabel="Write a question for your partner"
            style={[s.input, styles.askInput]}
          />
          <Press
            style={[s.primary, (sendingQuestion || !draftQuestion.trim()) && styles.busy]}
            disabled={sendingQuestion || !draftQuestion.trim()}
            onPress={() => { void askPartner(); }}
            accessibilityLabel="Send the question to your partner"
          >
            <Text style={s.primaryText}>{sendingQuestion ? 'Saving…' : 'Send the question'}</Text>
          </Press>
          {questionSent && (
            <Text style={styles.sent}>
              Saved. They'll get it the next time they open this.
            </Text>
          )}
          {questionError !== null && (
            <AsyncError
              message={questionError}
              retryLabel="Try again"
              onRetry={() => { void askPartner(); }}
            />
          )}
        </View>
      )}
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
  ask: { marginTop: space.xxl },
  askInput: { height: 100, marginBottom: space.md, marginTop: space.md, textAlignVertical: 'top' },
  sent: { color: c.sageDeep, fontSize: 12, lineHeight: 18, marginTop: space.md },
});

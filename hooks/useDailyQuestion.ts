import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type QuestionInstance = Tables<'question_instances'>;

export type CurrentQuestion = {
  instance: QuestionInstance;
  questionText: string;
};

export type PartnerReveal = {
  questionText: string;
  answerText: string;
  answeredAt: string;
};

export type DailyQuestionState = {
  current: CurrentQuestion | null;
  loading: boolean;
  answering: boolean;
  submitAnswer: (answerText: string) => Promise<void>;
  partnerReveal: () => Promise<PartnerReveal | null>;
  refresh: () => void;
};

// Daily Questions for the signed-in user: fetches their latest issued
// instance (unanswered ones remain available — no forced rotation), submits
// the answer (recipient-only via RLS), and resolves the reveal of the
// partner's latest answered response to a question this user authored.
// "No eligible question" resolves to current === null — the UI renders its
// empty state, never a broken screen.
export function useDailyQuestion(
  coupleId: string | null,
  userId: string | null,
): DailyQuestionState {
  const [current, setCurrent] = useState<CurrentQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadedRef = useRef(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!coupleId || !userId) {
      setCurrent(null);
      loadedRef.current = false;
      setLoading(false);
      return;
    }
    let mounted = true;
    // Only the first load shows the skeleton; a focus refresh keeps the answer
    // on screen and swaps it when the new data lands.
    if (!loadedRef.current) setLoading(true);

    (async () => {
      try {
        // Lazily issue today's question. The RPC is 48h-throttled per
        // recipient and no-ops when nothing is due or the pool is empty, so
        // calling it on every load is cheap and needs no cron/scheduler.
        try {
          await supabase.rpc('issue_daily_question', {
            p_couple_id: coupleId,
            p_recipient_id: userId,
          });
        } catch {
          // Best-effort: still render any instance that already exists.
        }

        const { data: instance } = await supabase
          .from('question_instances')
          .select('*')
          .eq('couple_id', coupleId)
          .eq('recipient_id', userId)
          .order('issued_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;
        if (!instance) {
          setCurrent(null);
          return;
        }

        const { data: question } = await supabase
          .from('questions')
          .select('question_text')
          .eq('id', instance.question_id)
          .maybeSingle();

        if (!mounted) return;
        setCurrent({ instance, questionText: question?.question_text ?? '' });
      } finally {
        if (mounted) {
          setLoading(false);
          loadedRef.current = true;
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [coupleId, userId, refreshKey]);

  const submitAnswer = useCallback(
    async (answerText: string) => {
      if (!current || !answerText.trim()) return;
      setAnswering(true);
      try {
        const { data, error } = await supabase
          .from('question_instances')
          .update({ answer_text: answerText.trim(), answered_at: new Date().toISOString() })
          .eq('id', current.instance.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setCurrent((prev) =>
            prev ? { ...prev, instance: data } : prev,
          );
        }
      } finally {
        setAnswering(false);
      }
    },
    [current],
  );

  const partnerReveal = useCallback(async (): Promise<PartnerReveal | null> => {
    if (!coupleId || !userId) return null;

    // Questions this user authored FOR the partner.
    const { data: authored } = await supabase
      .from('questions')
      .select('id, question_text')
      .eq('couple_id', coupleId)
      .eq('created_by', userId);
    if (!authored?.length) return null;

    const authoredIds = authored.map((q) => q.id);
    const { data: answered } = await supabase
      .from('question_instances')
      .select('*')
      .eq('couple_id', coupleId)
      .in('question_id', authoredIds)
      .not('answered_at', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!answered?.answered_at || !answered.answer_text) return null;

    const question = authored.find((q) => q.id === answered.question_id);
    return {
      questionText: question?.question_text ?? '',
      answerText: answered.answer_text,
      answeredAt: answered.answered_at,
    };
  }, [coupleId, userId]);

  return { current, loading, answering, submitAnswer, partnerReveal, refresh };
}

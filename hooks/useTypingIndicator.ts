import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const TYPING_EMIT_INTERVAL_MS = 2000;
const TYPING_DECAY_MS = 4000;

export type TypingState = {
  partnerTyping: boolean;
  notifyTyping: () => void;
};

// Ephemeral typing indicator for chat — a broadcast event on a dedicated
// channel, completely separate from message sending. Never touches Postgres.
// Emits at most every 2s while the partner's indicator decays after 4s of
// silence.
export function useTypingIndicator(
  coupleId: string | null,
  userId: string | null,
): TypingState {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastEmitRef = useRef(0);
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!coupleId) return;
    let mounted = true;

    const channel = supabase.channel(`typing:${coupleId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!mounted) return;
      if (payload && typeof payload === 'object' && 'user_id' in payload) {
        if (payload.user_id === userId) return; // own echo, if any
      }
      setPartnerTyping(true);
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      decayTimerRef.current = setTimeout(() => {
        if (mounted) setPartnerTyping(false);
      }, TYPING_DECAY_MS);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      mounted = false;
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    const now = Date.now();
    if (now - lastEmitRef.current < TYPING_EMIT_INTERVAL_MS) return;
    lastEmitRef.current = now;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, at: now },
    });
  }, [userId]);

  return { partnerTyping, notifyTyping };
}

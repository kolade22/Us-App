import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const THROTTLE_MS = 400;

export type OpenThoughtsState = {
  partnerText: string;
  sendThought: (text: string) => void;
};

// Open Thoughts: ephemeral shared writing. Broadcast-only channel — never
// touches Postgres. Outgoing text is throttled (leading + trailing edge) so
// rapid typing emits at most ~2.5 updates/second, and the partner's text
// arrives near-instantly via the broadcast event.
export function useOpenThoughts(coupleId: string | null): OpenThoughtsState {
  const [partnerText, setPartnerText] = useState('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastEmitRef = useRef(0);
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef('');

  useEffect(() => {
    if (!coupleId) return;
    let mounted = true;

    const channel = supabase.channel(`thoughts:${coupleId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'thought' }, ({ payload }) => {
      if (!mounted) return;
      const text =
        payload && typeof payload === 'object' && 'text' in payload && typeof (payload as { text: unknown }).text === 'string'
          ? (payload as { text: string }).text
          : '';
      setPartnerText(text);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      mounted = false;
      if (trailingRef.current) clearTimeout(trailingRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const sendThought = useCallback((text: string) => {
    const channel = channelRef.current;
    if (!channel) return;
    latestTextRef.current = text;

    const emit = () => {
      lastEmitRef.current = Date.now();
      void channel.send({
        type: 'broadcast',
        event: 'thought',
        payload: { text: latestTextRef.current },
      });
    };

    const now = Date.now();
    const since = now - lastEmitRef.current;
    if (since >= THROTTLE_MS) {
      emit();
    } else {
      if (trailingRef.current) clearTimeout(trailingRef.current);
      trailingRef.current = setTimeout(emit, THROTTLE_MS - since);
    }
  }, []);

  return { partnerText, sendThought };
}

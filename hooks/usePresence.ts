import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type PresenceState = {
  partnerOnline: boolean;
  partnerLastSeen: string | null;
};

// Ephemeral Realtime Presence for the couple. Joins a presence channel keyed
// by user id; syncs partner online state. profiles.last_seen_at is written
// ONLY on disconnect (channel teardown), per the founder decision — never
// continuously.
export function usePresence(
  coupleId: string | null,
  userId: string | null,
  partnerId: string | null,
): PresenceState {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);

  useEffect(() => {
    if (!coupleId || !userId) return;
    let mounted = true;

    const channel = supabase.channel(`presence:${coupleId}`, {
      config: { presence: { key: userId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (!mounted) return;
      const keys = Object.keys(channel.presenceState());
      setPartnerOnline(keys.some((key) => key !== userId));
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    // Seed last-seen from the profile row (updated on previous disconnect).
    if (partnerId) {
      supabase
        .from('profiles')
        .select('last_seen_at')
        .eq('id', partnerId)
        .maybeSingle()
        .then(({ data }) => {
          if (mounted) setPartnerLastSeen(data?.last_seen_at ?? null);
        });
    }

    return () => {
      mounted = false;
      // Disconnect path: leave presence, then record last_seen_at once.
      void channel.untrack().then(() => supabase.removeChannel(channel));
      if (userId) {
        void supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId);
      }
    };
  }, [coupleId, userId, partnerId]);

  return { partnerOnline, partnerLastSeen };
}

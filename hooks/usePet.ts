import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type PetStateRow = Tables<'pet_state'>;

export type PetState = {
  pet: PetStateRow | null;
  loading: boolean;
  careAction: (actionType: string) => Promise<void>;
};

// Shared pet — CORE only. Reads pet_state (live, via Postgres Changes) and
// records care actions into pet_actions with free-form action_type. No pet
// mechanics, thresholds, or species are encoded here: the founders' design
// will consume pet_actions and drive pet_state later, without restructuring.
export function usePet(coupleId: string | null, userId: string | null): PetState {
  const [pet, setPet] = useState<PetStateRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) {
      setPet(null);
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase
      .from('pet_state')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) {
          setPet(data);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`pet:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pet_state', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as unknown as PetStateRow;
          if (mounted) setPet(row);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const careAction = useCallback(
    async (actionType: string) => {
      if (!coupleId || !userId || !actionType.trim()) return;
      const { error } = await supabase.from('pet_actions').insert({
        couple_id: coupleId,
        user_id: userId,
        action_type: actionType.trim(),
      });
      if (error) throw error;
    },
    [coupleId, userId],
  );

  return { pet, loading, careAction };
}

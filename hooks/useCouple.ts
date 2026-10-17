import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

type Profile = Tables<'profiles'>;
type Couple = Tables<'couples'>;

export type CoupleData = {
  profile: Profile | null;
  couple: Couple | null;
  partnerId: string | null;
  partner: Profile | null;
  // Couple's configured IANA zone; drives server-side daily boundaries.
  timezone: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

// Resolves the signed-in user's profile, their couple (if joined), and
// their partner's profile. RLS guarantees only own/partner rows are visible.
export function useCouple(userId: string | null): CoupleData {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);

    (async () => {
      let failed = false;
      try {
        const { data: myProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!mounted) return;
        setProfile(myProfile);

        const { data: membership, error: memberError } = await supabase
          .from('couple_members')
          .select('couple_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (memberError) throw memberError;
        if (!mounted) return;

        if (!membership) {
          setCouple(null);
          setPartnerId(null);
          setPartner(null);
          setTimezone(null);
          return;
        }

        const [coupleResult, partnerMemberResult, settingsResult] = await Promise.all([
          supabase.from('couples').select('*').eq('id', membership.couple_id).maybeSingle(),
          supabase
            .from('couple_members')
            .select('user_id')
            .eq('couple_id', membership.couple_id)
            .neq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('couple_settings')
            .select('timezone')
            .eq('couple_id', membership.couple_id)
            .maybeSingle(),
        ]);
        if (coupleResult.error) throw coupleResult.error;
        if (partnerMemberResult.error) throw partnerMemberResult.error;
        if (!mounted) return;

        setCouple(coupleResult.data);
        setPartnerId(partnerMemberResult.data?.user_id ?? null);
        setTimezone(settingsResult.data?.timezone ?? null);

        if (partnerMemberResult.data?.user_id) {
          const { data: partnerProfile, error: partnerError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', partnerMemberResult.data.user_id)
            .maybeSingle();
          if (partnerError) throw partnerError;
          if (mounted) setPartner(partnerProfile);
        } else if (mounted) {
          setPartner(null);
        }
      } catch (err) {
        failed = true;
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        // A previous error stays on screen while a retry is in flight, so the
        // retry UI never blanks out; it is cleared only once a fetch succeeds.
        if (mounted) {
          if (!failed) setError(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, refreshKey]);

  return { profile, couple, partnerId, partner, timezone, loading, error, refresh };
}

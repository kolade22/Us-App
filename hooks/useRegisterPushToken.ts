import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export type RegisterPushTokenState = {
  register: (expoToken: string) => Promise<void>;
  registering: boolean;
};

// Registers (or refreshes) the current session user's Expo push token.
// Upsert on (user_id, expo_token): a token that already exists for the user
// updates platform/updated_at instead of erroring, in a single atomic
// INSERT ... ON CONFLICT DO UPDATE — no read-then-write. RLS restricts
// writes to the caller's own rows.
export function useRegisterPushToken(userId: string | null): RegisterPushTokenState {
  const [registering, setRegistering] = useState(false);

  const register = useCallback(
    async (expoToken: string) => {
      if (!userId || !expoToken.trim()) return;
      setRegistering(true);
      try {
        // Expo push tokens exist only on iOS/Android; the DB check constraint
        // enforces ('ios','android') as the real boundary.
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const { error } = await supabase.from('push_tokens').upsert(
          {
            user_id: userId,
            expo_token: expoToken.trim(),
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,expo_token', ignoreDuplicates: false },
        );
        if (error) throw error;
      } finally {
        setRegistering(false);
      }
    },
    [userId],
  );

  return { register, registering };
}

import { createContext, useContext, type ReactNode } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import { useCouple } from '../hooks/useCouple';

export type CoupleContextValue = ReturnType<typeof useCouple> & {
  userId: string | null;
  coupleId: string | null;
  restored: boolean;
};

const CoupleContext = createContext<CoupleContextValue | null>(null);

// One resolution of session -> user -> couple/partner for the whole tree, so
// every screen passes the same coupleId/userId into the real data hooks
// instead of re-fetching useCouple per tab.
export function CoupleProvider({ children }: { children: ReactNode }) {
  const { session, restored } = useAuthSession();
  const userId = session?.user?.id ?? null;
  const coupleData = useCouple(userId);
  const value: CoupleContextValue = {
    ...coupleData,
    userId,
    coupleId: coupleData.couple?.id ?? null,
    restored,
  };
  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCoupleContext(): CoupleContextValue {
  const value = useContext(CoupleContext);
  if (!value) throw new Error('useCoupleContext requires <CoupleProvider>.');
  return value;
}

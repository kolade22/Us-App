import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuidv4 } from '../lib/uuid';
import type { Tables } from '../lib/database.types';

type MessageRow = Tables<'messages'>;

export type ChatMessage = MessageRow & {
  status: 'sending' | 'sent' | 'failed';
};

function rowToMessage(row: MessageRow): ChatMessage {
  return { ...row, status: 'sent' };
}

// Insert-or-replace by client_generated_id (optimistic reconcile) or by id
// (server echo), so a realtime echo never duplicates an optimistic row.
function upsertMessage(list: ChatMessage[], row: MessageRow): ChatMessage[] {
  const idx = list.findIndex(
    (m) => m.client_generated_id === row.client_generated_id || m.id === row.id,
  );
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = rowToMessage(row);
    return copy;
  }
  return [...list, rowToMessage(row)];
}

// The initial snapshot must not clobber rows already in state — a send that
// landed while the fetch was in flight (or a realtime echo) would vanish.
// Union by client_generated_id, then order by time.
function mergeMessages(current: ChatMessage[] | null, fetched: ChatMessage[]): ChatMessage[] {
  if (current === null) return fetched;
  const merged = [...current];
  for (const row of fetched) {
    const idx = merged.findIndex((m) => m.client_generated_id === row.client_generated_id);
    if (idx >= 0) merged[idx] = row;
    else merged.push(row);
  }
  return merged.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

function setMessageStatus(
  list: ChatMessage[],
  clientGeneratedId: string,
  status: ChatMessage['status'],
): ChatMessage[] {
  return list.map((m) =>
    m.client_generated_id === clientGeneratedId ? { ...m, status } : m,
  );
}

export type MessagesState = {
  messages: ChatMessage[] | null;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (clientGeneratedId: string) => Promise<void>;
  markRead: () => Promise<void>;
};

// Couple message stream: initial fetch + Postgres Changes subscription, with
// optimistic sends keyed by a client-generated UUID. The unique constraint
// on client_generated_id makes retries idempotent — a retried send either
// inserts once or resolves to the already-stored row.
export function useMessages(coupleId: string | null, userId: string | null): MessagesState {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    if (!coupleId) {
      setMessages(null);
      return;
    }
    let mounted = true;

    supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      // Newest 200, then flipped to ascending for display — ordering ascending
      // first returned the OLDEST 200, so a busy thread lost its new messages.
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data) {
          // Keep whatever is already on screen; only a first load shows empty.
          setMessages((current) => current ?? []);
          return;
        }
        setMessages((current) => mergeMessages(current, data.map(rowToMessage).reverse()));
      });

    const channel = supabase
      .channel(`messages:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as unknown as MessageRow;
          setMessages((current) =>
            current === null ? current : upsertMessage(current, row),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const insertWithDedup = useCallback(
    async (clientGeneratedId: string, content: string): Promise<MessageRow | null> => {
      if (!coupleId || !userId) return null;
      const { data, error } = await supabase
        .from('messages')
        .insert({
          couple_id: coupleId,
          sender_id: userId,
          client_generated_id: clientGeneratedId,
          content,
        })
        .select()
        .maybeSingle();

      if (error && error.code !== '23505') throw error; // 23505 = already stored (retry race)

      if (data) {
        // Best-effort partner push. Not awaited: a send must not wait on, or
        // fail because of, the notification. The function derives the
        // recipient from the message, so no user id is sent.
        void supabase.functions
          .invoke('send-push-notification', { body: { message_id: data.id } })
          .catch(() => undefined);
        return data;
      }

      // The row already exists (previous attempt succeeded) — fetch it so the
      // optimistic entry reconciles without duplicating.
      const { data: existing } = await supabase
        .from('messages')
        .select('*')
        .eq('client_generated_id', clientGeneratedId)
        .maybeSingle();
      return existing ?? null;
    },
    [coupleId, userId],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!coupleId || !userId || !trimmed) return;

      const clientId = uuidv4();
      setMessages((current) => [
        ...(current ?? []),
        {
          id: `optimistic:${clientId}`,
          couple_id: coupleId,
          sender_id: userId,
          client_generated_id: clientId,
          content: trimmed,
          media_path: null,
          reply_to_id: null,
          read_at: null,
          created_at: new Date().toISOString(),
          status: 'sending',
        },
      ]);

      try {
        const row = await insertWithDedup(clientId, trimmed);
        if (row) {
          setMessages((current) =>
            current === null ? current : upsertMessage(current, row),
          );
        }
      } catch (err) {
        setMessages((current) =>
          current === null ? current : setMessageStatus(current, clientId, 'failed'),
        );
        throw err;
      }
    },
    [coupleId, userId, insertWithDedup],
  );

  const retryMessage = useCallback(
    async (clientGeneratedId: string) => {
      const failed = messages?.find((m) => m.client_generated_id === clientGeneratedId);
      if (!failed?.content) return;

      setMessages((current) =>
        current === null ? current : setMessageStatus(current, clientGeneratedId, 'sending'),
      );

      try {
        const row = await insertWithDedup(clientGeneratedId, failed.content);
        if (row) {
          setMessages((current) =>
            current === null ? current : upsertMessage(current, row),
          );
        }
      } catch (err) {
        setMessages((current) =>
          current === null ? current : setMessageStatus(current, clientGeneratedId, 'failed'),
        );
        throw err;
      }
    },
    [messages, insertWithDedup],
  );

  // Batch read receipt: one UPDATE covering every unread message the partner
  // sent in this couple (sender <> me — a two-member couple). Fired by the
  // screen on focus and once per new incoming batch, never per message.
  const markRead = useCallback(
    async () => {
      if (!coupleId || !userId) return;
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('couple_id', coupleId)
        .neq('sender_id', userId)
        .is('read_at', null);
    },
    [coupleId, userId],
  );

  return { messages, sendMessage, retryMessage, markRead };
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuidv4 } from '../lib/uuid';
import type { Tables } from '../lib/database.types';

type DailyPictureRow = Tables<'daily_pictures'>;

export type ArchiveEntry = DailyPictureRow & { url: string | null };

export type UploadResult =
  | { alreadySubmittedToday: true }
  | { alreadySubmittedToday: false; picture: DailyPictureRow };

export type DailyPictureState = {
  mySubmissionToday: boolean;
  partnerSubmissionToday: boolean;
  archive: ArchiveEntry[] | null;
  uploading: boolean;
  uploadToday: (localImageUri: string) => Promise<UploadResult>;
  refresh: () => void;
  refreshArchive: () => void;
};

// "Calendar day" in the couple's configured timezone (en-CA yields YYYY-MM-DD).
function todayInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(new Date());
  }
}

// Daily Picture: private-bucket upload via a SIGNED upload URL (never a
// public URL), once per partner per calendar day (unique constraint is the
// source of truth), plus a signed-URL archive view. Orphaned storage objects
// are removed if the row insert fails.
export function useDailyPicture(
  coupleId: string | null,
  userId: string | null,
  timezone = 'UTC',
): DailyPictureState {
  const [mySubmissionToday, setMySubmissionToday] = useState(false);
  const [partnerSubmissionToday, setPartnerSubmissionToday] = useState(false);
  const [archive, setArchive] = useState<ArchiveEntry[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [archiveKey, setArchiveKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const refreshArchive = useCallback(() => setArchiveKey((k) => k + 1), []);

  useEffect(() => {
    if (!coupleId) {
      setMySubmissionToday(false);
      setPartnerSubmissionToday(false);
      return;
    }
    let mounted = true;
    const today = todayInTimezone(timezone);

    supabase
      .from('daily_pictures')
      .select('user_id')
      .eq('couple_id', coupleId)
      .eq('submission_date', today)
      .then(({ data }) => {
        if (!mounted) return;
        setMySubmissionToday(data?.some((row) => row.user_id === userId) ?? false);
        setPartnerSubmissionToday(data?.some((row) => row.user_id !== userId) ?? false);
      });

    return () => {
      mounted = false;
    };
  }, [coupleId, userId, timezone, refreshKey]);

  useEffect(() => {
    if (!coupleId) {
      setArchive(null);
      return;
    }
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from('daily_pictures')
        .select('*')
        .eq('couple_id', coupleId)
        .order('submission_date', { ascending: false })
        .limit(60);

      if (!mounted) return;

      const entries = await Promise.all(
        (data ?? []).map(async (row): Promise<ArchiveEntry> => {
          // Short-expiry signed URL, generated on demand — never stored.
          const { data: signed } = await supabase.storage
            .from('couple-media')
            .createSignedUrl(row.image_path, 60);
          return { ...row, url: signed?.signedUrl ?? null };
        }),
      );
      if (mounted) setArchive(entries);
    })();

    return () => {
      mounted = false;
    };
  }, [coupleId, archiveKey]);

  const uploadToday = useCallback(
    async (localImageUri: string): Promise<UploadResult> => {
      if (!coupleId || !userId) throw new Error('Not part of a couple.');
      setUploading(true);
      try {
        const ext = localImageUri.split('.').pop()?.split('?')[0] || 'jpg';
        const path = `${coupleId}/${userId}/${uuidv4()}.${ext}`;
        const today = todayInTimezone(timezone);

        // 1. Signed upload URL (private bucket — no public access).
        const { data: signed, error: signError } = await supabase.storage
          .from('couple-media')
          .createSignedUploadUrl(path);
        if (signError || !signed) throw signError ?? new Error('Failed to create signed upload URL.');

        // 2. Upload the bytes.
        const blob = await (await fetch(localImageUri)).blob();
        const { error: uploadError } = await supabase.storage
          .from('couple-media')
          .uploadToSignedUrl(path, signed.token, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: false,
          });
        if (uploadError) throw uploadError;

        // 3. Record the submission. The set_daily_picture_submission_date
        //    BEFORE INSERT trigger overwrites submission_date server-side
        //    (couple timezone, DB clock), so this value is a display hint
        //    only — the DB is authoritative for once-per-day. The unique
        //    constraint still enforces it under racing taps.
        const { data: row, error: dbError } = await supabase
          .from('daily_pictures')
          .insert({
            couple_id: coupleId,
            user_id: userId,
            image_path: path,
            submission_date: today,
          })
          .select()
          .maybeSingle();

        if (dbError) {
          // Don't orphan the uploaded object.
          await supabase.storage.from('couple-media').remove([path]);
          if (dbError.code === '23505') {
            setMySubmissionToday(true);
            return { alreadySubmittedToday: true };
          }
          throw dbError;
        }

        setMySubmissionToday(true);
        setArchiveKey((k) => k + 1);
        return { alreadySubmittedToday: false, picture: row! };
      } finally {
        setUploading(false);
      }
    },
    [coupleId, userId, timezone],
  );

  return {
    mySubmissionToday,
    partnerSubmissionToday,
    archive,
    uploading,
    uploadToday,
    refresh,
    refreshArchive,
  };
}

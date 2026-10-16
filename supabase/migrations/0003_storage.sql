-- 0003_storage.sql
-- US data layer: private couple-media bucket + storage policies mirroring
-- Postgres RLS. All client access goes through signed URLs / signed upload
-- URLs — the bucket is never public.

-- Private bucket (public = false).
insert into storage.buckets (id, name, public)
values ('couple-media', 'couple-media', false)
on conflict (id) do nothing;

-- Path convention: {couple_id}/{user_id}/{uuid}.{ext}
-- A member of a couple can read/write objects whose first path segment is
-- their couple_id. get_my_couple_id() is SECURITY DEFINER, so these policies
-- do not recurse through storage.objects' own RLS.

create policy couple_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = public.get_my_couple_id()::text
  );

create policy couple_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = public.get_my_couple_id()::text
  );

create policy couple_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = public.get_my_couple_id()::text
  )
  with check (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = public.get_my_couple_id()::text
  );

create policy couple_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = public.get_my_couple_id()::text
  );

-- Popcorn Diary: รันไฟล์นี้ใน Supabase → SQL Editor ครั้งเดียว

-- ตารางบันทึกหนัง / ซีรีส์
create table if not exists public.movies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 300),
  type         text not null default 'movie'  check (type in ('movie', 'series')),
  episode      text,                                   -- ซีซั่น / ตอน (ซีรีส์)
  watch_where  text not null default 'online' check (watch_where in ('online', 'cinema')),
  platform     text,                                   -- Netflix, Viu, ...
  cinema       text,                                   -- ชื่อโรงหนัง / สาขา
  seat         text,                                   -- เลขที่นั่ง
  watched_date date,
  watched_time time,
  rating       smallint not null default 0 check (rating between 0 and 5),
  review       text,
  poster_path  text,                                   -- path ใน storage bucket "posters"
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists movies_user_date_idx on public.movies (user_id, watched_date desc);

-- Row Level Security: แต่ละคนเห็นและแก้ได้เฉพาะของตัวเอง
alter table public.movies enable row level security;

drop policy if exists "own rows select" on public.movies;
drop policy if exists "own rows insert" on public.movies;
drop policy if exists "own rows update" on public.movies;
drop policy if exists "own rows delete" on public.movies;

create policy "own rows select" on public.movies for select to authenticated using (auth.uid() = user_id);
create policy "own rows insert" on public.movies for insert to authenticated with check (auth.uid() = user_id);
create policy "own rows update" on public.movies for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows delete" on public.movies for delete to authenticated using (auth.uid() = user_id);

-- ที่เก็บรูปโปสเตอร์ (private, จำกัด 5 MB, เฉพาะรูปภาพ)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- รูปเก็บที่ posters/<user_id>/<ไฟล์>.jpg และแต่ละคนเข้าถึงได้เฉพาะโฟลเดอร์ตัวเอง
drop policy if exists "posters own select" on storage.objects;
drop policy if exists "posters own insert" on storage.objects;
drop policy if exists "posters own update" on storage.objects;
drop policy if exists "posters own delete" on storage.objects;

create policy "posters own select" on storage.objects for select to authenticated
  using (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posters own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posters own update" on storage.objects for update to authenticated
  using (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posters own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and (storage.foldername(name))[1] = auth.uid()::text);

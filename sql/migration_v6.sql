-- ============================================================
-- FitFinance AI - Migration v6 (Calendrier, notifications, profil/avatar)
-- A executer dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Photo de profil
alter table profiles add column if not exists avatar_url text;

-- Evenements du calendrier (seances, repas, rappels...)
create table if not exists calendar_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  date date not null,
  event_type text default 'autre',  -- entrainement, repas, finance, relation, autre
  notes text,
  created_at timestamptz default now()
);

-- Notifications (journal des changements dans l'app)
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table calendar_events enable row level security;
alter table notifications enable row level security;

drop policy if exists "own calendar_events" on calendar_events;
create policy "own calendar_events" on calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notifications" on notifications;
create policy "own notifications" on notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Stockage des photos de profil (bucket "avatars")
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

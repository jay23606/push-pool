create table if not exists public.pp_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 24),
  rating integer not null default 1000 check (rating between 0 and 5000),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.pp_matches (
  id text primary key,
  room_id uuid not null,
  winner_id uuid not null references public.pp_profiles(id),
  loser_id uuid not null references public.pp_profiles(id),
  winner_before integer not null,
  loser_before integer not null,
  rating_change integer not null,
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);
create table if not exists public.pp_result_reports (
  game_id text not null,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null,
  winner_id uuid not null,
  loser_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (game_id, reporter_id)
);
alter table public.pp_profiles enable row level security;
alter table public.pp_matches enable row level security;
alter table public.pp_result_reports enable row level security;
drop policy if exists "profiles readable" on public.pp_profiles;
create policy "profiles readable" on public.pp_profiles for select using (true);
drop policy if exists "own profile insert" on public.pp_profiles;
drop policy if exists "own profile identity update" on public.pp_profiles;
drop policy if exists "matches readable" on public.pp_matches;
create policy "matches readable" on public.pp_matches for select using (true);
drop policy if exists "own reports readable" on public.pp_result_reports;
create policy "own reports readable" on public.pp_result_reports for select using (auth.uid()=reporter_id);

create or replace function public.pp_upsert_profile(p_username text)
returns public.pp_profiles language plpgsql security definer set search_path=public as $$
declare result public.pp_profiles;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  p_username=left(trim(p_username),24);
  if char_length(p_username)<1 then raise exception 'name required'; end if;
  insert into pp_profiles(id,username,last_seen) values(auth.uid(),p_username,now())
  on conflict(id) do update set username=excluded.username,last_seen=now()
  returning * into result;
  return result;
end $$;

create or replace function public.pp_report_result(p_game_id text,p_room_id uuid,p_winner uuid,p_loser uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare reports int; wr int; lr int; delta int;
begin
  if auth.uid() is null or auth.uid() not in (p_winner,p_loser) or p_winner=p_loser then raise exception 'invalid result'; end if;
  if not exists(select 1 from foyer_room_players where room_id=p_room_id and player_id=auth.uid()) then raise exception 'not a room player'; end if;
  if not exists(select 1 from foyer_room_players where room_id=p_room_id and player_id=p_winner)
     or not exists(select 1 from foyer_room_players where room_id=p_room_id and player_id=p_loser) then raise exception 'players not in room'; end if;
  insert into pp_result_reports(game_id,reporter_id,room_id,winner_id,loser_id) values(p_game_id,auth.uid(),p_room_id,p_winner,p_loser)
    on conflict(game_id,reporter_id) do update set winner_id=excluded.winner_id,loser_id=excluded.loser_id;
  select count(*) into reports from pp_result_reports where game_id=p_game_id and winner_id=p_winner and loser_id=p_loser;
  if reports<2 or exists(select 1 from pp_matches where id=p_game_id) then return false; end if;
  select rating into wr from pp_profiles where id=p_winner for update;select rating into lr from pp_profiles where id=p_loser for update;
  delta=round(32*(1-(1/(1+power(10,(lr-wr)/400.0)))));
  insert into pp_matches values(p_game_id,p_room_id,p_winner,p_loser,wr,lr,delta,now());
  update pp_profiles set rating=rating+delta,wins=wins+1,current_streak=greatest(1,current_streak+1),best_streak=greatest(best_streak,greatest(1,current_streak+1)) where id=p_winner;
  update pp_profiles set rating=greatest(0,rating-delta),losses=losses+1,current_streak=least(-1,current_streak-1) where id=p_loser;
  return true;
end $$;
revoke all on function public.pp_report_result(text,uuid,uuid,uuid) from public;
revoke all on function public.pp_upsert_profile(text) from public;
grant execute on function public.pp_report_result(text,uuid,uuid,uuid) to authenticated;
grant execute on function public.pp_upsert_profile(text) to authenticated;
grant select on public.pp_profiles,public.pp_matches to anon,authenticated;
grant select on public.pp_result_reports to authenticated;
revoke insert,update,delete on public.pp_profiles from anon,authenticated;
revoke insert,update,delete on public.pp_matches from anon,authenticated;
revoke insert,update,delete on public.pp_result_reports from anon,authenticated;

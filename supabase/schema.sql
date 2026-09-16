-- People's Choice Award — Supabase schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0
);

create table if not exists voting_sessions (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Team names stay hidden on /display (shown as "Đội N") until the MC
  -- explicitly reveals them, for a game-show-style results moment.
  revealed boolean not null default false,
  -- While paused, votes are rejected and the countdown is frozen; resuming
  -- shifts ends_at forward by the paused duration so remaining time is kept.
  paused boolean not null default false,
  paused_at timestamptz
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voting_sessions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  voter_token uuid not null,
  created_at timestamptz not null default now(),
  unique (session_id, voter_token, team_id)
);

create index if not exists votes_session_team_idx on votes(session_id, team_id);
create index if not exists votes_session_voter_idx on votes(session_id, voter_token);

-- ---------- Helpers ----------

-- Current number of distinct teams a voter has already voted for in a session.
create or replace function voter_pick_count(p_session_id uuid, p_voter_token uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int from votes
  where session_id = p_session_id and voter_token = p_voter_token;
$$;

-- Live vote counts per team for a session (used by the /display page).
-- A plain view filtered by session_id would drop teams with zero votes in
-- this session (their left-joined session_id is null), so this is an RPC
-- function that joins on the session id directly instead.
create or replace function get_vote_counts(p_session_id uuid)
returns table (
  team_id uuid,
  code text,
  name text,
  sort_order int,
  votes bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id as team_id,
    t.code,
    t.name,
    t.sort_order,
    count(v.id) as votes
  from teams t
  left join votes v on v.team_id = t.id and v.session_id = p_session_id
  group by t.id, t.code, t.name, t.sort_order
  order by t.sort_order;
$$;

grant execute on function get_vote_counts(uuid) to anon, authenticated;

-- ---------- Row Level Security ----------

alter table teams enable row level security;
alter table voting_sessions enable row level security;
alter table votes enable row level security;

-- Anyone (anon) can read teams and sessions.
create policy "teams are publicly readable" on teams
  for select using (true);

create policy "sessions are publicly readable" on voting_sessions
  for select using (true);

-- Only the service role (used by the /api serverless functions) may create/update sessions.
-- No insert/update/delete policy is created for anon, so anon requests are rejected by default.

-- Votes: anon can read (for count aggregation) and insert, but only while the
-- referenced session is open and not yet past its end time. This is enforced
-- here, server-side, so a client can't bypass it by faking its local clock.
create policy "votes are publicly readable" on votes
  for select using (true);

create policy "anon can insert votes while session is open" on votes
  for insert
  with check (
    exists (
      select 1 from voting_sessions s
      where s.id = session_id
        and s.status = 'open'
        and not s.paused
        and now() < s.ends_at
    )
    and voter_pick_count(session_id, voter_token) < 3
  );

-- ---------- Realtime ----------
-- Enable Realtime replication on votes so /display gets live postgres_changes events.
-- In the Supabase dashboard: Database > Replication > enable "votes" table,
-- or run:
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table voting_sessions;
alter publication supabase_realtime add table teams;

-- ---------- Seed the 5 finalist teams ----------
-- Replace with the actual finalist CODE/name once known, e.g.:
-- insert into teams (code, name, sort_order) values
--   ('T01', 'Team Alpha', 1),
--   ('T02', 'Team Beta', 2),
--   ('T03', 'Team Gamma', 3),
--   ('T04', 'Team Delta', 4),
--   ('T05', 'Team Epsilon', 5)
-- on conflict (code) do nothing;

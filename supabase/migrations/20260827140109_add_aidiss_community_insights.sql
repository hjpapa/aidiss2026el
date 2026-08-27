begin;

alter table public.aidiss_sessions
  drop constraint if exists aidiss_sessions_learner_pet_check,
  drop constraint if exists aidiss_sessions_opponent_pet_check;

alter table public.aidiss_sessions
  add constraint aidiss_sessions_learner_pet_check
    check (learner_pet_id in ('lumi', 'toto', 'pori', 'momo', 'hari', 'duri')),
  add constraint aidiss_sessions_opponent_pet_check
    check (opponent_pet_id in ('lumi', 'toto', 'pori', 'momo', 'hari', 'duri'));

alter table public.aidiss_reflections
  add column if not exists share_with_community boolean not null default false;

comment on column public.aidiss_reflections.share_with_community is
  'Learner opt-in for anonymously featuring final_json.myThinking in community insights. Defaults to false.';

create index if not exists aidiss_sessions_completed_pet_idx
  on public.aidiss_sessions (expires_at, learner_pet_id)
  where status = 'completed';

create index if not exists aidiss_reflections_shared_completed_idx
  on public.aidiss_reflections (completed_at desc)
  where status = 'completed' and share_with_community;

create or replace function public.aidiss_community_pet_counts()
returns table (pet_id text, debate_count bigint)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select sessions.learner_pet_id, count(*)::bigint
  from public.aidiss_sessions as sessions
  where sessions.status = 'completed'
    and sessions.expires_at > now()
  group by sessions.learner_pet_id;
$$;

revoke all on function public.aidiss_community_pet_counts()
  from public, anon, authenticated;
grant execute on function public.aidiss_community_pet_counts()
  to service_role;

revoke all on table public.aidiss_sessions from anon, authenticated;
revoke all on table public.aidiss_reflections from anon, authenticated;
grant all on table public.aidiss_sessions to service_role;
grant all on table public.aidiss_reflections to service_role;

alter table public.aidiss_sessions enable row level security;
alter table public.aidiss_reflections enable row level security;

comment on index public.aidiss_sessions_completed_pet_idx is
  'Supports anonymous completed-debate pet ratios within the existing retention window.';
comment on index public.aidiss_reflections_shared_completed_idx is
  'Supports server-only selection of separately consented completed reflections.';

commit;

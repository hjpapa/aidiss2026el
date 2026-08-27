begin;

create function public.aidiss_complete_reflection_with_consent(
  p_session_id uuid,
  p_review_id uuid,
  p_request_id uuid,
  p_final_fingerprint text,
  p_draft jsonb,
  p_final jsonb,
  p_share_with_community boolean
)
returns table (stored boolean, replayed boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_reflection public.aidiss_reflections%rowtype;
  v_reviewed_state_version integer;
  v_current_state_version integer;
  v_changed boolean;
begin
  if p_final_fingerprint !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_draft) <> 'object'
     or jsonb_typeof(p_final) <> 'object'
     or p_share_with_community is null then
    raise exception 'invalid final reflection';
  end if;

  select sessions.state_version into v_current_state_version
  from public.aidiss_sessions as sessions
  where sessions.id = p_session_id and sessions.expires_at > clock_timestamp()
  for update;
  if not found then
    return query select false, false;
    return;
  end if;

  select reflections.* into v_reflection
  from public.aidiss_reflections as reflections
  where reflections.session_id = p_session_id
  for update;
  if not found then
    return query select false, false;
    return;
  end if;

  if v_reflection.status = 'completed' then
    if v_reflection.final_request_id = p_request_id
       and v_reflection.final_fingerprint = p_final_fingerprint
       and v_reflection.share_with_community = p_share_with_community then
      return query select true, true;
      return;
    end if;
    return query select false, false;
    return;
  end if;
  if p_review_id is null or v_reflection.review_id <> p_review_id then
    return query select false, false;
    return;
  end if;

  select reviews.reviewed_state_version into v_reviewed_state_version
  from public.aidiss_reviews as reviews
  where reviews.id = p_review_id and reviews.session_id = p_session_id;
  if not found or v_reviewed_state_version <> v_current_state_version then
    return query select false, false;
    return;
  end if;
  if v_reflection.draft_json <> p_draft then
    return query select false, false;
    return;
  end if;

  v_changed := v_reflection.draft_json <> p_final;
  update public.aidiss_reflections as reflections
  set final_request_id = p_request_id,
      final_fingerprint = p_final_fingerprint,
      final_stance = p_final ->> 'stance',
      final_json = p_final,
      revision_action = case when v_changed then 'learner_revised' else 'kept_draft' end,
      share_with_community = p_share_with_community,
      status = 'completed',
      updated_at = clock_timestamp(),
      completed_at = clock_timestamp()
  where reflections.id = v_reflection.id;

  update public.aidiss_sessions as sessions
  set status = 'completed', updated_at = clock_timestamp(), completed_at = clock_timestamp()
  where sessions.id = p_session_id;

  return query select true, false;
end;
$$;

create function public.aidiss_community_thought_candidates(p_limit integer default 40)
returns table (
  session_id uuid,
  pet_id text,
  topic_id text,
  my_thinking text
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select sessions.id,
         sessions.learner_pet_id,
         sessions.topic_id,
         reflections.final_json ->> 'myThinking'
  from public.aidiss_reflections as reflections
  join public.aidiss_sessions as sessions on sessions.id = reflections.session_id
  where reflections.status = 'completed'
    and reflections.share_with_community
    and reflections.completed_at <= now() - interval '24 hours'
    and sessions.status = 'completed'
    and sessions.expires_at > now()
    and length(btrim(reflections.final_json ->> 'myThinking')) between 24 and 1200
  order by reflections.completed_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 40);
$$;

revoke all on function public.aidiss_complete_reflection_with_consent(
  uuid, uuid, uuid, text, jsonb, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.aidiss_complete_reflection_with_consent(
  uuid, uuid, uuid, text, jsonb, jsonb, boolean
) to service_role;

revoke all on function public.aidiss_community_thought_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.aidiss_community_thought_candidates(integer)
  to service_role;

revoke all on table public.aidiss_sessions, public.aidiss_reflections from service_role;
grant select, insert, update, delete
  on table public.aidiss_sessions, public.aidiss_reflections
  to service_role;

commit;

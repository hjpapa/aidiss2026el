begin;

create table public.aidiss_sessions (
  id uuid primary key default gen_random_uuid(),
  capability_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '29 days'),
  completed_at timestamptz,
  grade_band text not null,
  learner_pet_id text not null,
  opponent_pet_id text not null,
  topic_id text not null,
  initial_stance text not null,
  status text not null default 'active',
  debate_summary text not null default '',
  debate_state jsonb not null default '{}'::jsonb,
  last_sequence integer not null default 0,
  state_version integer not null default 0,
  prompt_version text not null,
  app_version text not null,
  constraint aidiss_sessions_token_hash_check
    check (capability_token_hash ~ '^[a-f0-9]{64}$'),
  constraint aidiss_sessions_grade_band_check
    check (grade_band in ('g34', 'g56')),
  constraint aidiss_sessions_learner_pet_check
    check (learner_pet_id in ('lumi', 'toto', 'pori', 'momo')),
  constraint aidiss_sessions_opponent_pet_check
    check (opponent_pet_id in ('lumi', 'toto', 'pori', 'momo')),
  constraint aidiss_sessions_distinct_pets_check
    check (learner_pet_id <> opponent_pet_id),
  constraint aidiss_sessions_topic_check
    check (topic_id in (
      'ai-answer-trust', 'ai-opinion', 'ai-grading', 'face-synthesis',
      'recommendation', 'face-attendance', 'location-tracking', 'paid-ai-fairness'
    )),
  constraint aidiss_sessions_initial_stance_check
    check (initial_stance in ('a', 'b')),
  constraint aidiss_sessions_status_check
    check (status in ('active', 'ready', 'reflecting', 'completed')),
  constraint aidiss_sessions_summary_length_check
    check (length(debate_summary) <= 1500),
  constraint aidiss_sessions_state_type_check
    check (jsonb_typeof(debate_state) = 'object'),
  constraint aidiss_sessions_sequence_check
    check (last_sequence >= 0 and state_version >= 0),
  constraint aidiss_sessions_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '29 days'),
  constraint aidiss_sessions_completed_check
    check ((status = 'completed') = (completed_at is not null))
);

comment on table public.aidiss_sessions is
  'Anonymous AI ethics pet-debate sessions. Separate from teacher_context_submissions.';

create index aidiss_sessions_expires_at_idx
  on public.aidiss_sessions (expires_at);

create table public.aidiss_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aidiss_sessions(id) on delete cascade,
  request_id uuid not null,
  sequence_no integer not null,
  role text not null,
  kind text not null,
  content text not null,
  reply_to_message_id uuid,
  readiness_tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint aidiss_messages_sequence_check check (sequence_no > 0),
  constraint aidiss_messages_role_check
    check (role in ('learner', 'opponent_pet', 'ally_pet', 'system')),
  constraint aidiss_messages_kind_check
    check (kind in ('move', 'guidance', 'safety')),
  constraint aidiss_messages_content_check
    check (length(btrim(content)) between 1 and 8000),
  constraint aidiss_messages_valid_move_check
    check (kind <> 'move' or role in ('learner', 'opponent_pet')),
  constraint aidiss_messages_readiness_tags_check
    check (
      cardinality(readiness_tags) <= 5
      and readiness_tags <@ array[
        'technical_mechanism', 'benefit_and_risk', 'other_stakeholder',
        'counterargument_response', 'stance_with_reason'
      ]::text[]
      and (cardinality(readiness_tags) = 0 or (role = 'learner' and kind = 'move'))
    ),
  constraint aidiss_messages_id_session_key unique (id, session_id),
  constraint aidiss_messages_reply_session_fkey
    foreign key (reply_to_message_id, session_id)
    references public.aidiss_messages(id, session_id),
  constraint aidiss_messages_session_sequence_key unique (session_id, sequence_no),
  constraint aidiss_messages_session_request_role_key unique (session_id, request_id, role)
);

create index aidiss_messages_reply_session_idx
  on public.aidiss_messages (reply_to_message_id, session_id)
  where reply_to_message_id is not null;

create table public.aidiss_ai_generations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aidiss_sessions(id) on delete cascade,
  request_id uuid not null,
  purpose text not null,
  request_fingerprint text not null,
  status text not null default 'processing',
  claim_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 1,
  model_name text,
  openai_response_id text,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  error_code text,
  source_state_version integer,
  result_state_version integer,
  result_state jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint aidiss_ai_generations_fingerprint_check
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint aidiss_ai_generations_purpose_check
    check (purpose in ('chat', 'review', 'input_moderation', 'output_moderation')),
  constraint aidiss_ai_generations_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint aidiss_ai_generations_claim_lifecycle_check
    check (
      (
        status = 'processing' and claim_token is not null and
        lease_expires_at is not null and completed_at is null
      )
      or
      (
        status in ('completed', 'failed') and claim_token is null and
        lease_expires_at is null and completed_at is not null
      )
    ),
  constraint aidiss_ai_generations_attempt_check check (attempt_count > 0),
  constraint aidiss_ai_generations_tokens_check
    check (
      coalesce(input_tokens, 0) >= 0 and
      coalesce(output_tokens, 0) >= 0 and
      coalesce(latency_ms, 0) >= 0
    ),
  constraint aidiss_ai_generations_state_version_check
    check (
      (source_state_version is null or source_state_version >= 0)
      and (result_state_version is null or result_state_version >= 0)
      and (result_state is null or jsonb_typeof(result_state) = 'object')
    ),
  constraint aidiss_ai_generations_session_request_purpose_key
    unique (session_id, request_id, purpose),
  constraint aidiss_ai_generations_id_session_key unique (id, session_id)
);

create index aidiss_ai_generations_session_created_idx
  on public.aidiss_ai_generations (session_id, created_at desc);

create index aidiss_ai_generations_processing_lease_idx
  on public.aidiss_ai_generations (lease_expires_at)
  where status = 'processing';

create unique index aidiss_ai_generations_live_state_idx
  on public.aidiss_ai_generations (session_id, source_state_version)
  where status = 'processing' and source_state_version is not null;

create table public.aidiss_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aidiss_sessions(id) on delete cascade,
  generation_id uuid not null,
  request_id uuid not null,
  review_json jsonb not null,
  evidence_json jsonb not null,
  readiness_snapshot jsonb not null,
  reviewed_state_version integer not null,
  created_at timestamptz not null default now(),
  constraint aidiss_reviews_generation_session_fkey
    foreign key (generation_id, session_id)
    references public.aidiss_ai_generations(id, session_id) on delete cascade,
  constraint aidiss_reviews_review_type_check
    check (jsonb_typeof(review_json) = 'object'),
  constraint aidiss_reviews_evidence_type_check
    check (jsonb_typeof(evidence_json) = 'array'),
  constraint aidiss_reviews_readiness_type_check
    check (jsonb_typeof(readiness_snapshot) = 'array'),
  constraint aidiss_reviews_state_version_check check (reviewed_state_version >= 0),
  constraint aidiss_reviews_json_size_check
    check (
      octet_length(review_json::text) <= 50000 and
      octet_length(evidence_json::text) <= 30000 and
      octet_length(readiness_snapshot::text) <= 20000
    ),
  constraint aidiss_reviews_session_request_key unique (session_id, request_id),
  constraint aidiss_reviews_generation_key unique (generation_id),
  constraint aidiss_reviews_id_session_key unique (id, session_id)
);

create index aidiss_reviews_session_created_idx
  on public.aidiss_reviews (session_id, created_at desc);

create table public.aidiss_reflections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.aidiss_sessions(id) on delete cascade,
  review_id uuid,
  draft_request_id uuid not null,
  draft_fingerprint text not null,
  final_request_id uuid,
  final_fingerprint text,
  draft_stance text not null,
  draft_json jsonb not null,
  final_stance text,
  final_json jsonb,
  revision_action text,
  status text not null default 'drafted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint aidiss_reflections_review_session_fkey
    foreign key (review_id, session_id)
    references public.aidiss_reviews(id, session_id) on delete cascade,
  constraint aidiss_reflections_draft_stance_check
    check (draft_stance in ('agree', 'conditional', 'disagree')),
  constraint aidiss_reflections_fingerprint_check
    check (
      draft_fingerprint ~ '^[a-f0-9]{64}$'
      and (final_fingerprint is null or final_fingerprint ~ '^[a-f0-9]{64}$')
    ),
  constraint aidiss_reflections_final_stance_check
    check (final_stance is null or final_stance in ('agree', 'conditional', 'disagree')),
  constraint aidiss_reflections_json_type_check
    check (
      jsonb_typeof(draft_json) = 'object' and
      (final_json is null or jsonb_typeof(final_json) = 'object')
    ),
  constraint aidiss_reflections_json_size_check
    check (
      octet_length(draft_json::text) <= 12000 and
      (final_json is null or octet_length(final_json::text) <= 12000)
    ),
  constraint aidiss_reflections_revision_action_check
    check (revision_action is null or revision_action in ('kept_draft', 'learner_revised')),
  constraint aidiss_reflections_status_check
    check (status in ('drafted', 'completed')),
  constraint aidiss_reflections_completion_check
    check (
      (status = 'drafted' and final_request_id is null and final_fingerprint is null and final_stance is null and final_json is null and completed_at is null)
      or
      (status = 'completed' and review_id is not null and final_request_id is not null and final_fingerprint is not null and final_stance is not null and final_json is not null and revision_action is not null and completed_at is not null)
    )
);

create index aidiss_reflections_review_session_idx
  on public.aidiss_reflections (review_id, session_id)
  where review_id is not null;

create table public.aidiss_rate_limit_buckets (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (scope, key_hash, window_start),
  constraint aidiss_rate_limit_scope_check check (scope in ('ip', 'session')),
  constraint aidiss_rate_limit_key_hash_check check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint aidiss_rate_limit_count_check check (request_count > 0),
  constraint aidiss_rate_limit_expiry_check check (expires_at > window_start)
);

create index aidiss_rate_limit_expires_at_idx
  on public.aidiss_rate_limit_buckets (expires_at);

alter table public.aidiss_sessions enable row level security;
alter table public.aidiss_messages enable row level security;
alter table public.aidiss_ai_generations enable row level security;
alter table public.aidiss_reviews enable row level security;
alter table public.aidiss_reflections enable row level security;
alter table public.aidiss_rate_limit_buckets enable row level security;

revoke all on table
  public.aidiss_sessions,
  public.aidiss_messages,
  public.aidiss_ai_generations,
  public.aidiss_reviews,
  public.aidiss_reflections,
  public.aidiss_rate_limit_buckets
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.aidiss_sessions,
  public.aidiss_messages,
  public.aidiss_ai_generations,
  public.aidiss_reviews,
  public.aidiss_reflections,
  public.aidiss_rate_limit_buckets
to service_role;

create function public.aidiss_claim_generation(
  p_session_id uuid,
  p_request_id uuid,
  p_purpose text,
  p_expected_state_version integer,
  p_fingerprint text,
  p_model_name text,
  p_prompt_version text
)
returns table (disposition text, claim_token uuid)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_generation public.aidiss_ai_generations%rowtype;
  v_current_state_version integer;
  v_session_status text;
  v_claim_token uuid;
begin
  if p_purpose not in ('chat', 'review')
     or p_expected_state_version is null
     or p_expected_state_version < 0
     or p_fingerprint !~ '^[a-f0-9]{64}$'
     or nullif(btrim(p_model_name), '') is null
     or nullif(btrim(p_prompt_version), '') is null then
    raise exception 'invalid generation claim';
  end if;

  select sessions.state_version, sessions.status
  into v_current_state_version, v_session_status
  from public.aidiss_sessions as sessions
  where sessions.id = p_session_id and sessions.expires_at > clock_timestamp()
  for update;
  if not found
     or v_session_status = 'completed'
     or v_current_state_version <> p_expected_state_version then
    return query select 'state_conflict'::text, null::uuid;
    return;
  end if;

  -- A crashed request must not hold the per-state reservation forever.
  update public.aidiss_ai_generations as generations
  set status = 'failed',
      claim_token = null,
      lease_expires_at = null,
      error_code = 'lease_expired',
      completed_at = clock_timestamp()
  where generations.session_id = p_session_id
    and generations.source_state_version = p_expected_state_version
    and generations.status = 'processing'
    and generations.lease_expires_at <= clock_timestamp();

  select generations.* into v_generation
  from public.aidiss_ai_generations as generations
  where generations.session_id = p_session_id
    and generations.request_id = p_request_id
    and generations.purpose = p_purpose
  for update;

  if found and v_generation.request_fingerprint <> p_fingerprint then
    return query select 'conflict'::text, null::uuid;
    return;
  elsif found and v_generation.status = 'completed' then
    return query select 'completed'::text, null::uuid;
    return;
  elsif found and v_generation.status = 'processing'
        and v_generation.lease_expires_at > clock_timestamp() then
    return query select 'in_progress'::text, null::uuid;
    return;
  elsif found then
    v_claim_token := gen_random_uuid();
    begin
      update public.aidiss_ai_generations as generations
      set status = 'processing',
          claim_token = v_claim_token,
          lease_expires_at = clock_timestamp() + interval '90 seconds',
          attempt_count = generations.attempt_count + 1,
          source_state_version = p_expected_state_version,
          result_state_version = null,
          result_state = null,
          model_name = p_model_name,
          prompt_version = p_prompt_version,
          error_code = null,
          completed_at = null
      where generations.id = v_generation.id;
    exception when unique_violation then
      return query select 'in_progress'::text, null::uuid;
      return;
    end;
    return query select 'claimed'::text, v_claim_token;
    return;
  else
    v_claim_token := gen_random_uuid();
    begin
      insert into public.aidiss_ai_generations (
        session_id, request_id, purpose, request_fingerprint, status,
        claim_token, lease_expires_at, model_name, prompt_version, source_state_version
      ) values (
        p_session_id, p_request_id, p_purpose, p_fingerprint, 'processing',
        v_claim_token, clock_timestamp() + interval '90 seconds', p_model_name,
        p_prompt_version, p_expected_state_version
      );
    exception when unique_violation then
      return query select 'in_progress'::text, null::uuid;
      return;
    end;
    return query select 'claimed'::text, v_claim_token;
    return;
  end if;
end;
$$;

create function public.aidiss_persist_chat_turn(
  p_session_id uuid,
  p_request_id uuid,
  p_expected_state_version integer,
  p_messages jsonb,
  p_state jsonb,
  p_summary text,
  p_status text,
  p_generation jsonb,
  p_claim_token uuid
)
returns table (stored boolean, next_state_version integer, replayed boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_last_sequence integer;
  v_state_version integer;
  v_message_count integer;
begin
  if p_expected_state_version is null or p_expected_state_version < 0
     or p_claim_token is null
     or jsonb_typeof(p_messages) <> 'array'
     or jsonb_typeof(p_state) <> 'object'
     or coalesce(jsonb_typeof(p_state -> 'readiness'), '') <> 'array'
     or jsonb_typeof(p_generation) <> 'object'
     or p_status not in ('active', 'ready')
     or length(p_summary) > 1500 then
    raise exception 'invalid chat turn';
  end if;
  v_message_count := jsonb_array_length(p_messages);
  if v_message_count < 1 or v_message_count > 3 then
    raise exception 'invalid message count';
  end if;

  select sessions.last_sequence, sessions.state_version
  into v_last_sequence, v_state_version
  from public.aidiss_sessions as sessions
  where sessions.id = p_session_id
    and sessions.expires_at > clock_timestamp()
  for update;

  if not found then
    return query select false, p_expected_state_version, false;
    return;
  end if;

  if exists (
    select 1 from public.aidiss_messages as messages
    where messages.session_id = p_session_id and messages.request_id = p_request_id
  ) then
    if not exists (
      select 1 from public.aidiss_ai_generations as generations
      where generations.session_id = p_session_id
        and generations.request_id = p_request_id
        and generations.purpose = 'chat'
        and generations.status = 'completed'
        and generations.request_fingerprint = p_generation ->> 'fingerprint'
        and generations.result_state_version is not null
        and generations.result_state is not null
    ) then
      raise exception 'stored chat fingerprint mismatch';
    end if;
    return query select true, v_state_version, true;
    return;
  end if;

  if v_state_version <> p_expected_state_version then
    return query select false, v_state_version, false;
    return;
  end if;

  insert into public.aidiss_messages (
    id, session_id, request_id, sequence_no, role, kind, content,
    reply_to_message_id, readiness_tags, created_at
  )
  select
    (entry.item ->> 'id')::uuid,
    p_session_id,
    p_request_id,
    v_last_sequence + entry.ordinality::integer,
    entry.item ->> 'role',
    entry.item ->> 'kind',
    entry.item ->> 'content',
    nullif(entry.item ->> 'replyToMessageId', '')::uuid,
    coalesce(
      array(select jsonb_array_elements_text(coalesce(entry.item -> 'readinessTags', '[]'::jsonb))),
      '{}'::text[]
    ),
    (entry.item ->> 'createdAt')::timestamptz
  from jsonb_array_elements(p_messages) with ordinality as entry(item, ordinality);

  update public.aidiss_messages as messages
  set readiness_tags = array(
    select criterion.item ->> 'id'
    from jsonb_array_elements(p_state -> 'readiness') as criterion(item)
    where exists (
      select 1
      from jsonb_array_elements(coalesce(criterion.item -> 'evidence', '[]'::jsonb)) as evidence(item)
      where evidence.item ->> 'messageId' = messages.id::text
    )
  )
  where messages.session_id = p_session_id
    and messages.role = 'learner'
    and messages.kind = 'move';

  update public.aidiss_ai_generations as generations
  set status = coalesce(p_generation ->> 'status', 'completed'),
      claim_token = null,
      lease_expires_at = null,
      model_name = nullif(p_generation ->> 'modelName', ''),
      openai_response_id = nullif(p_generation ->> 'responseId', ''),
      input_tokens = nullif(p_generation ->> 'inputTokens', '')::integer,
      output_tokens = nullif(p_generation ->> 'outputTokens', '')::integer,
      latency_ms = nullif(p_generation ->> 'latencyMs', '')::integer,
      error_code = nullif(p_generation ->> 'errorCode', ''),
      result_state_version = v_state_version + 1,
      result_state = p_state,
      completed_at = clock_timestamp()
  where generations.session_id = p_session_id
    and generations.request_id = p_request_id
    and generations.purpose = 'chat'
    and generations.status = 'processing'
    and generations.claim_token = p_claim_token
    and generations.source_state_version = v_state_version
    and generations.request_fingerprint = p_generation ->> 'fingerprint';
  if not found then
    raise exception 'generation claim missing or fingerprint mismatch';
  end if;

  update public.aidiss_sessions as sessions
  set updated_at = clock_timestamp(),
      debate_summary = p_summary,
      debate_state = p_state,
      last_sequence = v_last_sequence + v_message_count,
      state_version = v_state_version + 1,
      status = p_status
  where sessions.id = p_session_id;

  return query select true, v_state_version + 1, false;
end;
$$;

create function public.aidiss_persist_review(
  p_session_id uuid,
  p_request_id uuid,
  p_expected_state_version integer,
  p_fingerprint text,
  p_review jsonb,
  p_evidence jsonb,
  p_readiness jsonb,
  p_draft jsonb,
  p_generation jsonb,
  p_claim_token uuid
)
returns table (stored boolean, review_id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_state_version integer;
  v_session_status text;
  v_generation_id uuid;
  v_review_id uuid;
begin
  if p_expected_state_version is null or p_expected_state_version < 0
     or p_claim_token is null
     or p_fingerprint !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_review) <> 'object'
     or jsonb_typeof(p_evidence) <> 'array'
     or jsonb_typeof(p_readiness) <> 'array'
     or jsonb_typeof(p_draft) <> 'object'
     or jsonb_typeof(p_generation) <> 'object' then
    raise exception 'invalid review';
  end if;

  select sessions.state_version, sessions.status
  into v_state_version, v_session_status
  from public.aidiss_sessions as sessions
  where sessions.id = p_session_id and sessions.expires_at > clock_timestamp()
  for update;
  if not found or v_session_status = 'completed' or v_state_version <> p_expected_state_version then
    return query select false, null::uuid, false;
    return;
  end if;

  select reviews.id into v_review_id
  from public.aidiss_reviews as reviews
  join public.aidiss_ai_generations as generations on generations.id = reviews.generation_id
  where reviews.session_id = p_session_id and reviews.request_id = p_request_id;
  if found then
    if not exists (
      select 1 from public.aidiss_ai_generations as generations
      where generations.id = (
        select reviews.generation_id from public.aidiss_reviews as reviews where reviews.id = v_review_id
      ) and generations.request_fingerprint = p_fingerprint
    ) then
      raise exception 'request fingerprint mismatch';
    end if;
    return query select true, v_review_id, true;
    return;
  end if;

  update public.aidiss_ai_generations as generations
  set status = 'completed',
      claim_token = null,
      lease_expires_at = null,
      model_name = nullif(p_generation ->> 'modelName', ''),
      openai_response_id = nullif(p_generation ->> 'responseId', ''),
      input_tokens = nullif(p_generation ->> 'inputTokens', '')::integer,
      output_tokens = nullif(p_generation ->> 'outputTokens', '')::integer,
      latency_ms = nullif(p_generation ->> 'latencyMs', '')::integer,
      error_code = null,
      completed_at = clock_timestamp()
  where generations.session_id = p_session_id
    and generations.request_id = p_request_id
    and generations.purpose = 'review'
    and generations.status = 'processing'
    and generations.claim_token = p_claim_token
    and generations.source_state_version = p_expected_state_version
    and generations.request_fingerprint = p_fingerprint
  returning generations.id into v_generation_id;
  if not found then
    raise exception 'generation claim missing or fingerprint mismatch';
  end if;

  insert into public.aidiss_reviews (
    session_id, generation_id, request_id, review_json, evidence_json,
    readiness_snapshot, reviewed_state_version
  ) values (
    p_session_id, v_generation_id, p_request_id, p_review, p_evidence,
    p_readiness, p_expected_state_version
  ) returning id into v_review_id;

  insert into public.aidiss_reflections (
    session_id, review_id, draft_request_id, draft_fingerprint,
    draft_stance, draft_json, status, updated_at
  ) values (
    p_session_id, v_review_id, p_request_id, p_fingerprint,
    p_draft ->> 'stance', p_draft, 'drafted', clock_timestamp()
  )
  on conflict (session_id) do update
  set review_id = excluded.review_id,
      draft_request_id = excluded.draft_request_id,
      draft_fingerprint = excluded.draft_fingerprint,
      draft_stance = excluded.draft_stance,
      draft_json = excluded.draft_json,
      final_request_id = null,
      final_fingerprint = null,
      final_stance = null,
      final_json = null,
      revision_action = null,
      status = 'drafted',
      updated_at = clock_timestamp(),
      completed_at = null
  where public.aidiss_reflections.status = 'drafted';
  if not found then
    raise exception 'completed reflection cannot be replaced';
  end if;

  update public.aidiss_sessions as sessions
  set status = 'reflecting', updated_at = clock_timestamp()
  where sessions.id = p_session_id;

  return query select true, v_review_id, false;
end;
$$;

create function public.aidiss_complete_reflection(
  p_session_id uuid,
  p_review_id uuid,
  p_request_id uuid,
  p_final_fingerprint text,
  p_draft jsonb,
  p_final jsonb
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
     or jsonb_typeof(p_final) <> 'object' then
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
       and v_reflection.final_fingerprint = p_final_fingerprint then
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

create function public.aidiss_consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer
)
returns table (allowed boolean, request_count integer, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_window_start timestamptz := date_trunc('minute', clock_timestamp());
  v_count integer;
begin
  if p_scope is null
     or p_key_hash is null
     or p_limit is null
     or p_scope not in ('ip', 'session')
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1
     or p_limit > 1000 then
    raise exception 'invalid rate limit parameters';
  end if;

  insert into public.aidiss_rate_limit_buckets (
    scope, key_hash, window_start, request_count, expires_at
  ) values (
    p_scope, p_key_hash, v_window_start, 1, v_window_start + interval '10 minutes'
  )
  on conflict (scope, key_hash, window_start)
  do update set request_count = least(public.aidiss_rate_limit_buckets.request_count + 1, p_limit + 1)
  returning public.aidiss_rate_limit_buckets.request_count into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    greatest(1, extract(epoch from (v_window_start + interval '1 minute' - clock_timestamp()))::integer);
end;
$$;

create function public.aidiss_purge_expired(p_batch_size integer default 500)
returns table (deleted_sessions integer, deleted_buckets integer)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_sessions integer := 0;
  v_buckets integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 2000 then
    raise exception 'batch size must be between 1 and 2000';
  end if;

  with doomed as (
    select id
    from public.aidiss_sessions
    where expires_at <= clock_timestamp()
    order by expires_at
    for update skip locked
    limit p_batch_size
  )
  delete from public.aidiss_sessions as sessions
  using doomed
  where sessions.id = doomed.id;
  get diagnostics v_sessions = row_count;

  with doomed as (
    select scope, key_hash, window_start
    from public.aidiss_rate_limit_buckets
    where expires_at <= clock_timestamp()
    order by expires_at
    for update skip locked
    limit p_batch_size
  )
  delete from public.aidiss_rate_limit_buckets as buckets
  using doomed
  where buckets.scope = doomed.scope
    and buckets.key_hash = doomed.key_hash
    and buckets.window_start = doomed.window_start;
  get diagnostics v_buckets = row_count;

  return query select v_sessions, v_buckets;
end;
$$;

revoke all on function public.aidiss_consume_rate_limit(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.aidiss_consume_rate_limit(text, text, integer)
  to service_role;

revoke all on function public.aidiss_purge_expired(integer)
  from public, anon, authenticated;
grant execute on function public.aidiss_purge_expired(integer)
  to service_role;

revoke all on function public.aidiss_claim_generation(uuid, uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.aidiss_claim_generation(uuid, uuid, text, integer, text, text, text)
  to service_role;

revoke all on function public.aidiss_persist_chat_turn(uuid, uuid, integer, jsonb, jsonb, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.aidiss_persist_chat_turn(uuid, uuid, integer, jsonb, jsonb, text, text, jsonb, uuid)
  to service_role;

revoke all on function public.aidiss_persist_review(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.aidiss_persist_review(uuid, uuid, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, uuid)
  to service_role;

revoke all on function public.aidiss_complete_reflection(uuid, uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.aidiss_complete_reflection(uuid, uuid, uuid, text, jsonb, jsonb)
  to service_role;

commit;

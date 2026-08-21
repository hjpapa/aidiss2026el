begin;

do $$
declare
  v_session uuid := '1f6167ca-4dca-4a20-8df5-3dbf9cf0bd31';
  v_chat_request uuid := '2eb45df4-4fee-4fa0-981a-3b12a57a77d1';
  v_blocked_request uuid := '35b77110-7647-46db-bc57-2e4ff27e8788';
  v_review_request uuid := '474c9c3f-85dc-47bd-8d64-97d9a02a5279';
  v_final_request uuid := '5b50bd3e-928e-49d8-b8fd-dbdc9a49a04b';
  v_learner uuid := '62ce73fc-63e7-49b5-8750-118a8a9f0106';
  v_pet uuid := '7483e96f-79b5-4d45-a178-b473e0e6b67f';
  v_disposition text;
  v_stale_token uuid;
  v_live_token uuid;
  v_review_token uuid;
  v_stored boolean;
  v_next integer;
  v_replayed boolean;
  v_review_id uuid;
  v_state jsonb := '{
    "summary":"migration invariant test",
    "keyClaims":[],
    "technicalIdeas":[],
    "benefits":[],
    "risks":[],
    "stakeholderViews":[],
    "currentPosition":"",
    "readiness":[{
      "id":"technical_mechanism",
      "completed":true,
      "evidence":[{
        "messageId":"62ce73fc-63e7-49b5-8750-118a8a9f0106",
        "quote":"데이터"
      }]
    }]
  }'::jsonb;
  v_draft jsonb := '{
    "stance":"agree",
    "myThinking":"AI 답을 다른 자료와 함께 확인합니다.",
    "hardestCounterpoint":"빠르게 답을 얻을 수 있다는 점입니다.",
    "technicalUnderstanding":"데이터의 규칙으로 다음 낱말을 예상합니다."
  }'::jsonb;
  v_final jsonb := '{
    "stance":"conditional",
    "myThinking":"AI 답을 참고하되 다른 자료와 함께 확인합니다.",
    "hardestCounterpoint":"빠르게 답을 얻을 수 있다는 점입니다.",
    "technicalUnderstanding":"데이터의 규칙으로 다음 낱말을 예상합니다."
  }'::jsonb;
begin
  insert into public.aidiss_sessions (
    id, capability_token_hash, expires_at, grade_band, learner_pet_id,
    opponent_pet_id, topic_id, initial_stance, debate_state,
    prompt_version, app_version
  ) values (
    v_session, repeat('d', 64), clock_timestamp() + interval '1 day',
    'g34', 'lumi', 'toto', 'ai-answer-trust', 'a', v_state,
    'migration-test-chat', 'migration-test'
  );

  select claim.disposition, claim.claim_token
  into v_disposition, v_stale_token
  from public.aidiss_claim_generation(
    v_session, v_chat_request, 'chat', 0, repeat('a', 64),
    'migration-test-model', 'migration-test-chat'
  ) as claim;
  if v_disposition <> 'claimed' or v_stale_token is null then
    raise exception 'initial claim invariant failed';
  end if;

  select claim.disposition
  into v_disposition
  from public.aidiss_claim_generation(
    v_session, v_blocked_request, 'review', 0, repeat('b', 64),
    'migration-test-model', 'migration-test-review'
  ) as claim;
  if v_disposition <> 'in_progress' then
    raise exception 'cross-purpose reservation invariant failed';
  end if;

  update public.aidiss_ai_generations
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where session_id = v_session
    and request_id = v_chat_request
    and purpose = 'chat';

  select claim.disposition, claim.claim_token
  into v_disposition, v_live_token
  from public.aidiss_claim_generation(
    v_session, v_chat_request, 'chat', 0, repeat('a', 64),
    'migration-test-model', 'migration-test-chat'
  ) as claim;
  if v_disposition <> 'claimed'
     or v_live_token is null
     or v_live_token = v_stale_token then
    raise exception 'lease renewal invariant failed';
  end if;

  begin
    perform *
    from public.aidiss_persist_chat_turn(
      v_session,
      v_chat_request,
      0,
      jsonb_build_array(
        jsonb_build_object(
          'id', v_learner, 'role', 'learner', 'kind', 'move',
          'content', '데이터로 다음 낱말을 예상해요.',
          'replyToMessageId', null, 'readinessTags', '[]'::jsonb,
          'createdAt', clock_timestamp()
        ),
        jsonb_build_object(
          'id', v_pet, 'role', 'opponent_pet', 'kind', 'move',
          'content', '그 답이 틀릴 때는 어떻게 확인할까?',
          'replyToMessageId', v_learner, 'readinessTags', '[]'::jsonb,
          'createdAt', clock_timestamp()
        )
      ),
      v_state,
      'migration invariant test',
      'active',
      jsonb_build_object(
        'fingerprint', repeat('a', 64), 'status', 'completed',
        'modelName', 'migration-test-model', 'responseId', null,
        'inputTokens', 0, 'outputTokens', 0, 'latencyMs', 0,
        'errorCode', null
      ),
      v_stale_token
    );
    raise exception 'stale claim token was accepted';
  exception when others then
    if sqlerrm = 'stale claim token was accepted' then
      raise;
    end if;
  end;

  if exists (
    select 1 from public.aidiss_messages
    where session_id = v_session and request_id = v_chat_request
  ) then
    raise exception 'stale claim left messages behind';
  end if;

  select persisted.stored, persisted.next_state_version, persisted.replayed
  into v_stored, v_next, v_replayed
  from public.aidiss_persist_chat_turn(
    v_session,
    v_chat_request,
    0,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_learner, 'role', 'learner', 'kind', 'move',
        'content', '데이터로 다음 낱말을 예상해요.',
        'replyToMessageId', null, 'readinessTags', '[]'::jsonb,
        'createdAt', clock_timestamp()
      ),
      jsonb_build_object(
        'id', v_pet, 'role', 'opponent_pet', 'kind', 'move',
        'content', '그 답이 틀릴 때는 어떻게 확인할까?',
        'replyToMessageId', v_learner, 'readinessTags', '[]'::jsonb,
        'createdAt', clock_timestamp()
      )
    ),
    v_state,
    'migration invariant test',
    'active',
    jsonb_build_object(
      'fingerprint', repeat('a', 64), 'status', 'completed',
      'modelName', 'migration-test-model', 'responseId', null,
      'inputTokens', 0, 'outputTokens', 0, 'latencyMs', 0,
      'errorCode', null
    ),
    v_live_token
  ) as persisted;
  if not v_stored or v_next <> 1 or v_replayed then
    raise exception 'chat persistence invariant failed';
  end if;

  select persisted.stored, persisted.next_state_version, persisted.replayed
  into v_stored, v_next, v_replayed
  from public.aidiss_persist_chat_turn(
    v_session,
    v_chat_request,
    0,
    jsonb_build_array(
      jsonb_build_object(
        'id', v_learner, 'role', 'learner', 'kind', 'move',
        'content', '데이터로 다음 낱말을 예상해요.',
        'replyToMessageId', null, 'readinessTags', '[]'::jsonb,
        'createdAt', clock_timestamp()
      ),
      jsonb_build_object(
        'id', v_pet, 'role', 'opponent_pet', 'kind', 'move',
        'content', '그 답이 틀릴 때는 어떻게 확인할까?',
        'replyToMessageId', v_learner, 'readinessTags', '[]'::jsonb,
        'createdAt', clock_timestamp()
      )
    ),
    v_state,
    'migration invariant test', 'active',
    jsonb_build_object('fingerprint', repeat('a', 64)), v_live_token
  ) as persisted;
  if not v_stored or not v_replayed or v_next <> 1 then
    raise exception 'chat replay invariant failed';
  end if;

  select claim.disposition, claim.claim_token
  into v_disposition, v_review_token
  from public.aidiss_claim_generation(
    v_session, v_review_request, 'review', 1, repeat('c', 64),
    'migration-test-model', 'migration-test-review'
  ) as claim;
  if v_disposition <> 'claimed' or v_review_token is null then
    raise exception 'review claim invariant failed';
  end if;

  select persisted.stored, persisted.review_id, persisted.replayed
  into v_stored, v_review_id, v_replayed
  from public.aidiss_persist_review(
    v_session,
    v_review_request,
    1,
    repeat('c', 64),
    '{"learnerSaid":[],"systemInferred":[],"systemRecommended":[],"feedback":"test","sentenceStarters":[]}'::jsonb,
    '[]'::jsonb,
    v_state -> 'readiness',
    v_draft,
    jsonb_build_object(
      'modelName', 'migration-test-model', 'responseId', null,
      'inputTokens', 0, 'outputTokens', 0, 'latencyMs', 0
    ),
    v_review_token
  ) as persisted;
  if not v_stored or v_review_id is null or v_replayed then
    raise exception 'review persistence invariant failed';
  end if;

  select completed.stored, completed.replayed
  into v_stored, v_replayed
  from public.aidiss_complete_reflection(
    v_session, v_review_id, v_final_request, repeat('f', 64),
    v_draft, v_final
  ) as completed;
  if not v_stored or v_replayed then
    raise exception 'reflection completion invariant failed';
  end if;

  select claim.disposition
  into v_disposition
  from public.aidiss_claim_generation(
    v_session, v_blocked_request, 'chat', 1, repeat('e', 64),
    'migration-test-model', 'migration-test-chat'
  ) as claim;
  if v_disposition <> 'state_conflict' then
    raise exception 'completed-session invariant failed';
  end if;

  delete from public.aidiss_sessions where id = v_session;
  if exists (select 1 from public.aidiss_sessions where id = v_session) then
    raise exception 'migration test cleanup failed';
  end if;
end;
$$;

commit;

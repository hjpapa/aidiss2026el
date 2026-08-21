begin;

create index aidiss_reviews_generation_session_idx
  on public.aidiss_reviews (generation_id, session_id);

commit;

begin;
create table public.embedding_cache(user_id uuid not null references auth.users on delete cascade,content_hash text not null,model text not null,embedding vector(768) not null,primary key(user_id,content_hash,model));
alter table public.embedding_cache enable row level security;
-- Intermediate embeddings are server-only and let a retry resume after a provider quota failure.
revoke all on public.embedding_cache from anon,authenticated;
create function public.save_answers(p_user uuid,p_attempt uuid,p_answers jsonb) returns boolean language plpgsql security definer set search_path=public as $$ declare a exam_attempts; q quizzes; begin select * into strict a from exam_attempts where id=p_attempt and user_id=p_user for update; select * into strict q from quizzes where id=a.quiz_id; if a.submitted_at is not null or (q.kind='exam' and now()>a.started_at+make_interval(mins=>q.duration_minutes)) then return false; end if; update exam_attempts set answers=p_answers where id=a.id; return true; end $$;
revoke all on function save_answers from public,anon,authenticated;
grant execute on function save_answers to service_role;
commit;
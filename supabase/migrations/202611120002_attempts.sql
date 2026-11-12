begin;
create unique index one_active_attempt on exam_attempts(user_id,quiz_id) where submitted_at is null;
alter table quiz_attempts add column run_id uuid unique references exam_attempts(id);
create function public.submit_attempt(p_user uuid,p_attempt uuid,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts; q quizzes; item questions; selected jsonb; is_correct boolean; v_score integer:=0; v_total integer:=0; chosen jsonb; review jsonb:='[]'::jsonb; result_id uuid; begin
select * into strict a from exam_attempts where id=p_attempt and user_id=p_user for update;
select * into strict q from quizzes where id=a.quiz_id and user_id=p_user;
chosen=case when a.submitted_at is not null or (q.kind='exam' and now()>a.started_at+make_interval(mins=>q.duration_minutes)) then a.answers else p_answers end;
for item in select * from questions where quiz_id=q.id order by ordinal loop
 selected=coalesce(chosen->item.id::text,'[]'::jsonb);
 is_correct=jsonb_typeof(selected)='array' and selected @> (item.payload->'correctIndices') and (item.payload->'correctIndices') @> selected and jsonb_array_length(selected)=jsonb_array_length(item.payload->'correctIndices');
 v_total=v_total+1; if is_correct then v_score=v_score+1; end if;
 review=review||jsonb_build_array(item.payload||jsonb_build_object('id',item.id,'selected',selected,'correct',is_correct));
end loop;
if a.submitted_at is null then
 update exam_attempts set submitted_at=now(),answers=chosen,score=v_score,total=v_total where id=a.id;
 insert into quiz_attempts(user_id,quiz_id,run_id,answers,score,total) values(p_user,q.id,a.id,chosen,v_score,v_total) returning id into result_id;
 for item in select * from questions where quiz_id=q.id loop
 selected=coalesce(chosen->item.id::text,'[]'::jsonb); is_correct=selected @> (item.payload->'correctIndices') and (item.payload->'correctIndices') @> selected and jsonb_array_length(selected)=jsonb_array_length(item.payload->'correctIndices');
 insert into quiz_answers(user_id,attempt_id,question_id,answer,correct) values(p_user,result_id,item.id,selected,is_correct);
 if q.module_id is not null then insert into learning_progress(user_id,module_id,topic,correct,total) values(p_user,q.module_id,item.payload->>'topic',case when is_correct then 1 else 0 end,1) on conflict(user_id,module_id,topic) do update set correct=learning_progress.correct+excluded.correct,total=learning_progress.total+1,updated_at=now(); end if;
 end loop;
 insert into study_sessions(user_id,module_id,duration_seconds) values(p_user,q.module_id,least(18000,greatest(0,extract(epoch from now()-a.started_at)::integer)));
end if;
return jsonb_build_object('score',v_score,'total',v_total,'grade20',round(20.0*v_score/nullif(v_total,0),2),'review',review);
end $$;
revoke all on function submit_attempt from public,anon,authenticated;
grant execute on function submit_attempt to service_role;
commit;
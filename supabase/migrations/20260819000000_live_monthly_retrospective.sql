-- Retrospectiva mensal ao vivo: o mes atual pode ser consultado, mas so o
-- mes encerrado pode ser compartilhado. A regra fica no payload do banco para
-- nao depender de uma decisao feita pelo navegador.

begin;

create or replace function private.retrospective_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := date_trunc('month', current_date)::date;
  v_previous_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_year_start date := date_trunc('year', current_date)::date;
  v_today_end date := (current_date + interval '1 day')::date;
begin
  if p_user_id is null or not exists (
    select 1 from public.subscriptions s
     where s.user_id = p_user_id
       and s.status in ('active', 'past_due', 'trialing', 'paid', 'approved', 'authorized', 'complete', 'completed', 'succeeded')
       and (s.current_period_end is null or s.current_period_end >= now())
  ) then
    return jsonb_build_object('allowed', false, 'month', null, 'previousMonth', null, 'year', null);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'month', private.retrospective_period(p_user_id, v_month_start, v_today_end, 'month', to_char(v_month_start, 'TMMonth YYYY'))
      || jsonb_build_object('isLive', true, 'isFinal', false, 'canShare', false),
    'previousMonth', private.retrospective_period(p_user_id, v_previous_month_start, v_month_start, 'month', to_char(v_previous_month_start, 'TMMonth YYYY'))
      || jsonb_build_object('isLive', false, 'isFinal', true, 'canShare', true),
    'year', private.retrospective_period(p_user_id, v_year_start, v_today_end, 'year', to_char(v_year_start, 'YYYY'))
      || jsonb_build_object('isLive', true, 'isFinal', false, 'canShare', true)
  );
end;
$function$;

create or replace function private.retrospective_snapshot_with_images(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_payload jsonb := private.retrospective_snapshot(p_user_id);
  v_kind text;
  v_title text;
  v_image text;
begin
  foreach v_kind in array array['month', 'previousMonth', 'year']::text[] loop
    v_title := v_payload -> v_kind -> 'topBook' ->> 'title';
    if v_title is null or v_title = '' then continue; end if;
    select b.image into v_image from public.books b
     where b.title = v_title and nullif(b.image, '') is not null
     order by b.updated_at desc nulls last, b.created_at desc nulls last limit 1;
    if v_image is not null then
      v_payload := jsonb_set(v_payload, array[v_kind, 'topBook', 'image'], to_jsonb(v_image), true);
    end if;
  end loop;
  return v_payload;
end;
$function$;

create or replace function private.retrospective_snapshot_with_lists(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_payload jsonb := private.retrospective_snapshot_with_images(p_user_id);
  v_kind text;
  v_period jsonb;
  v_books jsonb;
  v_authors jsonb;
begin
  if coalesce(v_payload ->> 'allowed', 'false') <> 'true' then return v_payload; end if;

  foreach v_kind in array array['month', 'previousMonth', 'year']::text[] loop
    v_period := v_payload -> v_kind;
    if v_period is null then continue; end if;
    v_period := v_period - 'posts' - 'comments';
    if coalesce((v_period ->> 'minutes')::integer, 0) = 0
       and coalesce((v_period ->> 'booksStarted')::integer, 0) = 0
       and coalesce((v_period ->> 'booksCompleted')::integer, 0) = 0 then
      v_period := jsonb_set(v_period, array['hasData'], 'false'::jsonb, true);
    end if;
    v_payload := jsonb_set(v_payload, array[v_kind], v_period, true);

    select coalesce(jsonb_agg(jsonb_build_object('title', ranked.title, 'image', ranked.image, 'minutes', round(ranked.seconds::numeric / 60)::integer) order by ranked.seconds desc, ranked.title asc), '[]'::jsonb)
      into v_books
      from (
        select b.title, nullif(b.image, '') as image, sum(s.reported_seconds)::bigint as seconds
          from private.reading_reward_sessions s join public.books b on b.id = s.book_id
         where s.user_id = p_user_id and s.day_key >= (v_period ->> 'start')::date and s.day_key < (v_period ->> 'end')::date
         group by b.id, b.title, b.image order by seconds desc, b.title asc limit 5
      ) ranked;

    select coalesce(jsonb_agg(jsonb_build_object('name', ranked.name, 'minutes', round(ranked.seconds::numeric / 60)::integer) order by ranked.seconds desc, ranked.name asc), '[]'::jsonb)
      into v_authors
      from (
        select a.name, sum(s.reported_seconds)::bigint as seconds
          from private.reading_reward_sessions s join public.books b on b.id = s.book_id join public.authors a on a.id = b.author_id
         where s.user_id = p_user_id and s.day_key >= (v_period ->> 'start')::date and s.day_key < (v_period ->> 'end')::date
         group by a.id, a.name order by seconds desc, a.name asc limit 5
      ) ranked;

    v_payload := jsonb_set(v_payload, array[v_kind, 'topBooks'], v_books, true);
    v_payload := jsonb_set(v_payload, array[v_kind, 'topAuthors'], v_authors, true);
  end loop;
  return v_payload;
end;
$function$;

revoke all on function private.retrospective_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.retrospective_snapshot(uuid) to authenticated, service_role;
revoke all on function private.retrospective_snapshot_with_images(uuid) from public, anon, authenticated;
grant execute on function private.retrospective_snapshot_with_images(uuid) to authenticated, service_role;
revoke all on function private.retrospective_snapshot_with_lists(uuid) from public, anon, authenticated;
grant execute on function private.retrospective_snapshot_with_lists(uuid) to authenticated, service_role;

create or replace function public.retrospective_snapshot()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.retrospective_snapshot_with_lists(auth.uid()); $function$;

revoke all on function public.retrospective_snapshot() from public, anon;
grant execute on function public.retrospective_snapshot() to authenticated, service_role;
notify pgrst, 'reload schema';
commit;

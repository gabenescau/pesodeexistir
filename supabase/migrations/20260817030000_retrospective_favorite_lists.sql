-- Adds compact favorite book and author lists to the private retrospective payload.
-- The query is calculated server-side and only returns the current user's top five.

begin;

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
  if coalesce(v_payload ->> 'allowed', 'false') <> 'true' then
    return v_payload;
  end if;

  foreach v_kind in array array['month', 'year']::text[] loop
    v_period := v_payload -> v_kind;
    if v_period is null then
      continue;
    end if;

    -- The annual view is year-to-date, so it remains shareable throughout
    -- the year instead of waiting for a previous full year to exist.
    if v_kind = 'year' then
      v_period := private.retrospective_period(
        p_user_id,
        date_trunc('year', current_date)::date,
        (current_date + interval '1 day')::date,
        'year',
        to_char(current_date, 'YYYY')
      );
      v_payload := jsonb_set(v_payload, array[v_kind], v_period, true);
    end if;

    -- Posts and comments are not part of the retrospective anymore.
    -- Remove them server-side too, keeping the response intentionally small.
    v_period := v_period - 'posts' - 'comments';
    if coalesce((v_period ->> 'minutes')::integer, 0) = 0
       and coalesce((v_period ->> 'booksStarted')::integer, 0) = 0
       and coalesce((v_period ->> 'booksCompleted')::integer, 0) = 0 then
      v_period := jsonb_set(v_period, array['hasData'], 'false'::jsonb, true);
    end if;
    v_payload := jsonb_set(v_payload, array[v_kind], v_period, true);

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'title', ranked.title,
          'image', ranked.image,
          'minutes', round(ranked.seconds::numeric / 60)::integer
        )
        order by ranked.seconds desc, ranked.title asc
      ),
      '[]'::jsonb
    )
      into v_books
      from (
        select b.title,
               nullif(b.image, '') as image,
               sum(s.reported_seconds)::bigint as seconds
          from private.reading_reward_sessions s
          join public.books b on b.id = s.book_id
         where s.user_id = p_user_id
           and s.day_key >= (v_period ->> 'start')::date
           and s.day_key < (v_period ->> 'end')::date
         group by b.id, b.title, b.image
         order by seconds desc, b.title asc
         limit 5
      ) ranked;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', ranked.name,
          'minutes', round(ranked.seconds::numeric / 60)::integer
        )
        order by ranked.seconds desc, ranked.name asc
      ),
      '[]'::jsonb
    )
      into v_authors
      from (
        select a.name,
               sum(s.reported_seconds)::bigint as seconds
          from private.reading_reward_sessions s
          join public.books b on b.id = s.book_id
          join public.authors a on a.id = b.author_id
         where s.user_id = p_user_id
           and s.day_key >= (v_period ->> 'start')::date
           and s.day_key < (v_period ->> 'end')::date
         group by a.id, a.name
         order by seconds desc, a.name asc
         limit 5
      ) ranked;

    v_payload := jsonb_set(v_payload, array[v_kind, 'topBooks'], v_books, true);
    v_payload := jsonb_set(v_payload, array[v_kind, 'topAuthors'], v_authors, true);
  end loop;

  return v_payload;
end;
$function$;

revoke all on function private.retrospective_snapshot_with_lists(uuid)
  from public, anon, authenticated;
grant execute on function private.retrospective_snapshot_with_lists(uuid)
  to authenticated, service_role;

create or replace function public.retrospective_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.retrospective_snapshot_with_lists(auth.uid());
$function$;

revoke all on function public.retrospective_snapshot() from public, anon;
grant execute on function public.retrospective_snapshot() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

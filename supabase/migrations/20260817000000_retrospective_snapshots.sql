-- Retrospectivas mensais e anuais: resumo do proprio usuario, calculado no banco.
-- Nenhuma tabela privada fica exposta ao navegador.

begin;

create index if not exists reading_reward_sessions_user_day_idx
  on private.reading_reward_sessions (user_id, day_key)
  include (book_id, reported_seconds);

create index if not exists reading_progress_user_updated_idx
  on public.reading_progress (user_id, updated_at desc)
  include (book_id, progress);

create index if not exists posts_user_created_idx
  on public.posts (user_id, created_at desc);

create index if not exists post_replies_user_created_idx
  on public.post_replies (user_id, created_at desc);

create or replace function private.retrospective_period(
  p_user_id uuid,
  p_start date,
  p_end date,
  p_kind text,
  p_label text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_minutes integer := 0;
  v_books_started integer := 0;
  v_books_completed integer := 0;
  v_posts integer := 0;
  v_comments integer := 0;
  v_top_book jsonb;
  v_top_author jsonb;
begin
  if p_user_id is null or p_start is null or p_end is null or p_start >= p_end then
    return jsonb_build_object(
      'kind', p_kind,
      'label', p_label,
      'start', p_start,
      'end', p_end,
      'hasData', false,
      'minutes', 0,
      'booksStarted', 0,
      'booksCompleted', 0,
      'posts', 0,
      'comments', 0,
      'topBook', null,
      'topAuthor', null
    );
  end if;

  select
    coalesce(round(sum(s.reported_seconds)::numeric / 60), 0)::integer,
    count(distinct s.book_id)::integer
    into v_minutes, v_books_started
    from private.reading_reward_sessions s
   where s.user_id = p_user_id
     and s.day_key >= p_start
     and s.day_key < p_end;

  select count(*)::integer
    into v_books_completed
    from public.reading_progress rp
   where rp.user_id = p_user_id
     and rp.progress >= 100
     and rp.updated_at >= p_start::timestamptz
     and rp.updated_at < p_end::timestamptz;

  select count(*)::integer
    into v_posts
    from public.posts p
   where p.user_id = p_user_id
     and p.created_at >= p_start::timestamptz
     and p.created_at < p_end::timestamptz;

  select count(*)::integer
    into v_comments
    from public.post_replies r
   where r.user_id = p_user_id
     and r.created_at >= p_start::timestamptz
     and r.created_at < p_end::timestamptz;

  select jsonb_build_object(
      'title', ranked.title,
      'minutes', round(ranked.seconds::numeric / 60)::integer
    )
    into v_top_book
    from (
      select b.title, sum(s.reported_seconds)::bigint as seconds
        from private.reading_reward_sessions s
        join public.books b on b.id = s.book_id
       where s.user_id = p_user_id
         and s.day_key >= p_start
         and s.day_key < p_end
       group by b.id, b.title
       order by seconds desc, b.title asc
       limit 1
    ) ranked;

  select jsonb_build_object(
      'name', ranked.name,
      'minutes', round(ranked.seconds::numeric / 60)::integer
    )
    into v_top_author
    from (
      select a.name, sum(s.reported_seconds)::bigint as seconds
        from private.reading_reward_sessions s
        join public.books b on b.id = s.book_id
        join public.authors a on a.id = b.author_id
       where s.user_id = p_user_id
         and s.day_key >= p_start
         and s.day_key < p_end
       group by a.id, a.name
       order by seconds desc, a.name asc
       limit 1
    ) ranked;

  return jsonb_build_object(
    'kind', p_kind,
    'label', p_label,
    'start', p_start,
    'end', p_end,
    'hasData', (v_minutes > 0 or v_books_started > 0 or v_books_completed > 0 or v_posts > 0 or v_comments > 0),
    'minutes', v_minutes,
    'booksStarted', v_books_started,
    'booksCompleted', v_books_completed,
    'posts', v_posts,
    'comments', v_comments,
    'topBook', v_top_book,
    'topAuthor', v_top_author
  );
end;
$function$;

create or replace function private.retrospective_snapshot(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_month_end date := date_trunc('month', current_date)::date;
  v_year_start date := (date_trunc('year', current_date) - interval '1 year')::date;
  v_year_end date := date_trunc('year', current_date)::date;
begin
  return jsonb_build_object(
    'month', private.retrospective_period(
      p_user_id,
      v_month_start,
      v_month_end,
      'month',
      to_char(v_month_start, 'TMMonth YYYY')
    ),
    'year', private.retrospective_period(
      p_user_id,
      v_year_start,
      v_year_end,
      'year',
      to_char(v_year_start, 'YYYY')
    )
  );
end;
$function$;

revoke all on function private.retrospective_period(uuid, date, date, text, text)
  from public, anon, authenticated;
grant execute on function private.retrospective_period(uuid, date, date, text, text)
  to authenticated, service_role;

revoke all on function private.retrospective_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function private.retrospective_snapshot(uuid)
  to authenticated, service_role;

create or replace function public.retrospective_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.retrospective_snapshot(auth.uid());
$function$;

revoke all on function public.retrospective_snapshot() from public, anon;
grant execute on function public.retrospective_snapshot() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

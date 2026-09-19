-- Adds the top book cover to the private retrospective payload.
-- The lookup stays server-side and does not expose books to the browser.

begin;

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
  foreach v_kind in array array['month', 'year']::text[] loop
    v_title := v_payload -> v_kind -> 'topBook' ->> 'title';
    if v_title is null or v_title = '' then
      continue;
    end if;

    select b.image
      into v_image
      from public.books b
     where b.title = v_title
       and nullif(b.image, '') is not null
     order by b.updated_at desc nulls last, b.created_at desc nulls last
     limit 1;

    if v_image is not null then
      v_payload := jsonb_set(
        v_payload,
        array[v_kind, 'topBook', 'image'],
        to_jsonb(v_image),
        true
      );
    end if;
  end loop;

  return v_payload;
end;
$function$;

revoke all on function private.retrospective_snapshot_with_images(uuid)
  from public, anon, authenticated;
grant execute on function private.retrospective_snapshot_with_images(uuid)
  to authenticated, service_role;

create or replace function public.retrospective_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.retrospective_snapshot_with_images(auth.uid());
$function$;

revoke all on function public.retrospective_snapshot() from public, anon;
grant execute on function public.retrospective_snapshot() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

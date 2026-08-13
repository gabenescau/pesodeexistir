-- Account deletion must remove all user-owned application rows before the
-- Supabase Auth user is deleted. This is intentionally limited to foreign keys
-- that reference auth.users; catalog and shared content are not affected.
begin;

do $account_delete$
declare
  constraint_row record;
begin
  for constraint_row in
    select
      ns.nspname as table_schema,
      cls.relname as table_name,
      con.conname,
      rn.nspname as referenced_schema,
      referenced.relname as referenced_table,
      string_agg(format('%I', local_att.attname), ', ' order by key_columns.ordinality) as local_columns,
      string_agg(format('%I', referenced_att.attname), ', ' order by key_columns.ordinality) as referenced_columns
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    join pg_class referenced on referenced.oid = con.confrelid
    join pg_namespace rn on rn.oid = referenced.relnamespace
    cross join lateral unnest(con.conkey) with ordinality as key_columns(attnum, ordinality)
    join pg_attribute local_att
      on local_att.attrelid = con.conrelid
     and local_att.attnum = key_columns.attnum
    cross join lateral unnest(con.confkey) with ordinality as referenced_columns(attnum, ordinality)
    join pg_attribute referenced_att
      on referenced_att.attrelid = con.confrelid
     and referenced_att.attnum = referenced_columns.attnum
     and referenced_columns.ordinality = key_columns.ordinality
    where con.contype = 'f'
      and rn.nspname = 'auth'
      and referenced.relname = 'users'
      and con.confdeltype <> 'c'
    group by ns.nspname, cls.relname, con.conname, rn.nspname, referenced.relname
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      constraint_row.table_schema,
      constraint_row.table_name,
      constraint_row.conname
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (%s) references %I.%I (%s) on delete cascade',
      constraint_row.table_schema,
      constraint_row.table_name,
      constraint_row.conname,
      constraint_row.local_columns,
      constraint_row.referenced_schema,
      constraint_row.referenced_table,
      constraint_row.referenced_columns
    );
  end loop;
end
$account_delete$;

commit;

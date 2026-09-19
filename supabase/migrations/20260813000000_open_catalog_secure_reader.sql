-- Usuarios autenticados sem plano podem descobrir a biblioteca, a comunidade
-- e a loja. O arquivo pago continua protegido pelo Storage e pelo endpoint
-- server-side /api/book-pdf.
begin;

alter table if exists public.books
  add column if not exists has_pdf boolean generated always as (
    nullif(btrim(coalesce(pdf_path, '')), '') is not null
    or nullif(btrim(coalesce(pdf_url, '')), '') is not null
  ) stored;

comment on column public.books.has_pdf is
  'Sinal publico de disponibilidade; nunca substitui a autorizacao do PDF.';

-- O catalogo anon nao e usado pelo SPA autenticado e nao deve revelar nem
-- mesmo caminhos de arquivos. A policy do bucket continua sendo a barreira
-- definitiva contra download indevido.
revoke select (pdf_path, pdf_url) on public.books from anon, authenticated;

-- O painel ainda precisa saber qual objeto remover ao editar/excluir um livro,
-- mas isso nao deve transformar os caminhos dos PDFs em dados de catalogo.
-- A funcao privada aplica a autorizacao real; o wrapper invoker apenas torna a
-- operacao chamavel pela API do Supabase sem abrir os caminhos para usuarios.
create or replace function private.admin_book_pdf_assets()
returns table (book_id uuid, pdf_path text, pdf_url text)
language sql
stable
security definer
set search_path = ''
as $function$
  select b.id, b.pdf_path, b.pdf_url
  from public.books b
  where private.can_manage_content();
$function$;

create or replace function public.admin_book_pdf_assets()
returns table (book_id uuid, pdf_path text, pdf_url text)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.admin_book_pdf_assets();
$function$;

revoke all on function private.admin_book_pdf_assets() from public, anon, authenticated;
grant execute on function private.admin_book_pdf_assets() to service_role;
revoke all on function public.admin_book_pdf_assets() from public, anon, authenticated;
grant execute on function public.admin_book_pdf_assets() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;

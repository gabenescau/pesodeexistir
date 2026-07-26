-- OPE Club — aplica private_profile de verdade, sem vazar email
--
-- Situação anterior:
--   A policy profiles_select_own_or_admin deixa o usuário ver APENAS o próprio
--   perfil. Consequências:
--   a) a coluna private_profile nunca era aplicada (nada para esconder, já que
--      ninguém via ninguém);
--   b) o feed da comunidade não conseguia mostrar nome/avatar do autor dos
--      posts — para quem não é admin, a lista de profiles vinha vazia.
--
-- Por que NÃO basta abrir profiles para authenticated:
--   `authenticated` tem SELECT em todas as colunas da tabela, incluindo
--   `email` e `role`. Uma policy permissiva na tabela deixaria qualquer
--   usuário logado fazer GET /rest/v1/profiles?select=email e coletar o email
--   de toda a base. Por isso a exposição é feita por uma VIEW curada.

-- =====================================================================
-- 1) Projeção pública de perfis: só colunas não sensíveis
-- =====================================================================
create or replace view public.public_profiles as
select
  id,
  name,
  avatar,
  bio
from public.profiles
where private_profile = false;

-- security_invoker = false (padrão) é intencional aqui: a view roda com os
-- privilégios do dono e serve como janela controlada para a tabela, que
-- continua fechada. A view não expõe email, role, nem perfis privados —
-- é exatamente o subconjunto que o feed precisa.
alter view public.public_profiles set (security_invoker = false);

-- Só quem está logado enxerga a comunidade.
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

comment on view public.public_profiles is
  'Perfis visiveis no feed: apenas id/name/avatar/bio de quem nao marcou private_profile. A tabela profiles continua restrita a dono e admin.';

# Fase 2: seguranca e autorizacao

## Migration

Aplicar depois da Fase 1:

```text
supabase/migrations/20260810200000_phase2_security_authorization.sql
```

Ela:

- valida argumentos e restringe a RPC de rate limit ao `service_role`;
- fixa `search_path = ''` em funcoes `SECURITY DEFINER`;
- remove execucao anonima de RPCs privilegiadas;
- preserva apenas os RPCs autenticados que o app realmente usa;
- fecha grants de tabelas internas;
- aplica RLS a tabelas de rate limit, billing, pedidos e webhook;
- limita tamanho, MIME declarado, extensao e pasta dos uploads do Storage.

## Configuracoes manuais no Supabase Auth

Estas configuracoes nao podem ser ativadas de forma confiavel por uma migration
SQL. No painel do projeto, revisar:

1. Authentication > Providers > Email: exigir confirmacao de email em producao.
2. Authentication > Attack Protection: habilitar leaked password protection.
3. Authentication > Attack Protection: habilitar CAPTCHA/Turnstile e cadastrar
   o site key permitido para o dominio de producao.
4. Authentication > Rate Limits: manter limites server-side para login,
   recuperacao de senha, cadastro e verificacao de email.
5. Authentication > Sessions: revisar duracao do access token, inactivity
   timeout e single-session conforme o risco do produto.

O app continua sendo uma SPA Vite, mas a sessão de autenticação agora é
protegida por um BFF de autenticação em `/api/auth`: refresh e access tokens
ficam em cookies `HttpOnly`, `Secure` e `SameSite=Lax` em produção. O access
token curto é mantido apenas em memória para compatibilidade temporária com
leituras Supabase que ainda usam RLS diretamente no browser; ele não é gravado
em `localStorage` ou `sessionStorage`.

Esta é uma migração em ponte, não a conclusão de um BFF completo. Um XSS
durante a vida da página ainda poderia usar o cliente Supabase já inicializado
ou observar respostas de dados. Para eliminar também essa superfície, a próxima
fase deve migrar os reads protegidos de `DataContext`, Storage e Functions para
endpoints same-origin no servidor e então remover `accessToken` das respostas
de `/api/auth?action=session` e do cliente Supabase.

Não se deve copiar token para cookie via JavaScript e chamar isso de HttpOnly.

## Rate limit da API

As Functions usam a RPC Postgres com estado compartilhado entre instancias. Em
producao, se o banco de rate limit estiver indisponivel, a API retorna `503`
e nao abre uma excecao para continuar aceitando pagamentos/admin. A variavel
`RATE_LIMIT_FAIL_OPEN=true` so tem efeito fora de producao.

## Uploads

As policies validam extensao, pasta do usuario, MIME permitido pelo bucket e
tamanho maximo. Isso nao substitui validacao de magic bytes para arquivos
hostis; a proxima melhoria para uploads de alto risco e passar PDFs/imagens por
um endpoint de ingestao com verificacao de conteudo real e antivirus.

## Validacao

Depois de aplicar, testar com contas anonima, autenticada sem plano, Leitor,
Pensador, editor e admin. Confirmar que:

- anon nao consegue chamar RPC privilegiada;
- usuario comum nao consegue acessar tabelas internas;
- uploads fora da pasta propria sao negados;
- PDF continua protegido pela policy de leitura;
- o rate limit retorna `429` no limite e `503` quando a RPC fica indisponivel;
- `/api/health` nao revela SHA, segredo ou configuracao detalhada.

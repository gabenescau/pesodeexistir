# Security

Relate vulnerabilidades de forma privada ao mantenedor do repositorio. Nao
publique tokens, CPF, dados de pagamento, dumps do banco ou passos de exploracao
em uma issue publica.

Ao relatar, inclua a rota afetada, impacto, pre-condicoes e uma reproducao
minima sem dados reais. Credenciais encontradas em historico Git devem ser
revogadas e substituidas; apagar somente o arquivo atual nao invalida a chave.

## Excecao monitorada

O `npm audit` atualmente sinaliza `GHSA-qwww-vcr4-c8h2` no React Router. O
problema afeta o modo RSC/Server Actions; esta aplicacao e um SPA Vite e nao
habilita RSC, loaders de servidor ou actions do React Router. Mantemos a versao
mais recente disponivel e o Dependabot deve atualizar o pacote quando houver
release corrigida. Nao habilite RSC neste projeto sem remover antes essa
excecao.

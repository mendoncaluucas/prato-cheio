# ADR 0002 — Como o PostgreSQL vai subir na Unidade 3

- **Data:** [PREENCHER]
- **Status:** proposto

## Contexto
O `src/db.js` já foi desenhado para isolar a troca de banco (SQLite → PostgreSQL) atrás
de `query()` devolvendo `{ rows }`. O README e o `.github/workflows/ci.yml` deixam
explícito que a forma como o PostgreSQL sobe é escolha do grupo, desde que fique
alcançável por `DATABASE_URL`, com schema migrado e CI verde. É preciso decidir isso antes
da refatoração da Unidade 3 para não travar o trabalho por falta de banco acessível.

## Alternativas consideradas
1. **PostgreSQL instalado localmente** — cada integrante instala na própria máquina.
   Sem custo, mas expõe divergência de versão/configuração entre Windows e Mac, e não
   resolve o banco do CI sozinho (o `ci.yml` já traz um bloco comentado usando o serviço
   `postgres` do GitHub Actions para isso).
2. **Contêiner Docker local** — mais uniforme entre integrantes que a instalação local,
   mas exige Docker instalado e algum conhecimento de `docker-compose`, que o grupo ainda
   não usou no projeto.
3. **Serviço gerenciado gratuito (Neon, Supabase ou Render)** — um único banco acessível
   por todos via `DATABASE_URL`, sem instalar nada localmente; mais próximo de produção.
   Risco: depende de internet e de limites do plano gratuito.

## Decisão
[PREENCHER — o grupo escolhe entre as três alternativas, ou justifica outra, e registra
qual serviço/versão específica será usada]

## Consequências
- Positivas:
- Negativas / o que abrimos mão:
- Riscos e o que fazer se der errado:

## Rastreabilidade
Atende ao requisito do README de banco alcançável por `DATABASE_URL` com CI verde, e à
troca de banco já prevista na interface de `src/db.js`.

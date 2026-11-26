# Refatorações — Prato Cheio

*Trabalho 3 · uma seção por refatoração · o que importa é o motivo e a evidência*

## Refatoração 1 — Migração de SQLite para PostgreSQL

- **Motivo:** a disciplina exige banco relacional em PostgreSQL na Unidade 3, e o SQLite
  era um arquivo local, com um escritor por vez e um módulo ainda experimental
  ([ADR 0003](adr/0003-migrar-sqlite-para-postgresql.md); o Neon vem do
  [ADR 0002](adr/0002-subida-postgresql.md)).
- **O que mudou:**
  - `src/db.js` deixou de falar com o `node:sqlite`. Ficou só o `pg`, e sem `DATABASE_URL` o
    módulo falha com uma mensagem em português. `query`, `colunas`, `migrar`, `limparBanco` e
    `encerrar` continuam com a mesma interface.
  - A coluna `validade` passou de `TEXT` para `DATE`. O `pg` devolve `DATE` como objeto com
    fuso, então um parser do tipo 1082 devolve o texto `AAAA-MM-DD` e a API não mudou. `migrar()`
    converte uma tabela antiga e continua idempotente.
  - `vitest.config.js` só aceita `DATABASE_URL_TESTE` e ignora a `DATABASE_URL` do ambiente.
    Antes, um `npm test` com a URL do Neon no terminal apagaria as doações do grupo. O CI ganhou
    a variável no passo dos testes.
  - `README.md` e `.env.example` descrevem o PostgreSQL local com Docker.
  - Na primeira parte da migração (PR #24), `src/doacoes.js` passou a recusar o caractere nulo
    em texto e a limitar o id a 2147483647. No PostgreSQL esses dois casos viravam erro 500.
- **O que NÃO mudou:** as regras de negócio, as rotas, o contrato da API (`validade` segue
  como `AAAA-MM-DD`) e os testes de comportamento. O ADR dizia que a troca ficaria só no
  `db.js`, e isso valeu só em parte, por causa das duas recusas acima (nota no ADR 0003).
- **Evidência de que o comportamento se manteve:**
  - testes antes da mudança: 79 passando (SQLite em memória)
  - testes depois da mudança: 79 passando contra o PostgreSQL 18, mais 6 novos em
    `tests/banco.test.js` (guarda do `DATABASE_URL_TESTE`, `DATABASE_URL` obrigatória, coluna
    `DATE`, validade como texto, conversão da coluna antiga), 85 no total
  - link da execução do CI verde: (colar o link do PR depois do push)

## Refatoração 2 — Status escritos à mão viram uma constante

- **Code Smell atacado:** strings mágicas. `'disponivel'`, `'aceita'`, `'coletada'` e
  `'retirada'` apareciam soltas em `doacoes.js` e `repositorio.js`.
- **Qual dor concreta isso resolvia:** um erro de digitação (`'coletado'`) não dá erro nenhum,
  a regra só deixa de valer sem ninguém notar. E para saber quais status existem era preciso
  ler o arquivo inteiro.
- **O que mudou:** novo `src/status.js` com `STATUS`. `doacoes.js` usa a constante, e no
  `repositorio.js` os status passaram a ir como parâmetro `?` no SQL. O `DEFAULT 'disponivel'`
  do schema em `db.js` ficou como está.
- **Evidência:** 71 testes passando antes, 71 depois.

## Refatoração 3 — Busca por id e "perdeu a corrida" repetidos

- **Code Smell atacado:** duplicação. `aceitar`, `retirar` e `coletar` tinham o mesmo
  bloco de buscar a doação e recusar se não existe, e o mesmo bloco de recusar quando o UPDATE
  não devolve linha.
- **Qual dor concreta isso resolvia:** três cópias para manter iguais. Quem mexesse na
  mensagem de uma esquecia as outras.
- **O que mudou:** duas funções em `doacoes.js`, `buscarOuRecusar` e `exigirAtualizada`. As
  mensagens de erro são as mesmas de antes. Antes de mexer escrevemos o teste que faltava
  (aceitar uma doação que não existe).
- **Evidência:** 71 testes antes. Com o teste novo, 72 antes e depois da extração.

## Refatoração 4 — `doacoes.js` fazia regra de negócio e cálculo de relatório

- **Code Smell atacado:** módulo com duas responsabilidades. As contas do relatório
  semanal (semana, mediana, taxa) moravam junto das regras de aceitar, retirar e coletar.
- **Qual dor concreta isso resolvia:** arquivo longo, e o relatório só precisa de datas e
  números, não do banco nem das regras.
- **O que mudou:** `src/relatorio.js` ficou com `montarRelatorioSemanal` e seus auxiliares,
  `src/datas.js` com `diaLocal`, `hoje` e `instanteUTC`. `doacoes.js` só busca os dados e chama
  o cálculo, e continua exportando `montarRelatorioSemanal`, então os testes não mudaram.
- **Evidência:** 72 testes antes e depois (os blocos do relatório semanal e da coleta
  após o vencimento cobrem esse código).

## Refatoração 5 — Front-end: o mesmo POST escrito quatro vezes

- **Code Smell atacado:** duplicação em `public/index.html`. Publicar, aceitar, coletar
  e retirar repetiam o fetch, a leitura da resposta, o aviso de sucesso ou erro e o recarregar.
- **Qual dor concreta isso resolvia:** cada ação nova copiava o bloco de novo.
- **O que mudou:** função `enviar(url, dados, mensagemOk)` no script da página.
- **Evidência:** a interface não tinha teste nenhum. Criamos `tests/interface.test.js` (jsdom,
  `devDependency` nova) com 7 casos que abrem a página e clicam nos botões, e rodamos contra o
  código antigo antes de refatorar: 72 testes mais os 7 novos, 79 passando. Depois da
  extração, os mesmos 79.

---

**Limitações e o que ficou de fora:**
- O `if (URL_BANCO)` de `db.js` saiu junto com o SQLite, na Refatoração 1.
- O `index.html` continua com tudo num arquivo só (CSS, HTML e script).
- `criarDoacao` tem uma validação longa que poderia ir para um módulo próprio.
- Uso de IA: a IA apontou os trechos do código que valia melhorar (valores escritos à mão,
  código repetido, módulo grande demais) e propôs as extrações. O grupo revisou o diff e rodou
  os testes. (ajustar com o que o grupo de fato fez)

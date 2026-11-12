# Refatorações — Prato Cheio

*Trabalho 3 · uma seção por refatoração · o que importa é o motivo e a evidência*

## Refatoração 1 — Migração de SQLite para PostgreSQL

- **Motivo:** (o que a decidiu — ver o ADR da Unidade 2)
- **O que mudou:** (arquivos e o que neles)
- **O que NÃO mudou:** (as regras de negócio? as rotas? os testes?)
- **Evidência de que o comportamento se manteve:**
  - testes antes da mudança: ___ passando
  - testes depois da mudança: ___ passando
  - link da execução do CI verde:

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
- O `if (URL_BANCO)` espalhado em `db.js` só some quando o SQLite for removido (migração, parte
  da Refatoração 1), por isso não mexemos lá.
- O `index.html` continua com tudo num arquivo só (CSS, HTML e script).
- `criarDoacao` tem uma validação longa que poderia ir para um módulo próprio.
- Uso de IA: a IA apontou os trechos do código que valia melhorar (valores escritos à mão,
  código repetido, módulo grande demais) e propôs as extrações. O grupo revisou o diff e rodou
  os testes. (ajustar com o que o grupo de fato fez)

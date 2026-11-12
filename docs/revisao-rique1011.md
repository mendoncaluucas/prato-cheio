# Revisão de código: rique1011/prato-cheio

Feita pelo grupo AKMS (Victor, Lucas, Vinicius e Alisson) em 12/11/2026.

Repositório: https://github.com/rique1011/prato-cheio
Versão: branch `atividade-3`, commit [`d765b03`](https://github.com/rique1011/prato-cheio/commit/d765b03). A `main` deles está parada no commit inicial, então revisamos a `atividade-3`.

Lemos `src/`, `tests/`, `vitest.config.js`, o CI e o `docs/refatoracoes.md`. Rodamos os testes aqui, com um PostgreSQL descartável, e mandamos requisições de borda para a API para confirmar o que a leitura sugeriu. Não mexemos em nada no repositório de vocês. Ficou de fora o `public/index.html`, o conteúdo dos ADRs e dos diagramas, e uma busca por segredos no histórico do Git.

## Testes

Passaram 52 de 52 na nossa máquina. O [CI do último commit](https://github.com/rique1011/prato-cheio/actions/runs/43235529347) também está verde.

## Checklist

- Instruções para rodar: ok. README, `.env.example` e `.npmrc` exigindo Node 22.13.
- Testes e critérios de aceite: ok. O cancelamento tem CA1 a CA7 nomeados nos testes.
- CI com banco de verdade: ok, só que roda apenas na `atividade-3` (F8).
- Separação entre rotas, regras e SQL: ok.
- SQL parametrizado e `UPDATE` atômico: ok.
- Validação de entrada: precisa melhorar (F1, F2, F5, F6).
- Tratamento de erro HTTP: precisa melhorar (F3, F4).
- `docs/refatoracoes.md`: ok. Tem baseline, CI antes e depois e admite os dois tropeços no meio do caminho.

## O que gostamos

O `vitest.config.js` se recusa a rodar se `DATABASE_URL_TESTE` for igual à `DATABASE_URL`. A gente não tem isso e vai copiar a ideia, porque nosso `limparBanco()` apaga tudo. Aceite, coleta e cancelamento também são decididos num `UPDATE ... WHERE` só, com teste de requisições simultâneas, e os 7 testes de regressão vieram antes da primeira refatoração.

## O que encontramos

Tudo abaixo foi reproduzido por nós, menos onde está dito o contrário.

### F1. Doação sem tipo e sem quantidade é aceita (alta)

Em [`src/doacoes.js`, linhas 17 a 25](https://github.com/rique1011/prato-cheio/blob/d765b03/src/doacoes.js#L17-L25) só a validade é conferida. `POST /api/doacoes` com `tipo: ""` e `quantidade: ""` devolve 201 e grava. Com `tipo` como objeto, grava a string `{"a":1}`. Se o campo nem vier, dá 400, mas com a mensagem do PostgreSQL (ver F3).

A regra de negócio diz que toda doação registra tipo, quantidade e validade, e a aplicação não está garantindo isso. Sugerimos uma função que exija texto não vazio (string, depois `trim()`), usada nos dois campos. Teste: vazio, só espaços, objeto e ausente, todos recusados.

### F2. `aceitar` não valida nem limpa o nome da ONG (alta)

Em [`src/app.js`, linha 39](https://github.com/rique1011/prato-cheio/blob/d765b03/src/app.js#L39) e em [`src/doacoes.js`, linhas 44 a 52](https://github.com/rique1011/prato-cheio/blob/d765b03/src/doacoes.js#L44-L52).

Aceitar com `ong: " ONG A "` grava com os espaços, e coletar com `"ONG A"` é recusado ("Apenas a ONG que aceitou..."). Aceitar com `ong: ""` funciona. Se o corpo não trouxer `ong`, vira uma ONG chamada `'ONG'`.

A Refatoração 2 criou o `normalizarOng`, mas ele só entrou em `coletar` e `cancelarReserva`, justamente as duas que não criam o nome. O teste "preserva o comportamento existente de aceite sem nome de ONG" ainda fixa isso como se estivesse certo. Sugerimos usar `normalizarOng` também em `aceitar` e tirar o `?? 'ONG'`. Isso muda comportamento, então fica melhor como correção de bug, num PR separado do de refatoração.

### F3. Todo erro vira 400 e mostra a mensagem do banco (média/alta)

Em [`src/app.js`, linhas 11 a 13](https://github.com/rique1011/prato-cheio/blob/d765b03/src/app.js#L11-L13) o `catch` responde 400 para tudo. Vimos três exemplos: `validade: "2030-02-31"` devolve "valor do campo date/time está fora do intervalo", id `abc` devolve "sintaxe de entrada é inválida para tipo integer", e id `99999999999` devolve "fora do intervalo para o tipo de dados integer". Pela leitura, e sem testar, uma queda do banco sairia do mesmo jeito.

Erro de regra e falha do servidor são coisas diferentes: quem chama leva 400 por algo que não foi culpa dele, e a resposta mostra nome de coluna e de tipo. Uma classe `ErroDeNegocio` para as recusas (400), com o resto indo para o log e voltando como 500 genérico, resolve. Como a Refatoração 1 já juntou o `try/catch` em `responderOperacao`, a mudança cabe num lugar só.

### F4. JSON malformado devolve uma página HTML com stack trace (média)

`POST /api/doacoes` com o corpo `{"tipo":` responde uma página HTML com `SyntaxError` do body-parser e caminhos de arquivo da máquina. Quem consome a API espera JSON. Um middleware de erro no fim do `criarApp()` que responda `{ erro: ... }` com 400 resolve.

### F5. A regra da validade não é a mesma em todo lugar (média)

[`src/doacoes.js`, linha 20](https://github.com/rique1011/prato-cheio/blob/d765b03/src/doacoes.js#L20) compara `new Date(validade) <= new Date()`. Validade igual a hoje é recusada na criação, mas a listagem e o aceite usam `validade >= CURRENT_DATE`, em que hoje ainda vale. `new Date()` também engole qualquer formato: `"12 Dec 2030"` foi gravada como 2030-12-12.

Um risco que não testamos: `CURRENT_DATE` é o dia do servidor do banco, que costuma estar em UTC. Depois das 21h no Brasil, uma doação que vence hoje já sumiria da lista. Sugerimos exigir `AAAA-MM-DD` com data real, comparar só o dia, e escolher uma regra (hoje vale ou não vale) para criação, listagem e aceite.

### F6. Id inválido só é barrado pelo banco (baixa/média)

Os ids `abc` e `99999999999` chegam até a consulta e voltam com texto do PostgreSQL (os mesmos casos da F3). O teste `EXTRA 2` confere só o status. Validar o id antes de consultar (inteiro positivo, dentro do limite do `INTEGER`) e responder "doação não encontrada".

### F7. Leitura que escreve no banco, e uma mensagem com dois sentidos (baixa)

`GET /api/doacoes` chama `liberarReservasExpiradas()`, que é um `UPDATE` ([`src/doacoes.js`, linhas 31 a 38](https://github.com/rique1011/prato-cheio/blob/d765b03/src/doacoes.js#L31-L38)). Está no ADR 0002, então foi escolha, mas coleta e cancelamento não fazem o mesmo. E o aceite usa a mesma mensagem para "já foi aceita" e "não existe". Mantenham a decisão, anotem o custo no ADR e, quando o aceite falhar, busquem a doação para dizer qual dos dois casos foi.

### F8. A `main` está vazia e o CI só roda na `atividade-3` (baixa)

Quem abre o repositório vê um projeto quase vazio. O [`ci.yml`](https://github.com/rique1011/prato-cheio/blob/d765b03/.github/workflows/ci.yml) só dispara em `push` e `pull_request` dessa branch, então um PR contra a `main` não roda teste nenhum. Integrar na `main`, ou trocar a branch padrão, e ajustar o gatilho.

### F9. Detalhes (baixa)

Os status `'disponivel'`, `'aceita'` e `'coletada'` estão escritos à mão no SQL e no `CHECK`, o mesmo cheiro que atacamos na nossa Refatoração 2. E há nomes de pessoa em comentários, como `// EXPIRAÇÃO AUTOMÁTICA DE RESERVAS — KAUÃ` e `describe('... - Kauã')`. O histórico do Git já diz quem fez.

## Para fechar

Nada disso reprova o projeto, são sugestões. Se for escolher só alguns, os três primeiros (F1, F2, F3), porque cada um se mostra com uma requisição só.

## Uso de IA

Usamos IA para ler o código, apontar candidatos e montar as requisições de teste. O que está marcado como reproduzido foi executado de verdade.

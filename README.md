# Prato Cheio — AKMS

Projeto da disciplina **Análise, Projeto e Desenvolvimento Ágil**.
Conecta doadores de alimentos excedentes a ONGs, antes que a comida se perca.

> Este repositório é a base do produto que evolui nas três unidades:
> walking skeleton (U1) → incremento guiado pelo projeto (U2) → produto refatorado (U3).

## Integrantes
- Victor Henrique Kunz de Souza — @VictorKunzz
- Lucas Rogério Mendonça — @mendoncaluucas
- Vinicius Steuernagel — @steuer10
- Alisson Gabriel Anderle — @MRanderle

**AKMS** são as iniciais dos sobrenomes dos integrantes: **A**nderle, **K**unz,
**M**endonça e **S**teuernagel.

> Este repositório foi criado por **Fork** do template da disciplina, porque o botão
> "Use this template" não estava disponível. Conteúdo, estrutura, CI e testes são
> idênticos aos do template.

## Como rodar

Requisitos: **Node.js 22.13 ou superior** e um **PostgreSQL** acessível por `DATABASE_URL`. O banco do grupo é o do Neon ([ADR 0002](docs/adr/0002-subida-postgresql.md)), mas para desenvolver dá para usar um PostgreSQL local descartável.

> Esta é a **stack preferencial** da disciplina. Se o seu grupo optar por outra, registre o ADR de justificativa e garanta os mesmos compromissos: repositório público com CI verde, rota de saúde, testes por um comando, os três comandos documentados aqui no README e banco relacional migrado para PostgreSQL na Unidade 3.

### Banco local com Docker

```bash
docker run -d --name pc-pg -e POSTGRES_USER=pratocheio -e POSTGRES_PASSWORD=pratocheio   -e POSTGRES_DB=pratocheio -p 5432:5432 postgres:18-alpine
```

Copie o `.env.example` para `.env`. Ele já traz a `DATABASE_URL` desse contêiner. Para usar o banco do grupo no Neon, peça a connection string a um integrante e troque a linha. **Nunca faça commit do `.env`.**

```bash
npm install       # só na primeira vez
npm run db:migrar # cria o schema
npm start         # sobe em http://localhost:3000
npm run dev       # sobe recarregando a cada alteração
```

Sem `DATABASE_URL` a aplicação não sobe e avisa o que falta.

### Testes

```bash
docker run -d --name pc-pg-teste -e POSTGRES_USER=pratocheio -e POSTGRES_PASSWORD=pratocheio   -e POSTGRES_DB=pratocheio -p 5433:5432 postgres:18-alpine
DATABASE_URL_TESTE=postgres://pratocheio:pratocheio@localhost:5433/pratocheio npm test
```

Os testes **apagam todas as doações** do banco a cada execução. Por isso o `npm test` só aceita a variável `DATABASE_URL_TESTE` e ignora a `DATABASE_URL`, mesmo que ela esteja definida no terminal. Sem `DATABASE_URL_TESTE` ele para e explica como subir um banco descartável. **Nunca aponte `DATABASE_URL_TESTE` para o Neon.**

No Windows (PowerShell), defina a variável antes: `$env:DATABASE_URL_TESTE = "postgres://pratocheio:pratocheio@localhost:5433/pratocheio"`.

## O banco: PostgreSQL

A aplicação usa só PostgreSQL ([ADR 0003](docs/adr/0003-migrar-sqlite-para-postgresql.md)). Nas Unidades 1 e 2 o banco era o SQLite embutido no Node, e a migração está registrada na Refatoração 1 de [`docs/refatoracoes.md`](docs/refatoracoes.md).

O `src/db.js` expõe `query()` devolvendo `{ rows }` e cuida do schema. A `validade` é uma coluna `DATE`, e a API continua recebendo e devolvendo texto `AAAA-MM-DD`. Quem já tinha a tabela com `validade` como texto não precisa fazer nada: `migrar()` converte a coluna ao subir o servidor, e rodar de novo não muda nada.

O CI sobe o seu próprio PostgreSQL descartável a cada execução e roda a mesma suíte nele.

## Estrutura

```
src/server.js        entrypoint (npm start)
src/db.js            conexão e schema do PostgreSQL
src/app.js           rotas da API
src/doacoes.js       regras de negócio      <- implementar (U1)
src/repositorio.js   acesso ao banco (SQL)  <- implementar (U1)
public/index.html    interface (funciona no celular)
tests/               testes automatizados
docs/analise.md      documento de análise   (Trabalho 1)
docs/projeto.md      documento de projeto   (Trabalho 2)
docs/adr/            decisões arquiteturais (Trabalho 2)
docs/validacao.md    validação e testes     (Trabalho 3)
docs/refatoracoes.md refatorações feitas    (Trabalho 3)
docs/demo.md         roteiro da demo        (Trabalho 3)
docs/retrospectivas/ retrospectiva de cada iteração
.github/workflows/   pipeline de CI
```

## Como trabalhar (fluxo de Pull Request)

A partir da Unidade 2, **nada entra direto na `main`**:

```bash
git checkout -b historia/ong-aceita-doacao
# ... implementa, escreve o teste, roda npm test ...
git commit -m "ONG aceita uma doação e ela sai da lista"
git push -u origin historia/ong-aceita-doacao
```

Abra o Pull Request no GitHub, preencha o template, espere o **CI ficar verde** e
peça a revisão de **outro integrante**. Só então faça o merge.

## Definição de pronto

Uma história só está pronta quando:

- [ ] todos os critérios de aceite estão escritos e atendidos;
- [ ] há teste para cada critério, incluindo as situações de erro, e a suíte passa;
- [ ] funciona na interface, e não só na API;
- [ ] entrou por Pull Request, revisado por outro integrante e com o CI verde;
- [ ] a documentação foi atualizada (`docs/projeto.md` e, se houve decisão nova, um ADR);
- [ ] se a IA gerou código, o PR registra o que foi mantido, o que mudou e por quê.

## O que já está pronto e o que falta

**Pronto — Unidade 1 (Análise):** o documento de análise completo (`docs/analise.md`) e o
**walking skeleton**: `src/doacoes.js` (regras de negócio), `src/repositorio.js` (SQL) e
7 testes em `tests/doacoes.test.js`, cobrindo os critérios de aceite. A história zero
funciona ponta a ponta — **um doador publica uma doação → uma ONG vê a doação → a ONG a
aceita e ela sai da lista** —, e a interface exibe as recusas da API.

**Em andamento — Unidade 2 (Projeto):** decisões de projeto e tabela de trade-offs em
`docs/projeto.md`, e os ADRs em `docs/adr/`, ambos aceitos: o 0001 define o escopo do
incremento e o 0002, como o PostgreSQL sobe na Unidade 3.

O incremento do ADR 0001 está implementado: doação com a janela vencida some da lista e
não pode mais ser aceita (RN2), a ONG confirma a coleta em `POST /api/doacoes/:id/coletar`,
e cada doação guarda a hora em que foi publicada, aceita e coletada. As colunas novas são acrescentadas ao subir o servidor.

**Pronto — Unidade 2 (Projeto):** H6b e H6c, diagramas, requisitos não-funcionais e
critérios de validação, no branch `entrega-2`.

**Em andamento — Unidade 3 (Construção):** H4a (doações que venceram sem aceite) e a
migração para PostgreSQL ([ADR 0003](docs/adr/0003-migrar-sqlite-para-postgresql.md)),
que o código já completa: o SQLite saiu do `src/db.js`.

## Uso de IA

A IA pode participar da produção, mas o grupo é responsável por verificar, testar,
corrigir e **defender** o resultado. Registre em cada Pull Request o que foi gerado
com IA e o que vocês alteraram.

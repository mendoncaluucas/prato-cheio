# ADR 0003 — Migrar o banco de SQLite para PostgreSQL

- **Data:** 08/10/2026
- **Status:** aceito
- **Reavaliado em:** 08/10/2026, para o cenário de várias cidades — decisão **mantida**
  (ver [ADR 0005](0005-reavaliacao-postgresql-varias-cidades.md))

> Atividade "ADR", item 1. A decisão de **onde** o PostgreSQL roda é outra, registrada no
> [ADR 0002](0002-subida-postgresql.md); este registro trata de **se** e **para qual banco**
> migrar.

## Contexto

O piloto começou com SQLite, pelo módulo `node:sqlite` embutido no Node: nada para
instalar, um arquivo `dados.sqlite` por máquina, e os testes rodando em memória. Para a
Unidade 1 e a Unidade 2 isso foi o certo — o grupo pôde focar na análise e no walking
skeleton sem montar infraestrutura.

O que pesa agora:

- **A disciplina exige** um banco relacional migrado para PostgreSQL na Unidade 3, com o
  CI verde. Isso é uma restrição do contexto, e não uma preferência do grupo.
- **O SQLite é um arquivo local.** Cada integrante tem os próprios dados, e não existe um
  banco que o grupo inteiro — ou mais de um servidor da aplicação — possa compartilhar.
- **O SQLite aceita um escritor por vez no banco inteiro.** Para um bairro isso basta; é
  um teto conhecido para quando houver mais acessos simultâneos.
- **O `node:sqlite` ainda é experimental.** Todo `npm test` imprime
  `ExperimentalWarning: SQLite is an experimental feature`: a interface pode mudar entre
  versões do Node.
- **A troca foi preparada desde o início.** O `src/db.js` expõe só `query()` devolvendo
  `{ rows }`, e o `ci.yml` já traz, comentado, o serviço `postgres` para o pipeline.

## Alternativas consideradas

1. **Manter o SQLite até o fim do projeto.**
   - Prós: zero mudança; nenhuma instalação; funciona sem internet.
   - Contras: descumpre a exigência da Unidade 3; mantém o banco preso a um arquivo local
     e a um escritor por vez; depende de um módulo experimental.
2. **Migrar para PostgreSQL.**
   - Prós: atende a disciplina; banco cliente-servidor que vários processos compartilham;
     trava por linha, e não pelo banco inteiro; suporta `RETURNING`, que o
     `src/repositorio.js` já usa em três consultas; o CI já tem o serviço preparado.
   - Contras: exige um servidor de banco acessível (resolvido pelo ADR 0002); a troca
     precisa ser feita sem quebrar os 18 testes existentes.
3. **Migrar para MySQL.**
   - Prós: também é cliente-servidor e muito difundido.
   - Contras: não atende a exigência da disciplina; não suporta `RETURNING`, o que obrigaria
     a reescrever as três consultas do repositório que dependem dele (inserir, aceitar e
     coletar) com uma segunda leitura após cada escrita.

## Decisão

**Alternativa 2: migrar para PostgreSQL na Unidade 3.**

A exigência da disciplina já eliminaria a alternativa 1, mas ela também seria a escolha
técnica: o banco passa a ser compartilhado, a escrita deixa de travar o banco inteiro e a
dependência de um módulo experimental desaparece. Entre os bancos cliente-servidor, o
PostgreSQL vence o MySQL por um motivo concreto do nosso código — o `RETURNING` —, não por
reputação: com ele, as consultas atuais migram quase sem alteração.

A troca fica contida em `src/db.js`. As regras de negócio (`src/doacoes.js`) e as rotas
(`src/app.js`) não mudam, e os testes existentes servem de prova de que o comportamento se
manteve.

## Consequências

- **Positivas:** banco compartilhado pelo grupo e pelo CI; fim do aviso de módulo
  experimental; a decisão D3 (condição no próprio `UPDATE`) continua valendo, agora com
  trava por linha; o tipo `DATE` permite guardar a `validade` como data, e não como texto.
- **Negativas / o que abrimos mão:** rodar a aplicação passa a exigir um banco
  acessível — e, com o ADR 0002, internet; o arquivo local que permitia "clonar e rodar"
  deixa de bastar.
- **Riscos e o que fazer se der errado:** diferenças de SQL entre os dois bancos, como o
  marcador de parâmetro (`?` no SQLite, `$1` no PostgreSQL), podem quebrar consultas. A
  mitigação é fazer a troca só no `src/db.js`, rodar os 18 testes contra o PostgreSQL no
  CI e só então ligar o banco do ambiente de desenvolvimento.

## Rastreabilidade

Atende a exigência de banco relacional migrado para PostgreSQL na Unidade 3 (README) e
mantém a garantia da RNI2 e do critério CA3.2 (decisão D3). Hospedagem no
[ADR 0002](0002-subida-postgresql.md).

## Uso de IA

A IA foi usada para consultar e comparar as alternativas e levantar as consequências. A
decisão e a escolha das justificativas são do grupo.

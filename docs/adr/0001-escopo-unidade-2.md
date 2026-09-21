# ADR 0001 — Escopo da Unidade 2: qual regra adiada entra agora

- **Data:** 21/09/2026
- **Status:** proposto (aguarda ratificação do grupo até 08/10)

## Contexto
O `docs/analise.md` deixou três regras de negócio fora do walking skeleton da Unidade 1
por exigirem dados que o modelo não tinha: RN2 (janela de retirada), RN4 (prioridade por
proximidade) e RNI3 (devolver à lista quando não há coleta). O risco R2 (doação aceita e
não coletada, ficando presa) segue registrado como mitigado apenas por acompanhamento
manual. A Unidade 2 exige decidir quanto desse débito entra no incremento agora.

## Alternativas consideradas
1. **Só RN2 (janela de retirada)** — usa um campo que já existe no schema (`validade`),
   esforço baixo, mitiga parte de R2 ao deixar de mostrar doações com janela vencida.
2. **RN2 + RNI3** — além da janela, devolve a doação à lista quando a coleta não é
   confirmada a tempo. Mitiga R2 por completo, mas exige um mecanismo de checagem de
   expiração (job ou verificação na leitura).
3. **RN2 + RN4 + RNI3 (as três regras adiadas)** — fecha o domínio descrito na Análise,
   mas RN4 exige geolocalização e cálculo de distância, dado que a Unidade 1 não coletou
   nem testou em campo.

## Decisão
Uma **variação da alternativa 1**: implementar a **RN2 por completo** e construir a
**confirmação de coleta** — que é a base de que a RNI3 depende — sem implementar a RNI3
em si. A RN4 fica para depois do piloto.

Em concreto, o incremento da Unidade 2 é:

1. **RN2** — a listagem passa a filtrar por janela: doação com `validade` anterior a hoje
   não aparece mais em `GET /api/doacoes`.
2. **Status `coletada`** e a rota `POST /api/doacoes/:id/coletar`, fechando o ciclo de
   vida da doação, que hoje termina em `aceita` e nunca mais muda.
3. **Marcas temporais** `aceita_em` e `coletada_em`, no mesmo formato de `criada_em`.

**Por que a RN2 entra agora.** A Análise agrupou a RN2 com a RN4 e a RNI3 como regras que
"exigem dados que ainda não temos", listando hora da coleta, localização e confirmação de
retirada. Revendo, nenhum desses três é requisito da RN2: o critério de verificação dela é
que uma doação com janela vencida não apareça na listagem, e isso se resolve com o campo
`validade`, que já existe e já é usado pela RNI1 para recusar publicação vencida. A RN2
foi classificada junto com as outras por engano. Implementá-la é corrigir um recorte
conservador demais, não ampliar escopo — e custa um filtro na consulta.

**Por que a confirmação de coleta entra junto.** Sozinha, a RN2 seria um incremento
pequeno demais para a unidade. Mais importante: o experimento registrado na Análise mede
"os instantes de publicação, aceite e coleta confirmada", e hoje **apenas o primeiro
existe** — o `criada_em` vem do schema, o aceite não grava hora nenhuma e não há qualquer
noção de coleta. Como está, o experimento que nós mesmos propusemos é inexecutável, e o
Objetivo de Impacto 1 (reduzir o tempo entre disponível e coletada) não tem como ser
medido. Fechar o ciclo de vida da doação e registrar as três marcas resolve isso.

Há ainda um efeito sobre o risco R2: hoje uma doação aceita fica presa em nome da ONG
para sempre, porque não existe estado seguinte. Com `coletada`, passa a ser possível
distinguir a doação que cumpriu seu destino daquela que ficou parada — que é exatamente a
informação que a RNI3 precisa para decidir devolvê-la à lista.

**Por que a RNI3 completa fica de fora.** Devolver a doação à lista quando a janela expira
exige um mecanismo de expiração — job agendado ou verificação na leitura —, e registrar o
não-comparecimento exige uma entidade ONG que não existe: hoje `ong` é texto livre, sem
cadastro. São duas construções novas, e a Unidade 3 já carrega a migração para PostgreSQL.
A Unidade 2 entrega a base; a RNI3 entra quando houver cadastro de ONG.

**Por que a RN4 fica de fora.** Prioridade por proximidade exige cadastro de ONG com
endereço, geocodificação e cálculo de distância. É a maior das três e a que menos se
apoia no que existe. Além disso, a Análise registra que não há medição confirmando que a
distância seja o gargalo — a hipótese aponta o tempo até a coleta, e é justamente isso
que este incremento passa a medir. Decidir sobre a RN4 depois de ter o dado é melhor que
decidir agora sem ele.

## Consequências
- Positivas: a RN2 passa a valer, com custo de uma cláusula na consulta; o ciclo de vida
  da doação deixa de ter um estado final morto; o experimento da Análise e o Objetivo de
  Impacto 1 tornam-se mensuráveis; a base da RNI3 fica pronta para a Unidade 3.
- Negativas / o que abrimos mão: a RNI3 e a RN4 seguem apenas registradas, e a mitigação
  do risco R2 continua dependendo de acompanhamento manual — o sistema passa a *saber* que
  a coleta não aconteceu, mas ainda não age sozinho. Uma doação aceita e não coletada
  continua fora da lista até alguém intervir.
- Riscos e o que fazer se der errado: acrescentar `aceita_em` e `coletada_em` altera o
  schema, e o `CREATE TABLE IF NOT EXISTS` do `src/db.js` não modifica tabela existente —
  quem já tiver `dados.sqlite` precisa apagá-lo ou rodar uma migração. Os testes não são
  afetados, por usarem SQLite em memória. Se a alteração de schema se mostrar mais
  trabalhosa que o previsto, o recorte mínimo defensável é entregar só a RN2 e adiar as
  marcas temporais, registrando que o experimento fica inexecutável até a Unidade 3.

## Rastreabilidade
Atende ao risco R2 (`docs/analise.md`) e, dependendo da alternativa escolhida, às regras
RN2, RN4 e/ou RNI3.

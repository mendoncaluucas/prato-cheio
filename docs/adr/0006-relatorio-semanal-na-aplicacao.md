# ADR 0006 — Calcular o relatório semanal na aplicação, e não em SQL

- **Data:** 16/10/2026
- **Status:** aceito

## Contexto

A história H6b pede que a Marta veja, a cada semana, quantas das doações publicadas
terminaram coletadas. É a forma de medir o **Objetivo de Impacto 2** (reduzir o descarte
de comida boa) e, com a mediana de horas até a coleta, o **experimento da hipótese**
ligado ao Objetivo 1. As marcas de hora que o relatório usa — `criada_em` e
`coletada_em` — existem desde o incremento do ADR 0001.

Montar o relatório exige **agrupar as doações por semana**. Duas coisas pesam:

- **O banco vai mudar.** O [ADR 0003](0003-migrar-sqlite-para-postgresql.md) decide
  migrar de SQLite para PostgreSQL na Unidade 3, e as funções de data dos dois são
  diferentes: no SQLite, `strftime` e `date(…, 'weekday 0')`; no PostgreSQL, `date_trunc`.
- **O volume do piloto é pequeno.** Um bairro, poucas doações por dia.

## Alternativas consideradas

1. **Agrupar em SQL, com as funções de data do SQLite.**
   - Prós: só os totais saem do banco; é a forma mais eficiente.
   - Contras: a consulta fica presa ao dialeto do SQLite e precisa ser reescrita na
     migração para o PostgreSQL; a regra de negócio da taxa (tirar as retiradas do
     denominador) fica escondida dentro do SQL, longe das outras regras.
2. **Ler as linhas com SQL comum e agrupar em JavaScript, em `src/doacoes.js`.**
   - Prós: a consulta (`SELECT criada_em, status, validade, coletada_em …`) funciona igual
     nos dois bancos; as regras do relatório ficam junto das outras regras de negócio e
     podem ser testadas como função pura, sem banco.
   - Contras: traz todas as linhas para a aplicação, e o custo cresce com o volume.
3. **Manter uma tabela de resumo atualizada a cada publicação, aceite, coleta e retirada.**
   - Prós: leitura instantânea, qualquer que seja o volume.
   - Contras: quatro pontos de escrita para manter em sincronia, e um erro em qualquer um
     deles produz um relatório errado sem que ninguém perceba.

## Trade-offs

| Critério | 1. SQL do SQLite | 2. JavaScript | 3. Tabela de resumo |
|---|---|---|---|
| Sobrevive à migração para PostgreSQL | **não** — reescrever | **sim** | depende de como for feita |
| Desempenho com muitas doações | **ótimo** | cai com o volume | **ótimo** |
| Onde ficam as regras da taxa | escondidas no SQL | **junto das outras regras** | espalhadas por quatro escritas |
| Facilidade de testar | precisa de banco | **função pura** | precisa testar a sincronia |
| Complexidade | baixa | **baixa** | alta |

## Decisão

**Alternativa 2: agrupar em JavaScript.**

A alternativa 1 é a mais rápida, mas é rapidez de que o piloto não precisa, e ela custa
uma reescrita garantida dentro de poucas semanas. A alternativa 3 resolve um problema de
volume que ainda não existe, ao preço de quatro lugares onde o relatório pode sair errado
em silêncio.

Com a 2, a regra mais discutível do relatório — tirar as retiradas do denominador da taxa,
porque alimento impróprio não é comida boa desperdiçada — fica legível e testável no mesmo
arquivo das outras regras. A função `montarRelatorioSemanal` recebe as linhas e a data de
hoje e devolve as semanas, sem tocar no banco.

## Consequências

- **Positivas:** a migração do ADR 0003 não precisa mexer no relatório; as regras do
  relatório têm testes próprios, inclusive um que chama a função direto para pegar um
  `NaN` que a API esconderia, porque o JSON o converte em `null`.
- **Negativas / o que abrimos mão:** cada consulta ao relatório lê todas as doações. No
  cenário de várias cidades do [ADR 0005](0005-reavaliacao-postgresql-varias-cidades.md)
  isso deixa de servir.
- **A semana é a da hora gravada, em UTC.** Uma doação publicada num domingo depois das
  21h, no horário de Brasília, entra na semana seguinte. Para um relatório semanal o desvio
  é pequeno, e corrigi-lo exigiria fixar um fuso no servidor.
- **Riscos e o que fazer se der errado:** se o volume crescer, o gatilho é o tempo de
  resposta do relatório. Aí a troca natural é a alternativa 1, já no PostgreSQL, com
  `date_trunc('week', …)`. Os testes do relatório servem para provar que o resultado
  continua o mesmo.

## Rastreabilidade

H6b; Objetivo de Impacto 2 (taxa de coleta) e Objetivo de Impacto 1 com o experimento da
hipótese (mediana de horas até a coleta); ADR 0001 (as marcas de hora); ADR 0003 (a
migração que motiva a escolha); H6c (as retiradas, fora do denominador).

## Uso de IA

IA usada como apoio ao desenvolvimento, para comparar as alternativas e levantar os
trade-offs. A decisão é do grupo.

# Validação — Prato Cheio

*Trabalho 3 · confronto do produto com os critérios de aceite escritos na Unidade 1*

Copie aqui os critérios de aceite do seu `docs/analise.md` e marque um por um. **Um "não atende" bem justificado vale mais que um "sim" sem evidência.**

| # | Critério de aceite (da Unidade 1) | Atende? | Evidência |
|:--:|---|:--:|---|
| 1 |  | sim / parcial / não | teste, demo, execução do CI |
| 2 |  |  |  |
| 3 |  |  |  |

## Critérios que não atendem — por quê

(Para cada "parcial" ou "não": o que falta, por que ficou de fora e o que seria necessário.)

## Mudanças de critério ao longo do semestre

(Algum critério da Unidade 1 se mostrou errado ou impossível? Qual, e o que aprenderam com isso.)

## Testes da H4a e inversão de regras

Os `it.todo` do template foram trocados por testes de verdade na história zero (commit
`2d8d118`), e cada história seguinte entrou com os seus. Os critérios da H4a estão em
`docs/projeto.md`, e os testes no bloco `vencidas sem aceite (H4a)` de
`tests/doacoes.test.js`.

**Casos que os critérios não previam:**

| Caso | Por que importa | Prova de que o teste funciona |
|---|---|---|
| Duas doações vencem no mesmo dia | sem desempate, a ordem poderia mudar entre duas consultas | invertendo o desempate para `id DESC`, só este teste falha |
| Nenhuma doação venceu sem aceite | a interface depende de `200` com lista vazia para mostrar a mensagem | fazendo a rota recusar lista vazia, este teste falha, e 2 dos anteriores também |

O segundo caso se sobrepõe em parte aos critérios CA4a.2 e CA4a.3, que também esperam lista
vazia. O que ele acrescenta é conferir o status `200` e não depender de haver doações no banco.

**Inversão de regras.** Cada regra foi invertida, a suíte de 71 testes rodou, e a alteração
foi desfeita:

| Regra invertida | Onde | Falharam | Continuaram verdes |
|---|---|:--:|:--:|
| H4a: `validade < hoje` virou `validade >= hoje` | `src/repositorio.js` | 5 | 66 |
| RN2 no aceite: `validade < hoje` virou `validade >= hoje` | `src/doacoes.js` | 12 | 59 |

Os testes pegaram as duas inversões. A maioria dos verdes cobre funcionalidades que não
passam por essas regras. Dentro do bloco da H4a, 2 dos 7 testes continuaram verdes na
primeira inversão: o que confere doações aceitas, coletadas ou retiradas e o de lista vazia.
Eles esperam uma lista vazia, e a inversão não muda isso quando o banco não tem doação
disponível. A regra da data é protegida pelos outros 5.

## Uso de IA

(O que foi gerado com IA nesta iteração, o que vocês verificaram e o que alteraram.)

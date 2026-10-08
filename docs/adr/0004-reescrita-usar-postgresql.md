# ADR 0004 — Usar PostgreSQL (reescrita de um registro incompleto)

- **Data:** 08/10/2026
- **Status:** aceito — complementa o [ADR 0003](0003-migrar-sqlite-para-postgresql.md)

> Atividade "ADR", item 2. Este registro parte de um ADR incompleto e o reescreve. A
> decisão final coincide com a do ADR 0003; o objetivo aqui é mostrar a diferença entre
> uma justificativa genérica e uma justificativa ancorada no projeto.

## O registro original

> "Decidimos utilizar PostgreSQL porque é um banco melhor."

### O que falha nele

| Problema | Por que é um problema |
|---|---|
| **Não tem contexto** | Não diz que problema exigia a decisão. Quem lê não sabe se o banco atual falhou, se houve uma exigência externa ou se foi gosto. |
| **"Melhor" sem comparação** | Melhor do que qual banco, e em qual critério? Sem a alternativa, a frase não pode ser verificada nem contestada. |
| **Não tem alternativas** | Nenhuma outra opção aparece. Não dá para saber se alguma foi considerada e por que perdeu. |
| **Não tem consequências** | Toda escolha cobra algo. O registro não diz o que o projeto passa a exigir, nem o que pode dar errado. |
| **Não se liga a nada do projeto** | O motivo serviria para qualquer sistema. Uma justificativa boa só faz sentido para este. |

## A reescrita

### Contexto

O Prato Cheio guarda as doações numa única tabela, `doacoes`, cujos campos são fixos e
conhecidos: tipo, quantidade, validade, status, ONG e três marcas de hora. O ciclo de vida
de uma doação é uma sequência de estados (`disponivel → aceita → coletada`), e a regra
mais sensível do domínio — a RNI2, "quem chega primeiro leva" — depende de o banco mudar o
status de forma atômica quando duas ONGs aceitam ao mesmo tempo.

Hoje o banco é SQLite, e a Unidade 3 exige um banco relacional migrado para PostgreSQL
(ADR 0003). A pergunta aqui é qual banco cliente-servidor atende melhor **este** modelo de
dados e **este** código.

### Alternativas consideradas

1. **PostgreSQL**
   - Prós: relacional, adequado a uma tabela de campos fixos; suporta `RETURNING`, que o
     `src/repositorio.js` usa em três consultas (inserir, aceitar e coletar); o `UPDATE`
     condicional da decisão D3 trava só a linha disputada; tem tipo `DATE` para a
     validade; o `ci.yml` já traz o serviço `postgres` pronto; é o banco que a disciplina
     exige.
   - Contras: exige um servidor de banco acessível; marcador de parâmetro diferente do
     SQLite (`$1` em vez de `?`).
2. **MySQL**
   - Prós: relacional, cliente-servidor e muito usado.
   - Contras: não suporta `RETURNING` — cada inserção e cada mudança de status passaria a
     precisar de uma segunda consulta para devolver a linha, e as três funções do
     repositório teriam de ser reescritas; não atende a exigência da disciplina.
3. **MongoDB (banco de documentos)**
   - Prós: esquema flexível; atualização atômica de um documento com filtro, o que também
     resolveria a disputa da RNI2.
   - Contras: os dados não têm a variação de forma que justifica um banco de documentos —
     são campos fixos de uma tabela só; abandona o SQL, então o repositório inteiro e a
     migração do `src/db.js` seriam refeitos; não é relacional, e a disciplina exige um
     banco relacional.

### Decisão

**Alternativa 1: PostgreSQL.**

Ele é o único dos três que atende a exigência da disciplina, e é também o que menos mexe no
código existente: as consultas com `RETURNING` migram quase intactas, e a garantia da RNI2
continua no próprio `UPDATE`. O MySQL obrigaria a dividir cada escrita em duas consultas,
e o MongoDB, a refazer a camada de dados por um tipo de flexibilidade que estes dados não
pedem.

Não é que o PostgreSQL seja "melhor" em geral: é o que serve para uma tabela de campos
fixos, com mudança de status disputada e consultas que já usam `RETURNING`.

### Consequências

- **Positivas:** a camada de regra de negócio não muda; a RNI2 continua garantida no
  banco, com trava por linha; a validade pode passar a ser `DATE`, em vez de texto
  comparado como `AAAA-MM-DD`.
- **Negativas / o que abrimos mão:** um servidor de banco passa a ser necessário para
  rodar e testar a aplicação; perde-se a simplicidade do arquivo local.
- **Riscos e o que fazer se der errado:** consultas que dependem de comportamento
  específico do SQLite podem falhar na troca. Os 18 testes rodando contra o PostgreSQL no
  CI mostram o que quebrou antes de a mudança chegar à `main`.

### Rastreabilidade

RNI2 e critério CA3.2 (via decisão D3); exigência de PostgreSQL na Unidade 3 (README);
ADR 0003 (migrar) e ADR 0002 (onde o banco roda).

## Uso de IA

A IA foi usada para consultar e comparar as alternativas e levantar as consequências. A
decisão, o diagnóstico do registro original e a escolha das justificativas são do grupo.

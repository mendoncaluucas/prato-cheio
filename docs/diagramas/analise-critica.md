# Análise crítica dos diagramas gerados pela IA

Os diagramas analisados são os da [versão original](original-ia.md), gerada a partir do
[prompt](prompt-ia.md). Cada problema foi confrontado com as histórias de usuário, as
regras de negócio, os ADRs e o código do repositório. As referências a linhas de código são
da versão final do sistema, com as histórias H6b e H6c e as correções integradas.

A atividade pede no mínimo dois problemas. Registramos quatro, dois em cada diagrama.

| # | Diagrama | Problema em uma frase | Tipo |
|---|---|---|---|
| 1 | Estados | "Vencida" foi desenhado como um estado, mas não existe no banco | inconsistência com a estrutura de dados |
| 2 | Estados | A volta de "Aceita" para "Disponível" (RNI3) não foi implementada; o estado "retirada" (H6c) falta | inconsistência com a implementação e elemento ausente |
| 3 | Sequência | A verificação em `doacoes.js` foi omitida, e o `UPDATE` aparece barrando a segunda ONG | responsabilidade atribuída à camada errada |
| 4 | Sequência | As duas ONGs aparecem uma depois da outra: a concorrência que motiva a decisão D3 não aparece | uso inadequado da notação e fluxo alternativo ausente |

---

## Problema 1 — "Vencida" não é um estado

**Problema.** O diagrama de estados tem um estado *Vencida*, com a transição
`Disponivel --> Vencida : Janela de retirada expira (RN2)` e um fim a partir dele.

**Justificativa.** O estado de uma doação é a coluna `status` da tabela `doacoes`
(`src/db.js`, linha 46), e ela só assume quatro valores: `disponivel`, `aceita`, `coletada`
e `retirada`. Nenhum código grava `vencida`. A RN2 é implementada como um **filtro de
leitura**: a listagem esconde a doação com `validade` anterior a hoje
(`src/repositorio.js`, `listarDisponiveis`), e o aceite a recusa
(`src/doacoes.js`, `aceitar`). A doação continua com `status = 'disponivel'` no banco.

A diferença importa no Prato Cheio por dois motivos. Primeiro, o diagrama sugere um evento
que muda o registro — e nada acontece "quando a janela expira": não há tarefa agendada
(ADR 0001). Segundo, o relatório semanal da H6b conta "vencidas" justamente **olhando a
data**, e não o status. Quem implementasse a partir do diagrama criaria um status que o
resto do sistema não conhece.

**Correção.** O estado *Vencida* sai do diagrama. A expiração aparece como **condição de
guarda** nas transições: *Aceitar* só ocorre se `validade >= hoje`. Uma nota explica que
"vencida" é derivada da data, e não um valor do status.

## Problema 2 — Uma transição que não existe, e um estado que falta

**Problema.** O diagrama tem a transição
`Aceita --> Disponivel : Coleta não confirmada até o fim da janela (RNI3)`. E não tem o
estado de doação retirada.

**Justificativa.** A RNI3 foi deixada de fora **de propósito** no ADR 0001 (seção "Por que
a RNI3 completa fica de fora"): devolver a doação à lista exige um mecanismo de expiração e
um cadastro de ONG, que o sistema não tem. No código, nenhuma operação leva uma doação de
`aceita` de volta a `disponivel`. O diagrama descreve uma regra registrada como **adiada**,
como se estivesse pronta — exatamente o tipo de inconsistência entre documento e código que
o professor pede para evitar.

O estado *retirada* faltava porque a H6c ainda não existia quando o prompt foi escrito. Mas
a H6c mudou as regras de transição: uma doação **disponível ou aceita** pode ser retirada, e
uma **coletada** não pode (`src/repositorio.js`, linha 88: `WHERE id = ? AND status IN
('disponivel', 'aceita')`). Sem esse estado, o diagrama não mostra a resposta do sistema à
vigilância sanitária.

**Correção.** A transição da RNI3 sai; uma nota registra que ela está adiada pelo ADR 0001.
Entra o estado **Retirada**, com as transições a partir de *Disponível* e de *Aceita*, e o
motivo obrigatório indicado como condição. Entra também o caso de **coleta depois do
vencimento**, que é permitida mas contada à parte no relatório.

## Problema 3 — A verificação da aplicação foi omitida

**Problema.** No diagrama de sequência, as *Regras* repassam o aceite direto ao
*Repositório*, que executa o `UPDATE`. Para a ONG B, o banco devolve "0 linhas" e a recusa
sai daí. A consulta da doação e a verificação de status feitas em `src/doacoes.js` não
aparecem.

**Justificativa.** No código, antes do `UPDATE`, a função `aceitar` busca a doação
(`src/doacoes.js`, linha 92) e verifica o status (linha 99). Quando a ONG B chega depois da
ONG A, **é essa verificação que a barra** — o `UPDATE` nem é executado. O diagrama atribui a
recusa à camada errada.

Isso não é detalhe. A decisão D3 tem duas peças com papéis diferentes: a verificação da
aplicação produz a **mensagem certa** ("doação não encontrada", "já foi aceita", "foi
retirada"), e a condição do `UPDATE` **garante a regra** quando as duas requisições chegam
juntas. O diagrama da IA mostra só a segunda peça. Lido assim, a verificação de
`doacoes.js` parece código redundante — e é exatamente a pergunta que a decisão precisa
responder.

**Correção.** O diagrama passa a mostrar `buscarPorId` e a verificação de status antes do
`UPDATE`, com um bloco `alt` para os casos de recusa (não encontrada, retirada, já aceita,
vencida), cada um com a sua mensagem.

## Problema 4 — A concorrência não aparece

**Problema.** As duas ONGs foram desenhadas em sequência: a ONG A faz toda a operação e
recebe 200; só depois a ONG B começa. A explicação diz que a condição do `UPDATE` "garante a
RNI2 mesmo que as duas requisições cheguem ao mesmo tempo", mas o desenho não mostra esse
caso.

**Justificativa.** Com as mensagens em sequência, a ONG B é barrada pela verificação da
aplicação (problema 3), e a condição do `UPDATE` nunca precisaria agir. O caso que justifica
a decisão D3 é outro: as duas ONGs passam pela verificação **antes** de qualquer gravação,
porque as duas leram a doação ainda disponível. Esse é o único cenário em que o `UPDATE`
condicional faz diferença, e o diagrama não o representa. O UML tem a notação para isso — o
fragmento `par` —, que não foi usada.

**Correção.** O diagrama final usa um fragmento `par` com as duas ONGs lendo a doação
disponível ao mesmo tempo. O banco executa os dois `UPDATE` um depois do outro: o primeiro
atualiza a linha e o segundo encontra `status = 'aceita'`, não altera nada e devolve zero
linhas. A aplicação converte esse resultado na recusa da ONG B (`src/doacoes.js`,
linha 111).

---

## O que conferimos para chegar aos problemas

- A coluna `status` e seus valores possíveis, em `src/db.js` e em todos os `UPDATE` de
  `src/repositorio.js`.
- As decisões D1 (ADR 0001) e D3 (`docs/projeto.md`), e a seção do ADR 0001 que adia a
  RNI3.
- A ordem das chamadas em `aceitar`, `coletar` e `retirar`, em `src/doacoes.js`.
- Os testes `garantias no próprio UPDATE (decisão D3)`, em `tests/doacoes.test.js`, que
  provam que a condição do `UPDATE` recusa sozinha quando a verificação da aplicação é
  pulada — o cenário do problema 4.

As versões corrigidas estão em [`estados.md`](estados.md) e [`sequencia.md`](sequencia.md).

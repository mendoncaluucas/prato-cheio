# ADR 0001 — Escopo da Unidade 2: qual regra adiada entra agora

- **Data:** [PREENCHER]
- **Status:** proposto

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
3. **RN2 +

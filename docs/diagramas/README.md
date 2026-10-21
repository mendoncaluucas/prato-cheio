# Diagramas do Prato Cheio

Atividade avaliativa da N2: representar decisões de projeto com diagramas, usando IA como
apoio à modelagem, e avaliar criticamente o que a IA produziu.

**Ferramenta de IA:** Claude (modelo Claude Opus 5.5), pelo Claude Code.
**Ferramenta de diagramação:** Mermaid — o GitHub desenha os diagramas direto na página de
cada arquivo.

## Onde está cada item da atividade

| Item pedido | Arquivo |
|---|---|
| Parte 1 — os dois diagramas escolhidos e a justificativa | [`justificativa.md`](justificativa.md) |
| Parte 2 — o prompt dado à IA | [`prompt-ia.md`](prompt-ia.md) |
| Parte 2 — as versões iniciais produzidas pela IA, sem correção | [`original-ia.md`](original-ia.md) |
| Parte 3 — os problemas identificados, com justificativa e correção | [`analise-critica.md`](analise-critica.md) |
| Parte 4 — versão final do diagrama de estados | [`estados.md`](estados.md) |
| Parte 4 — versão final do diagrama de sequência | [`sequencia.md`](sequencia.md) |
| Reflexão final | [`reflexao.md`](reflexao.md) |

## Os dois diagramas, em uma linha

- **Estados** — por quais estados uma doação passa e quais eventos a fazem mudar.
- **Sequência** — como as camadas do sistema colaboram quando duas ONGs tentam aceitar a
  mesma doação.

## Como verificar que a versão original veio antes das correções

A versão da IA foi commitada sozinha, antes de qualquer correção:

```bash
git log --oneline -- docs/diagramas/original-ia.md
```

O commit `4981976` traz apenas `prompt-ia.md` e `original-ia.md`. A análise crítica e as
versões finais vêm em commits posteriores, e o `original-ia.md` não foi alterado depois.

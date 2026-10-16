# Prompt usado para gerar a primeira versão dos diagramas

- **Ferramenta:** Claude (modelo Claude Opus 5.5), pelo Claude Code
- **Data:** 07/10/2026
- **Resposta obtida:** [`original-ia.md`](original-ia.md), guardada sem alterações

O prompt traz o que a atividade pede para fornecer à IA — caso, histórias, regras de
negócio e decisões de projeto — e **não inclui o código-fonte**. Limitação registrada: a
mesma ferramenta tinha acesso ao repositório na sessão; a resposta foi produzida a partir
do prompt abaixo, numa única passada, sem consultar o código.

---

Você é um analista de sistemas. Gere dois diagramas UML em Mermaid para o sistema descrito
abaixo.

## Contexto

Prato Cheio é um piloto que conecta doadores de alimentos excedentes (restaurantes,
padarias, mercados) a ONGs e cozinhas comunitárias, para que a comida seja coletada antes
de estragar. Hoje essa articulação acontece por grupos de WhatsApp, sem histórico.

## Histórias de usuário implementadas

- **H1:** Como doador, quero publicar uma doação informando tipo, quantidade e validade,
  para que uma ONG a recolha antes de estragar.
- **H2:** Como ONG, quero ver as doações disponíveis agora, para decidir o que consigo
  buscar hoje.
- **H3:** Como ONG, quero aceitar uma doação disponível, para garantir que ninguém mais vá
  buscá-la.
- **Incremento da Unidade 2:** a ONG confirma a coleta da doação que aceitou.

## Regras de negócio

- **RN1:** O sistema recusa uma doação que não informe tipo do alimento, quantidade e
  validade/janela de retirada.
- **RN2:** Uma doação só fica disponível enquanto estiver dentro da sua janela de retirada.
- **RN3:** Ao ser aceita por uma ONG, a doação deixa de estar disponível para as demais.
- **RN4:** Entre ONGs candidatas, a mais próxima do doador tem prioridade de exibição.
- **RNI1:** O sistema recusa publicar doação cuja validade já esteja vencida no momento da
  publicação.
- **RNI2:** Quando duas ONGs aceitam a mesma doação, a primeira registrada fica com ela; a
  segunda recebe uma recusa explícita dizendo que já foi aceita.
- **RNI3:** Se a coleta não for confirmada até o fim da janela, a doação volta para a
  lista e o não-comparecimento fica registrado na ONG.

## Decisões de projeto

- **D1 (ADR 0001):** a Unidade 2 implementa a RN2 e a confirmação de coleta (status
  `coletada`, com a hora do aceite e da coleta). A RNI3 completa e a RN4 ficam de fora.
- **D2 (ADR 0002):** na Unidade 3, o banco passa de SQLite para PostgreSQL em serviço
  gerenciado.
- **D3:** para impedir que duas ONGs aceitem a mesma doação, a condição de status fica no
  próprio `UPDATE` do banco (`WHERE id = ? AND status = 'disponivel'`), e não apenas numa
  verificação anterior na aplicação.

## Arquitetura

API HTTP em Node.js com Express, em três camadas: as rotas (`app.js`) traduzem HTTP; as
regras de negócio (`doacoes.js`) validam; o repositório (`repositorio.js`) executa SQL num
banco SQLite. Recusas de regra voltam como HTTP 400 com `{ erro }`.

## O que gerar

1. **Diagrama de estados** (Mermaid `stateDiagram-v2`) dos estados de uma doação e dos
   eventos que mudam o estado.
2. **Diagrama de sequência** (Mermaid `sequenceDiagram`) da operação "ONG aceita uma
   doação", incluindo o caso de duas ONGs tentando aceitar a mesma doação.

Responda com os dois blocos Mermaid e uma explicação curta de cada um.

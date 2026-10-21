# Escolha dos diagramas

O grupo escolheu dois diagramas que respondem a perguntas diferentes sobre o Prato Cheio:
um olha para a **vida de uma doação ao longo do tempo**, o outro para **o que acontece
dentro do sistema durante uma única operação**.

| Diagrama | Pergunta que responde | Decisão de projeto que ele expõe |
|---|---|---|
| **Estados (UML)** | Por quais estados uma doação passa, e quais eventos a fazem mudar? | [ADR 0001](../adr/0001-escopo-unidade-2.md): o ciclo `disponivel → aceita → coletada`, e a H6c, que acrescenta `retirada` |
| **Sequência (UML)** | Como as camadas do sistema colaboram quando duas ONGs tentam aceitar a mesma doação? | Decisão **D3** do [`projeto.md`](../projeto.md): a condição de status dentro do próprio `UPDATE` |

## Por que o diagrama de estados

O núcleo do domínio é o **status da doação**. As regras de negócio mais importantes são,
no fundo, regras sobre transições: só se aceita o que está disponível (RN3), quem chega
primeiro leva (RNI2), só se coleta o que foi aceito, e o que já foi coletado não pode mais
ser retirado (H6c).

Esse status é **uma coluna da tabela `doacoes`**, que só pode ter quatro valores. Isso torna
o diagrama verificável: cada estado desenhado precisa existir no banco, e cada transição
precisa corresponder a uma rota da API. É o diagrama que melhor expõe se o modelo está
coerente com a implementação, como pede a Parte 4.

## Por que o diagrama de sequência

A decisão técnica mais delicada do projeto não se vê numa lista de estados: ela está em
**quem decide**, e **em que momento**, que a segunda ONG perde. A garantia está em duas
camadas — uma verificação em `src/doacoes.js` e a condição no `UPDATE` de
`src/repositorio.js` — e cada uma tem um papel diferente.

O diagrama de sequência mostra a ordem das mensagens entre a interface, as rotas, as regras,
o repositório e o banco. Com ele dá para responder à pergunta que a decisão D3 levanta: se a
aplicação já verifica, por que verificar de novo no banco?

## Por que não os outros

| Diagrama | Por que não foi escolhido |
|---|---|
| Casos de uso | Os atores e as funcionalidades já estão claros nas histórias de usuário; o diagrama repetiria o `analise.md` sem expor nenhuma decisão de projeto |
| Classes | O sistema não tem classes de domínio: são módulos com funções sobre uma única tabela |
| DER | O banco tem uma tabela só; o diagrama mostraria uma caixa |
| Atividades | Útil para um processo com muitos caminhos, mas o fluxo da doação é melhor representado pelos estados que ela assume |
| Componentes | As três camadas e suas dependências já aparecem como participantes no diagrama de sequência |

## Ferramenta

**Mermaid**, em arquivos Markdown versionados neste repositório. O GitHub desenha os
diagramas direto na página do arquivo, o texto pode ser editado e revisado num Pull Request
como qualquer código, e o histórico do git registra cada versão — inclusive a original da IA.

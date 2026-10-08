# ADR 0005 — Reavaliação do ADR 0003 para operação em várias cidades

- **Data:** 08/10/2026
- **Status:** aceito
- **Conclusão:** o [ADR 0003](0003-migrar-sqlite-para-postgresql.md) é **mantido**. O
  [ADR 0002](0002-subida-postgresql.md) é mantido para o piloto, com um gatilho de revisão.

> Atividade "ADR", item 3.

## Contexto

O ADR 0003 decidiu migrar de SQLite para PostgreSQL pensando num piloto: um bairro, um
grupo pequeno de doadores e de ONGs, poucos acessos ao mesmo tempo. O cenário a avaliar
muda essas premissas:

> O Prato Cheio, inicialmente desenvolvido para um único bairro, será utilizado por ONGs e
> doadores de várias cidades, com acessos simultâneos e maior volume de doações.

Três coisas mudam de tamanho: o número de **escritas ao mesmo tempo** (publicações,
aceites e confirmações de coleta), o **volume de doações** que a listagem percorre, e a
quantidade de **servidores da aplicação** necessários para atender as cidades.

## Alternativas consideradas

1. **Manter o PostgreSQL (ADR 0003), ajustado para a escala.**
   - Prós: o modelo de dados e o código continuam válidos; o PostgreSQL atende vários
     servidores da aplicação ligados ao mesmo banco; a escrita trava só a linha.
   - Contras: exige pool de conexões e índices que o piloto não precisava.
2. **Um banco por cidade.**
   - Prós: isola as cidades; o volume de cada banco fica pequeno.
   - Contras: um doador que atende cidades vizinhas não cabe num banco só; multiplica
     backup, migração e monitoramento por cidade — custo alto para uma equipe pequena.
3. **Trocar por um banco distribuído ou de documentos.**
   - Prós: escala horizontal além do que um PostgreSQL atende.
   - Contras: resolve um volume que o cenário não descreve; abandona o modelo relacional e
     a garantia atual da RNI2 no `UPDATE`; refaz a camada de dados inteira.

## Decisão

**Manter o ADR 0003.** O cenário não enfraquece a decisão — ele a reforça.

O que o ADR 0003 deixava para trás são justamente os pontos que o novo cenário torna
críticos. O SQLite aceita **um escritor por vez no banco inteiro**: com várias cidades
publicando e aceitando ao mesmo tempo, as escritas entrariam em fila. Ele também é **um
arquivo local**, que dois servidores da aplicação não conseguem compartilhar. O PostgreSQL
resolve as duas coisas.

A garantia da RNI2 também se mantém. Com dois aceites da mesma doação ao mesmo tempo, o
PostgreSQL faz o segundo `UPDATE` esperar o primeiro terminar e, em seguida, reavalia a
condição `status = 'disponivel'`, que já não vale: zero linhas, e a segunda ONG recebe a
recusa. Isso continua correto com vários servidores da aplicação — ao contrário de uma
trava feita na memória da aplicação, que só valeria dentro de um servidor. É o argumento
da decisão D3, agora mais forte.

As alternativas 2 e 3 resolvem um problema maior do que o descrito, ao custo de refazer a
camada de dados e de multiplicar a operação.

## Consequências

- **Positivas:** nenhuma regra de negócio muda; a decisão D3 continua correta com vários
  servidores; o trabalho da Unidade 3 serve ao piloto e ao cenário ampliado.
- **Negativas / o que abrimos mão:** o banco passa a precisar de **pool de conexões**,
  porque vários servidores abrem muitas conexões ao mesmo tempo, e de **índices** em
  `status` e `validade`, que a listagem filtra a cada consulta. Também passa a ser preciso
  saber **a cidade** de cada doação e de cada ONG, para a lista não mostrar doações de
  outra cidade — campo que o modelo atual não tem.
- **Riscos e o que fazer se der errado:** o ponto fraco do cenário não é o banco, e sim
  **onde ele roda**. O plano gratuito do serviço gerenciado escolhido no ADR 0002, com
  suspensão por inatividade e limites de uso, serve ao piloto acadêmico, mas não a várias
  cidades com acessos simultâneos.

## Sobre o ADR 0002

O Prato Cheio é um projeto acadêmico, sem uso real: os dados são de teste e o volume é
pequeno. Para ele, o plano gratuito continua adequado, e por isso o ADR 0002 **não é
substituído agora**.

O que muda é que ele passa a ter um **gatilho de revisão** explícito: se o sistema passar
a ser usado de verdade por mais de uma cidade, o ADR 0002 deve ser substituído por um
novo registro de hospedagem, e o atual fica preservado como histórico, com status
`substituído`.

## Rastreabilidade

ADR 0003 (decisão reavaliada); ADR 0002 (hospedagem, com gatilho de revisão); decisão D3,
RNI2 e critério CA3.2 (garantia sob concorrência); risco R2 e Objetivo de Impacto 1, cujo
volume de medições cresce com o cenário.

## Uso de IA

A IA foi usada para consultar o comportamento do SQLite e do PostgreSQL sob concorrência,
comparar as alternativas e levantar as consequências. A conclusão — manter o ADR 0003 e
não substituir o ADR 0002 no projeto acadêmico — é do grupo.

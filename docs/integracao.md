# Integração de software: CI, Pull Requests e merges

Pesquisa sobre integração de software e como ela se aplica ao Prato Cheio. Os fatos sobre o repositório foram conferidos no código, no `git log` e no GitHub (`mendoncaluucas/prato-cheio`).

## 1. Integração Contínua (CI)

Integrar é juntar o trabalho de cada pessoa numa linha principal comum. CI é fazer isso com frequência, quase todo dia, e conferir cada integração com um build automático que roda os testes. Quando algo quebra, o aviso chega em minutos, com o código ainda fresco na cabeça de quem escreveu.

O texto do Martin Fowler gira em torno de poucas ideias: uma linha principal única, um build que testa a si mesmo, mudanças pequenas e frequentes, e uma build rápida. Se ela quebra, consertar vem antes de qualquer outra coisa. Integrações pequenas dão conflitos pequenos e a `main` continua utilizável.

No GitHub Actions, o CI é um workflow, um YAML em `.github/workflows`, disparado por eventos como um push ou a abertura de um PR. Ele tem jobs que rodam num runner, e cada job executa seus steps em ordem.

## 2. Pull Requests e revisão

O PR é o pedido para trazer um branch para outro. Reúne o diff, a conversa, o resultado do CI e a revisão. É nele que outra pessoa lê a mudança antes de ela entrar e que o grupo decide se está pronta. O branch isola o trabalho, e o PR é o ponto de controle na hora de integrar.

## 3. Merges e conflitos

O GitHub fecha um PR de três formas. O merge commit guarda todos os commits do branch e acrescenta um commit de junção. O squash junta tudo num commit só. O rebase refaz os commits em linha reta sobre a base, sem commit de junção e com hashes novos.

O conflito aparece quando dois branches mexem nas mesmas linhas de um arquivo, ou quando um edita o que o outro apaga. O Git não escolhe sozinho: alguém abre o arquivo, decide o que fica, faz o commit da resolução e o PR volta a poder ser mergeado. Branches curtos e atualizados com a `main` conflitam menos.

## 4. Testes de integração e testes unitários

O teste unitário confere uma peça isolada. É rápido, barato e estável, mas não diz se as peças funcionam juntas. O de integração exercita várias camadas de uma vez, por exemplo rota, regra de negócio e banco. Custa mais e demora mais, e pega o que o unitário não vê. A pirâmide de testes do Fowler sugere muitos testes na base e poucos no topo, como orientação e não como regra.

## 5. Como isso aparece no nosso projeto

### O pipeline

O `.github/workflows/ci.yml` roda em todo push na `main` e em todo PR. Num runner Ubuntu, sobe um PostgreSQL 18 descartável, separado do banco do grupo no Neon porque os testes apagam os dados. Depois instala as dependências com `npm ci`, roda `npm test` e confere que a aplicação sobe: inicia o servidor e faz `curl --fail` em `/api/saude`.

### Testes de integração que já temos

Boa parte da nossa suíte já é de integração. `tests/doacoes.test.js` usa o `supertest` contra o app Express e passa por rota, regra e banco. `tests/interface.test.js` sobe o servidor e clica nos botões da página com jsdom.

Um detalhe do estado atual da `main`: localmente o `npm test` usa SQLite em memória, e só o CI roda a suíte no PostgreSQL. O comentário no `vitest.config.js` explica o motivo de um ajuste. No PostgreSQL compartilhado, um arquivo de teste podia apagar os dados do outro, e o commit `ed7323c` passou a rodar um arquivo por vez (`fileParallelism: false`). Entre as execuções do PR #27, uma falhou e as seguintes passaram depois desse ajuste. [revisar: Victor] Conferir no log da execução se a falha foi mesmo essa. Pelo commit é a causa mais provável, mas ninguém abriu o log.

### O fluxo combinado e os desvios

O README diz que nada entra direto na `main`: cria-se um branch, abre-se o PR, espera-se o CI verde, outro integrante revisa e só então vem o merge. A definição de pronto repete isso e exige teste por critério de aceite. O repositório tem um template de PR em `.github/pull_request_template.md`.

Na prática, nos PRs #23, #24 e #26 a aprovação do Victor está registrada como revisão depois do merge. O #27 foi aprovado em 16/11 por outro integrante (steuer10) antes de entrar. Revisar antes do merge é o que a definição de pronto pede, e é onde ainda escorregamos.

### O PR #25

Foi aberto às 23:21 de 04/11 com a definição de pronto e a H4a, que já estava no #23, aberto às 23:10. O Lucas pediu mudanças, o PR foi fechado às 23:28 com o comentário "aberto por engano", e o #23 e o #24 foram mergeados logo depois. Trabalho duplicado em dois branches mexe nos mesmos arquivos, e o segundo a entrar levaria conflito. Fechar um dos dois evitou isso.

### Os congelamentos

`entrega-1` e `entrega-2` são branches no repositório do grupo, com o estado do projeto em cada entrega (os últimos commits são de 23/09 e 26/10). Servem de fotografia estável enquanto a `main` continua andando.

### A armadilha do fork

O README conta que o repositório nasceu de um fork do template do professor. Num fork, o GitHub costuma sugerir o repositório de origem como destino do PR, então um PR aberto sem atenção iria parar no repo do professor. Por isso a base do PR precisa ser a `main` do grupo. [revisar: Victor] Confirmar se isso já aconteceu com a gente. O que conferi foi que o #23 e o #25 têm base na `main` do nosso repositório, e não achei PR nosso no repo do professor.

### O que o CI não cobre

O CI só garante o que os testes verificam. Por isso, na H4a, cada regra foi invertida de propósito para ver se algum teste falhava, e o resultado está em `docs/validacao.md`.

## 6. Fontes consultadas

- Martin Fowler, "Continuous Integration": https://martinfowler.com/articles/continuousIntegration.html
- Martin Fowler, "Test Pyramid": https://martinfowler.com/bliki/TestPyramid.html
- GitHub Docs, "About merge conflicts": https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/about-merge-conflicts
- GitHub Docs, "About pull request merges": https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges
- GitHub Docs, "Understanding GitHub Actions": https://docs.github.com/en/actions/about-github-actions/understanding-github-actions

## Uso de IA

A IA ajudou a pesquisar as fontes e redigiu a primeira versão deste texto, que depois passou por uma revisão de estilo também feita com IA. A leitura, a conferência dos dois pontos marcados e a compreensão do conteúdo são do grupo.

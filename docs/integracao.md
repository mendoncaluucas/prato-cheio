# Integração de software: CI, Pull Requests e merges

Pesquisa sobre integração de software e como ela se aplica ao Prato Cheio. Os fatos sobre o repositório foram conferidos no código, no `git log` e no GitHub (`mendoncaluucas/prato-cheio`).

## 1. Integração Contínua (CI)

Integrar é juntar o trabalho de cada pessoa numa linha principal comum. CI é a prática de fazer isso com frequência, quase todo dia, e de verificar cada integração com um build automático que roda os testes. Quando algo quebra, o aviso vem em minutos e o código ainda está fresco na cabeça de quem escreveu. Pelo texto do Martin Fowler, as ideias centrais são: uma linha principal única, um build que testa a si mesmo, mudanças pequenas e frequentes e uma build rápida. Se a build quebra, consertar vem antes de qualquer coisa. A vantagem é que integrações pequenas dão conflitos pequenos e mantêm a `main` sempre utilizável.

No GitHub Actions, o CI é um workflow (um YAML em `.github/workflows`) disparado por eventos, como um push ou a abertura de um PR. Ele tem jobs, que rodam num runner, e cada job tem steps executados em ordem.

## 2. Pull Requests e revisão

O PR é o pedido para trazer um branch para outro. Ele reúne o diff, a conversa, o resultado da CI e a revisão. É onde outra pessoa lê a mudança antes de ela entrar, e onde o grupo decide se ela está pronta. O branch isola o trabalho; o PR é o ponto de controle na hora de integrar.

## 3. Merges e conflitos

Existem três formas de fechar um PR no GitHub. O merge commit mantém todos os commits do branch e acrescenta um commit de junção. O squash junta tudo num commit só. O rebase refaz os commits em linha reta sobre a base, sem commit de junção e com novos hashes.

O conflito aparece quando dois branches mexem nas mesmas linhas de um arquivo, ou quando um edita um arquivo que o outro apaga. O Git não escolhe sozinho. Alguém abre o arquivo, decide o que fica, faz o commit da resolução e o PR volta a poder ser mergeado. Conflito fica mais raro com branches curtos e atualizados com a `main`.

## 4. Testes de integração e testes unitários

O teste unitário checa uma peça isolada: rápido, barato e estável. Ele não mostra se as peças funcionam juntas. O teste de integração exercita várias camadas de uma vez, por exemplo rota, regra de negócio e banco. Custa mais e é mais lento, mas pega o que o unitário não vê. A "pirâmide de testes" (Fowler) recomenda muitos testes baixos e menos testes altos, mas é uma orientação, não uma regra.

## 5. Como isso aparece no nosso projeto

**O pipeline.** O `.github/workflows/ci.yml` roda em todo push na `main` e em todo PR. Num runner Ubuntu, sobe um serviço PostgreSQL 18 descartável (separado do banco do grupo no Neon, porque os testes apagam os dados), instala as dependências com `npm ci`, roda `npm test` e por fim verifica que a aplicação sobe: inicia o servidor e faz `curl --fail` em `/api/saude`.

**Boa parte dos nossos testes é de integração.** `tests/doacoes.test.js` usa o `supertest` contra o app Express, passando por rota, regra e banco. `tests/interface.test.js` sobe o servidor e clica nos botões da página com jsdom. Um detalhe que importa: localmente o `npm test` usa SQLite em memória, e só a CI roda a suíte no PostgreSQL. O comentário no `vitest.config.js` explica: ao rodar no PostgreSQL compartilhado, um arquivo de teste podia apagar os dados do outro, e o commit `ed7323c` passou a rodar um arquivo por vez (`fileParallelism: false`). Entre as execuções do PR #27, uma terminou em falha e as seguintes passaram, depois desse ajuste. [revisar: Victor] conferir no log da execução se a falha foi mesmo essa; pelo commit é a causa mais provável, mas não abri o log.

**O fluxo combinado.** O README diz que nada entra direto na `main`: cria-se um branch, abre-se o PR, espera-se o CI verde, outro integrante revisa e só depois vem o merge. A definição de pronto do README repete isso (PR revisado por outro integrante e com CI verde) e exige teste por critério de aceite. O repositório tem um template de PR em `.github/pull_request_template.md`.

**Na prática houve desvios.** Nos PRs #23, #24 e #26 a aprovação do Victor está escrita como "revisão depois do merge", ou seja, a revisão veio depois da integração. Já o #27 foi aprovado em 16/11 por outro integrante (steuer10) antes do merge. Fica como ponto a melhorar: a revisão antes do merge é o que a definição de pronto pede.

**O PR #25.** Foi aberto às 23:21 de 04/11 com a definição de pronto e a H4a, que já estava no #23 (aberto às 23:10). O Lucas pediu mudanças ("rejeitado") e o PR foi fechado às 23:28, com o comentário "aberto por engano". O #23 e o #24 foram mergeados logo depois. Em CI, trabalho duplicado em dois branches é um risco: os dois mexeriam nos mesmos arquivos, e o segundo a entrar pegaria conflito. Fechar o duplicado resolveu antes disso.

**Os congelamentos.** `entrega-1` e `entrega-2` são branches no repositório do grupo, com o estado do projeto em cada entrega (os últimos commits são de 23/09 e 26/10). Servem como fotografia estável enquanto a `main` continua andando.

**A armadilha do fork.** O README conta que o repositório nasceu de um fork do template do professor, porque o botão "Use this template" não estava disponível. Num fork, o GitHub costuma sugerir o repositório de origem como destino do PR, então um PR aberto sem atenção iria parar no repo do professor em vez do nosso. Por isso a base do PR precisa ser a `main` do grupo. [revisar: Victor] confirmar se isso já aconteceu com a gente; o que conferi foi que o #23 e o #25 têm base `main` do nosso repositório, e não achei sinal de PR nosso no repo do professor.

**O que a CI não substitui.** A revisão do #26 encontrou uma inversão de regra que nenhum teste pegava (a verificação de status em `aceitar`). A CI só garante o que os testes verificam.

## 6. Fontes consultadas

- Martin Fowler, "Continuous Integration": https://martinfowler.com/articles/continuousIntegration.html
- Martin Fowler, "Test Pyramid": https://martinfowler.com/bliki/TestPyramid.html
- GitHub Docs, "About merge conflicts": https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/about-merge-conflicts
- GitHub Docs, "About pull request merges": https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges
- GitHub Docs, "Understanding GitHub Actions": https://docs.github.com/en/actions/about-github-actions/understanding-github-actions

## Uso de IA

A IA ajudou a pesquisar fontes e redigiu a primeira versão deste texto. A revisão e a compreensão são do grupo.

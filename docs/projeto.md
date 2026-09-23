# Documento de Projeto — Prato Cheio

*Trabalho 2 · máximo 4 páginas (fora diagramas) · entrega na Aula 10*

## Decisões de projeto

Cada decisão abaixo responde a algo que a Unidade de Análise já havia levantado — uma
regra, um risco ou uma restrição. As duas primeiras estão registradas em ADR próprio; a
terceira já estava implementada desde o walking skeleton e é formalizada aqui.

| # | Decisão | Alternativas | Requisito/risco da Análise que a motiva |
|---|---|---|---|
| D1 | **Escopo do incremento da Unidade 2:** implementar a RN2 por completo e construir a confirmação de coleta de que a RNI3 depende, sem implementar a RNI3 nem a RN4. ([ADR 0001](adr/0001-escopo-unidade-2.md)) | **A)** Só a RN2 — filtro de janela na listagem. **B)** RN2 + RNI3 completa, com devolução automática à lista e registro de não-comparecimento. → **Escolhida: uma variação de A**, que soma a confirmação de coleta sem a devolução automática. *(uma terceira opção, trazer também a RN4, foi descartada por exigir geocodificação)* | **RN2** (doação só disponível dentro da janela) e **risco R2** (doação aceita e não coletada fica presa). Também destrava o **Objetivo de Impacto 1** e o experimento da hipótese, que hoje são inexecutáveis: das três marcas temporais previstas, só `criada_em` existe. |
| D2 | **Como o PostgreSQL sobe na Unidade 3:** serviço gerenciado (Neon), alcançável por `DATABASE_URL`, com o CI usando seu próprio serviço `postgres` descartável. ([ADR 0002](adr/0002-subida-postgresql.md)) | **A)** PostgreSQL instalado na máquina de cada integrante. **B)** Contêiner Docker local. **C)** Serviço gerenciado gratuito. → **Escolhida: C.** | **Restrição de orçamento próximo de zero** e a exigência de **CI verde a cada entrega**. O `src/db.js` já foi desenhado para isolar a troca atrás de `query()`, e a decisão precisa existir antes da refatoração para não travar a Unidade 3 por falta de banco. |
| D3 | **Como garantir que duas ONGs não aceitem a mesma doação:** a condição vai no próprio `UPDATE` (`WHERE id = ? AND status = 'disponivel'`), e não em uma verificação anterior na aplicação. | **A)** Ler a doação, conferir o status e então gravar, na camada de regra de negócio. **B)** Condição embutida no `UPDATE`, deixando o banco decidir quem chega primeiro. → **Escolhida: B**, com a verificação de A mantida antes dela apenas para produzir uma mensagem de erro clara. | **RNI2** ("quem chega primeiro leva": a primeira ONG fica com a doação e a segunda recebe recusa explícita) e o critério de aceite **CA3.2**. Também sustenta a **RN3**, já que a doação aceita precisa sair da lista de disponíveis de forma confiável. |

## Tabela de trade-offs (uma decisão em detalhe)

Decisão detalhada: **D2 — como o PostgreSQL sobe na Unidade 3.** Foi escolhida para o
detalhamento por ser a que mais divide o grupo em critérios: nenhuma alternativa vence em
todos, e a escolha depende de qual critério pesa mais no contexto do piloto.

| Critério | A) PostgreSQL local | B) Contêiner Docker | C) Serviço gerenciado (Neon) |
|---|---|---|---|
| **Uniformidade entre integrantes** | ruim — versão e configuração divergem entre Windows e Mac | boa — mesma imagem para todos | **ótima** — um único banco, igual para todos |
| **Esforço de configuração inicial** | médio, repetido por pessoa | **alto** — exige Docker e `docker-compose`, que o grupo nunca usou no projeto | **baixo** — criar o projeto e copiar a `DATABASE_URL` |
| **Custo financeiro** | **zero** | **zero** | zero no plano gratuito, sujeito a limites |
| **Funciona sem internet** | **sim** | **sim** | não — passa a exigir conexão para rodar localmente |
| **Proximidade do ambiente real** | média | boa | **alta** — banco remoto, como em produção |
| **Independência do CI** | o CI precisa do próprio banco de qualquer forma | idem | idem — resolvido pelo serviço `postgres` do Actions, já comentado no `ci.yml` |
| **Risco de bloqueio do trabalho** | divergência de ambiente vira tempo de depuração | ferramenta nova somada à troca de banco: dois riscos ao mesmo tempo | **depende de terceiro** — se o serviço mudar o plano, é preciso migrar |

**Leitura da tabela.** As alternativas A e B ganham em independência de rede e custo, mas
perdem justamente no que a Unidade 3 avalia: ela mede a **refatoração**, e tempo gasto
depurando diferença de ambiente entre máquinas não conta como progresso. A alternativa B
resolveria a uniformidade, mas introduz uma ferramenta que ninguém do grupo usou até aqui
— aprender `docker-compose` no mesmo momento em que se troca a camada de dados soma dois
riscos.

A alternativa C perde em dois critérios reais: exige internet e nos deixa dependentes de
um terceiro. O primeiro é aceitável porque o desenvolvimento já depende de GitHub e CI. O
segundo é mitigado pela própria arquitetura: como `src/db.js` isola o acesso atrás de
`query()`, trocar para a alternativa B significa mudar a `DATABASE_URL` e nada mais —
nenhuma regra de negócio conhece a origem do banco.

## Justificativa das decisões

- **D1 → RN2 e risco R2.** A Análise havia adiado RN2, RN4 e RNI3 como regras que exigiam dados inexistentes. Revendo, a RN2 não exige nenhum dos dados listados: seu critério de verificação se resolve com o campo `validade`, que já existe e já é usado pela RNI1. A decisão corrige essa classificação e ataca o R2 ao fechar o ciclo de vida da doação, que hoje termina em `aceita` e nunca mais muda.
- **D2 → restrição de orçamento e exigência de CI verde.** A Análise registra equipe pequena e orçamento próximo de zero, e o compromisso de CI verde a cada entrega. A decisão respeita as duas coisas: plano gratuito para o desenvolvimento e banco descartável no pipeline, sem custo nem dependência externa no CI.
- **D3 → RNI2 e critério CA3.2.** A regra diz que, entre duas ONGs, a primeira registrada fica com a doação e a segunda recebe recusa explícita. Verificar antes e gravar depois deixa uma janela entre a leitura e a escrita em que as duas passam pela verificação. Colocar a condição no `UPDATE` elimina a janela: a decisão de quem chega primeiro passa a ser do banco, em uma única operação.

## Diagramas
(contexto + dados ou componentes — em `docs/` ou como imagem)

## ADRs

| ADR | Decisão | Status |
|---|---|---|
| [0001](adr/0001-escopo-unidade-2.md) | Escopo do incremento da Unidade 2 (D1) | aceito |
| [0002](adr/0002-subida-postgresql.md) | Como o PostgreSQL sobe na Unidade 3 (D2) | aceito |

A decisão D3 não tem ADR próprio: ela foi tomada durante o walking skeleton da Unidade 1
e está documentada aqui e no comentário de `aceitar()`, em `src/repositorio.js`.

## Requisitos não-funcionais
| Requisito | Como afeta o design |
|---|---|

## Critérios de validação do projeto

## Uso de IA

| Etapa | Nível declarado | O que a IA fez | O que nós fizemos |
|---|---|---|---|
| Decisões de projeto e tabela de trade-offs | IA como colaboradora | organizou no formato da atividade as três decisões e os critérios da tabela, a partir dos dois ADRs e do código já existentes | as decisões já eram nossas: D1 e D2 vinham dos ADRs discutidos no PR #7, e D3 foi tomada durante o walking skeleton da Unidade 1. Escolhemos qual decisão detalhar na tabela e conferimos cada linha da rastreabilidade contra as regras e os riscos do `docs/analise.md` |

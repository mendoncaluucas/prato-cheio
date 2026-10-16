# Documento de Projeto — Prato Cheio

*Trabalho 2 · máximo 4 páginas (fora diagramas) · entrega na Aula 10*

## Histórias implementadas na Unidade 2

Além do incremento do [ADR 0001](adr/0001-escopo-unidade-2.md) (RN2, confirmação de coleta
e marcas de hora), a Unidade 2 implementa duas histórias que ficaram de fora da Unidade 1.
Os testes estão em `tests/doacoes.test.js`, no bloco com o nome de cada história.

### H6c — retirar uma doação denunciada

> Como **quem administra a plataforma**, quero retirar da lista uma doação denunciada como
> imprópria, para que nenhuma ONG busque alimento fora das condições.

Rota: `POST /api/doacoes/:id/retirar`, com `{ motivo }`. Na interface, o botão
*Retirar (imprópria)* aparece nas doações disponíveis e nas que aguardam coleta.

| Critério | Dado / Quando / Então |
|---|---|
| CA6c.1 | **Dado** uma doação disponível denunciada, **quando** quem administra a retira com um motivo, **então** ela passa a `retirada`, some da lista e o motivo e a hora ficam registrados |
| CA6c.2 | **Dado** uma doação aceita e ainda não coletada, **quando** é retirada, **então** sai de "aguardando coleta" e a ONG não consegue mais confirmar a coleta |
| CA6c.3 | **Dado** uma doação disponível, **quando** se tenta retirá-la sem motivo, **então** a API recusa com 400 e ela continua disponível |
| CA6c.4 | **Dado** uma doação já coletada, **quando** se tenta retirá-la, **então** a API recusa com 400, porque o alimento já foi entregue |
| CA6c.5 | **Dado** uma doação já retirada, **quando** se tenta retirá-la de novo, **então** a API recusa com 400 e o primeiro motivo é mantido |
| CA6c.6 | **Dado** uma doação retirada, **quando** uma ONG tenta aceitá-la, **então** a recusa diz que ela foi retirada, e não que outra ONG a aceitou |

Decisões de comportamento:
- **Disponível e aceita podem ser retiradas; coletada, não.** Uma ONG que aceitou um
  alimento impróprio também não deve ir buscá-lo. Depois da coleta, retirar não tem efeito
  sobre o alimento.
- **O motivo é obrigatório.** A retirada é a resposta operacional à vigilância sanitária,
  e o motivo é o registro que ela pode cobrar.
- **A condição de status fica no próprio `UPDATE`**, como no aceite (decisão D3): uma
  retirada e uma confirmação de coleta simultâneas não podem ambas vencer.
- **Limitação:** o sistema não tem login, então qualquer pessoa consegue chamar a rota de
  retirada. "Quem administra" ainda não é um papel controlado pelo sistema.

### H6b — relatório semanal de coletas

> Como **Marta**, quero ver, a cada semana, quantas das doações publicadas terminaram
> coletadas, para saber se o piloto está reduzindo o desperdício.

Rota: `GET /api/relatorios/semanal`. Na interface, a tabela *Relatório semanal* fica abaixo
das listas e é atualizada a cada ação. Por que o agrupamento é feito na aplicação, e não em
SQL: [ADR 0006](adr/0006-relatorio-semanal-na-aplicacao.md).

Cada linha é uma **semana de publicação**, identificada pela segunda-feira. Cada doação
cai em exatamente uma situação:

| Coluna | O que conta | Para que serve |
|---|---|---|
| Publicadas | todas as doações publicadas na semana | a base |
| Coletadas no prazo | coleta confirmada até o dia da validade | o resultado que se quer |
| Coletadas após vencer | coleta confirmada depois do dia da validade | contadas à parte: não é comida boa salva |
| Retiradas | retiradas por serem impróprias (H6c) | saem do cálculo da taxa |
| Vencidas | disponíveis ou aceitas com a janela já vencida | o desperdício do **Objetivo de Impacto 2** |
| Em aberto | disponíveis ou aceitas ainda dentro da janela | o que ainda pode ser salvo |
| Taxa de coleta | coletadas no prazo ÷ (publicadas − retiradas) | o indicador do Objetivo 2 |
| Mediana até a coleta | mediana de horas entre publicação e coleta | a medida do **experimento da hipótese** (Objetivo 1) |

| Critério | Dado / Quando / Então |
|---|---|
| CA6b.1 | **Dado** doações publicadas em semanas diferentes, **quando** Marta consulta o relatório, **então** há uma linha por semana, identificada pela segunda-feira, da mais recente para a mais antiga |
| CA6b.2 | **Dado** doações em todas as situações numa mesma semana, **quando** Marta consulta, **então** cada doação aparece em exatamente uma situação, e as situações somam as publicadas |
| CA6b.3 | **Dado** uma semana com doações retiradas, **quando** a taxa de coleta é calculada, **então** as retiradas ficam fora do denominador |
| CA6b.4 | **Dado** uma semana em que todas as doações foram retiradas, **quando** Marta consulta, **então** a taxa aparece vazia, e não como erro nem como 0% |
| CA6b.5 | **Dado** doações coletadas com tempos diferentes, **quando** Marta consulta, **então** vê a mediana de horas entre publicação e coleta |
| CA6b.6 | **Dado** que não há doações, **quando** Marta consulta, **então** recebe um relatório vazio, e não um erro |
| CA6b.7 | **Dado** uma doação aceita cuja coleta foi confirmada depois do dia da validade, **quando** Marta consulta, **então** ela aparece em "coletadas após vencer" e fica fora da taxa de coleta |

Decisões de comportamento:
- **A coleta depois da validade é permitida, mas contada à parte.** Bloquear impediria a
  ONG que buscou a tempo e só confirmou depois; contar como sucesso mostraria como comida
  salva um alimento que pode ter sido buscado vencido. Na lista "aguardando coleta", a
  doação vencida aparece com um aviso para confirmar só se a busca foi feita no prazo. O
  dia da coleta é comparado no fuso local, o mesmo da validade.
- **As retiradas não entram na taxa.** Alimento impróprio não é comida boa desperdiçada, e
  contá-lo puniria a taxa justamente quando o sistema agiu certo.
- **Mediana, e não média.** Uma única coleta muito atrasada puxaria a média para cima sem
  representar a semana: com coletas de 1 h, 3 h e 24 h, a média seria 9,3 h, e a mediana
  é 3 h.
- **A semana é a da hora gravada, em UTC.** Uma doação publicada num domingo depois das
  21h, no horário de Brasília, entra na semana seguinte. Registrado no ADR 0006.

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
| [0002](adr/0002-subida-postgresql.md) | Como o PostgreSQL sobe na Unidade 3 (D2) | aceito; revisto pelo 0005, mantido para o piloto |
| [0003](adr/0003-migrar-sqlite-para-postgresql.md) | Migrar o banco de SQLite para PostgreSQL | aceito; reavaliado pelo 0005, mantido |
| [0004](adr/0004-reescrita-usar-postgresql.md) | Usar PostgreSQL — reescrita de um registro incompleto | aceito |
| [0005](adr/0005-reavaliacao-postgresql-varias-cidades.md) | Reavaliação do 0003 para várias cidades | aceito |
| [0006](adr/0006-relatorio-semanal-na-aplicacao.md) | Calcular o relatório semanal na aplicação, e não em SQL (H6b) | aceito |

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

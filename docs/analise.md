# Documento de Análise — Prato Cheio

*Trabalho 1 · máximo 4 páginas · entrega na Aula 5*

## Problema central
Restaurantes, padarias e mercados descartam diariamente comida ainda boa, enquanto
ONGs e cozinhas comunitárias não conseguem descobrir a tempo o que está disponível
para coleta. Hoje essa articulação acontece de forma informal (grupos de WhatsApp),
sem histórico e sem previsibilidade — boa parte da comida estraga antes de alguém buscar.

## Incertezas
- Não há dados sobre o volume real de doações por dia, nem quantas ONGs vão aderir à plataforma.
- Não está confirmado se o gargalo real é o tempo de coleta (hipótese de Marta) ou outro fator.
- Não se sabe se os doadores vão topar cadastrar cada doação individualmente, nem com que frequência.

## Stakeholders

Mapa por **interesse × influência**. Tipo conforme o papel: usuário, patrocinador, operação, regulador, afetado.

| Stakeholder | Tipo | Interesse | Influência | O que espera | Como tratar |
|---|---|:--:|:--:|---|---|
| Doadores (restaurantes, padarias, mercados) | usuário | médio | **alta** | doar sem burocracia, com retirada rápida | gerir de perto |
| ONGs / cozinhas comunitárias | usuário | **alto** | **alta** | previsibilidade: saber o que vem e planejar as refeições | gerir de perto |
| Coordenador (Hoje Marta) | patrocinador | **alto** | **alta** | crescer rápido e mostrar impacto para conseguir apoio | gerir de perto |
| Vigilância sanitária | regulador | baixo | **alta** | rastreabilidade mínima: o quê, quanto, validade | manter satisfeita |
| Voluntários entregadores | operação | **alto** | baixa | achar e cumprir a coleta pelo celular, na rua | manter informados |
| Quem administra a plataforma no dia a dia | operação | **alto** | média | cadastrar ONGs, moderar e resolver problema de doação | manter informados |
| Beneficiários das refeições | afetado | **alto** | baixa | receber comida boa e no prazo | monitorar |
| Financiador futuro (edital, prefeitura, patrocinador) | patrocinador | baixo hoje | alta amanhã | evidência de impacto antes de bancar | monitorar |

**Leitura do mapa.** Os três de cima concentram interesse e influência: é entre eles que as prioridades colidem, e é onde a análise precisa decidir (ver *Conflitos de prioridade*). A
vigilância tem interesse baixo mas influência alta — não usa o sistema e mesmo assim pode inviabilizá-lo, então entra como restrição, não como pedido de funcionalidade. Voluntários e administração têm influência baixa sobre o **quê**, mas ditam os requisitos não-funcionais (celular, conexão instável, operação manual no piloto).

Os quatro últimos **não estão nomeados no caso** e foram levantados por nós: quem opera o sistema no dia a dia, quem é afetado sem nunca clicar num botão e quem vai pagar a conta depois do piloto.

## Objetivos de impacto

São objetivos de *resultado no mundo*, não de funcionalidade. Não existe linha de
base medida hoje, o piloto precisa produzir o primeiro número para serem levantados objetivos mais concretos.

| # | Objetivo | Como medir | Meta no piloto |
|---|---|---|---|
| 1 | Reduzir o tempo entre "comida disponível" e "comida coletada" | mediana do intervalo entre a publicação da doação e a coleta confirmada | estabelecer a linha de base nas 2 primeiras semanas e reduzi-la nas seguintes |
| 2 | Reduzir o descarte de comida boa | % das doações publicadas que expiram sem serem aceitas ou coletadas | manter abaixo de 20% (Avaliar e ajustar esse número, tentar reduzir com o tempo) |
| 3 | Aumentar as refeições que chegam a quem precisa | volume (porções ou kg) efetivamente entregue por semana no bairro-piloto | crescimento semanal ao longo do piloto |

Não são objetivos: "lançar o app", "ter as telas prontas", "cadastrar 50 doadores". São entregas, podem acontecer sem que nenhuma refeição a mais chegue ao destino.

## Regras de negócio

Formato: **sujeito · condição · efeito**, de modo que cada regra possa virar teste. As RN vêm do caso; as RNI são regras que estavam **implícitas** e foram explicitadas por nós.

| # | Regra | Como verificar |
|---|---|---|
| RN1 | O sistema **recusa** uma doação que não informe tipo do alimento, quantidade e validade/janela de retirada. | publicar sem um dos campos → erro; a doação não aparece na lista |
| RN2 | Uma doação **só fica disponível** enquanto estiver dentro da sua janela de retirada. | doação com janela vencida não aparece em `GET /api/doacoes` |
| RN3 | Ao ser aceita por uma ONG, a doação **deixa de estar disponível** para as demais. | após o aceite, some da lista de disponíveis |
| RN4 | Entre ONGs candidatas, a **mais próxima do doador** tem prioridade de exibição. | a lista da ONG vem ordenada por distância até o doador |
| RNI1 | *Implícito: "a comida tem que estar boa quando chegar".* O sistema **recusa publicar** doação cuja validade/janela já esteja vencida no momento da publicação. | publicar com validade no passado → erro |
| RNI2 | *Implícito: "quem chega primeiro leva".* Quando duas ONGs aceitam a mesma doação, **a primeira registrada fica com ela**; a segunda recebe uma recusa explícita dizendo que já foi aceita. | aceitar duas vezes → 1º aceite ok, 2º recusado com motivo |
| RNI3 | *Implícito: "se a ONG aceitou, ela vai buscar".* Se a coleta não for confirmada até o fim da janela, a doação **volta para a lista** e o não-comparecimento fica registrado na ONG. | janela expira sem coleta → doação disponível de novo e ocorrência registrada |

RN1, RN3, RNI1 e RNI2 são atendíveis com o modelo de dados atual (`tipo`, `quantidade`, `validade`, `status`, `ong`). RN2, RN4 e RNI3 exigem dados que ainda não temos — hora da coleta, localização e confirmação de retirada. Elas ficam registradas aqui como regra do domínio, mas **entram ou não no recorte do piloto** conforme a decisão de escopo da Aula 3.

## Conflitos de prioridade

### Conflito principal — simplicidade do doador × rastreabilidade da vigilância

> **Doador:** "Quero cadastrar em 10 segundos. Não vou preencher formulário para cada bandeja de sobra — se der trabalho, volto para o WhatsApp."
>
> **Vigilância sanitária:** "Toda doação precisa de rastreabilidade mínima: o que é, quanto é e até quando pode ser consumido. Sem isso, a operação não se sustenta."

**O conflito.** Cada campo obrigatório aumenta a rastreabilidade e, ao mesmo tempo, reduz a chance de o doador publicar. Os dois stakeholders têm influência alta e nenhum pode ser simplesmente ignorado: sem doador não há doação; sem rastreabilidade a plataforma pode ser barrada.

**Critério de decisão proposto.** Um campo só é obrigatório se **(a)** for exigido para a rastreabilidade sanitária **ou** **(b)** sem ele a ONG não consegue decidir se aceita a doação. Todo o resto é opcional ou preenchido automaticamente pelo sistema (data, hora, autor). No piloto, o critério fecha em três campos obrigatórios — tipo, quantidade e validade —, que são exatamente os que satisfazem (a) e (b) ao mesmo tempo.

**Quem perde o quê.** A vigilância perde granularidade: não teremos lote, temperatura, foto nem origem detalhada. O doador perde a possibilidade de publicar um "tem sobra, vem buscar" sem dizer o quê. Ganha-se um cadastro curto o bastante para caber na rotina de quem está fechando a cozinha.

### Outros conflitos mapeados

| Conflito | Critério proposto |
|---|---|
| ONG quer previsibilidade (saber com antecedência o que vem) × doador não quer se comprometer antes da hora | no piloto, a plataforma não promete o futuro: publica só o que já existe. Previsibilidade vem do histórico ("o que este doador costuma publicar"), não de compromisso antecipado |
| Marta quer crescer aceitando todo doador e toda doação × qualidade exige critério mínimo | crescimento sem critério mínimo destrói a confiança da ONG, que é o ativo mais difícil de recuperar. Aceita-se todo doador, mas nenhuma doação sem os três campos obrigatórios (RN1) |

## Histórias de usuário

Cada história passa pelos seis critérios do INVEST. Falhar um critério não invalida a
história, indica onde ela vai doer e o que precisa ser decidido antes de construí-la.

| # | História (Como… quero… para…) | INVEST: o que falha |
|---|---|---|
| H1 | Como **doador**, quero publicar uma doação informando tipo, quantidade e validade, para que uma ONG a recolha antes de estragar. | passa nos seis, é a menor coisa que já entrega valor (RN1, RNI1) |
| H2 | Como **ONG receptora**, quero ver as doações disponíveis agora, para decidir o que consigo buscar hoje. | passa nos seis, sem H1 a lista vem vazia, mas a história funciona e se testa sozinha |
| H3 | Como **ONG receptora**, quero aceitar uma doação disponível, para garantir que ninguém mais vá buscá-la. | **Independente**, só faz sentido depois de H1 e H2. É o preço de uma fatia vertical, não um defeito: por isso as três entram na mesma iteração (RN3, RNI2) |
| H4 | Como **doador**, quero acompanhar as doações que publiquei e ser avisado quando alguma expirar sem ser aceita, para saber se vale a pena continuar publicando. | **Pequena** (o "e" no meio denuncia dois comportamentos) e **Independente** (depende de H1 e H3). Precisa ser quebrada antes de entrar |
| H5 | Como **voluntário entregador**, quero ver no celular as coletas atribuídas a mim, com endereço, para cumprir a rota do dia. | **Estimável** e **Pequena**, exige cadastro de voluntário, endereço e geolocalização, que não existem no modelo de dados atual (RN4) |
| H6 | Como **Marta**, quero gerenciar toda a operação de doações do bairro, para escalar o programa. | **Pequena**, **Estimável** e **Testável**, é épico, não história: não cabe numa iteração, ninguém consegue estimar e não há como dizer quando está pronta. Quebrada em H6a–H6c |
| H6a | Como **quem administra a plataforma**, quero aprovar o cadastro de uma ONG antes de ela poder aceitar doações, para que só organização verificada retire alimento. | passa nos seis, atende o critério mínimo de qualidade do conflito "crescer × qualidade" |
| H6b | Como **Marta**, quero ver, a cada semana, quantas das doações publicadas terminaram coletadas, para saber se o piloto está reduzindo o desperdício. | passa nos seis, é a métrica do Objetivo de impacto 2 |
| H6c | Como **quem administra a plataforma**, quero retirar da lista uma doação denunciada como imprópria, para que nenhuma ONG busque alimento fora das condições. | passa nos seis, é a resposta operacional à exigência da vigilância |

**Sobre a quebra de H6.** As três histórias que saíram dela têm usuário próprio, entregam
valor sozinhas e podem ser construídas em qualquer ordem: aprovar ONG serve mesmo sem
relatório, o número semanal serve mesmo sem moderação, e a moderação serve mesmo sem os
outros dois. Foi isso que fez H6 ser reconhecida como épico: precisava de mais de uma
iteração, ninguém do grupo conseguia estimá-la e ela juntava três assuntos com "e".

### História zero, a fatia vertical

**H1 → H2 → H3**: o doador publica uma doação, a ONG vê a lista de disponíveis, a ONG aceita e a doação some para as demais. É fina na largura e completa na profundidade, atravessa interface, regra de negócio e banco, e é o que o repositório implementa: as rotas `POST /api/doacoes`, `GET /api/doacoes` e `POST /api/doacoes/:id/aceitar` em `src/app.js`, as regras em `src/doacoes.js`, o acesso ao banco em `src/repositorio.js` e os testes de `tests/doacoes.test.js`, que são exatamente os critérios de aceite dessa fatia.

**Fica de fora de propósito**, para a fatia não engordar: janela de retirada (RN2),
prioridade por proximidade (RN4) e confirmação de coleta com devolução da doação à lista
(RNI3), as três exigem dados que o modelo atual não tem. Ficam registradas como regra do
domínio e entram, ou não, nas próximas iterações.

## Critérios de aceite

Critérios das três histórias da fatia vertical (história zero): H1, H2 e H3. Cada
critério é verificável por um teste automatizado em `tests/doacoes.test.js` — o
mapeamento critério ↔ teste está no fim da seção.

**H1 — o doador publica uma doação**

- CA1.1 — **Dado** um doador na tela de publicação, **quando** ele envia uma doação com tipo, quantidade e validade preenchidos, **então** a doação é registrada com status `disponivel` e passa a aparecer na lista de disponíveis. *(RN1)*
- CA1.2 — **Dado** um doador preenchendo a publicação, **quando** ele envia sem ao menos um dos três campos obrigatórios (tipo, quantidade ou validade), **então** o sistema recusa com erro 400 e a doação não é criada. *(RN1)*
- CA1.3 — **Dado** um doador preenchendo a publicação, **quando** a validade informada já está vencida no momento do envio, **então** o sistema recusa com erro 400 e a doação não é criada. *(RNI1)*

**H2 — a ONG vê as doações disponíveis**

- CA2.1 — **Dado** que existem doações com status `disponivel`, **quando** uma ONG consulta a lista de disponíveis, **então** o sistema devolve exatamente essas doações.
- CA2.2 — **Dado** que uma doação foi aceita por alguma ONG, **quando** outra ONG consulta a lista de disponíveis, **então** essa doação não aparece mais. *(RN3)*

**H3 — a ONG aceita uma doação**

- CA3.1 — **Dado** uma doação disponível, **quando** uma ONG a aceita, **então** a doação passa para o status `aceita`, fica registrada em nome daquela ONG e sai da lista de disponíveis. *(RN3)*
- CA3.2 — **Dado** uma doação já aceita por uma ONG, **quando** outra ONG tenta aceitá-la, **então** o sistema recusa com erro 400 informando que já foi aceita, e a primeira ONG permanece como responsável. *(RNI2)*

### Rastreabilidade — critério ↔ teste

Todos os sete critérios têm teste automatizado em `tests/doacoes.test.js`. A relação não
é de um para um: o primeiro teste percorre a publicação e a listagem no mesmo fluxo,
então fecha CA1.1 e CA2.1 de uma vez.

| Teste em `tests/doacoes.test.js` | Critérios que verifica |
|---|---|
| `mostra a doação publicada na lista de disponíveis` | CA1.1, CA2.1 |
| `recusa doação sem os campos obrigatórios` | CA1.2 |
| `recusa doação com validade já vencida` | CA1.3 |
| `marca a doação como aceita pela ONG` | CA3.1 |
| `remove a doação da lista de disponíveis depois de aceita` | CA2.2 |
| `recusa aceitar uma doação que já foi aceita por outra ONG` | CA3.2 |

Com o teste de saúde, a suíte fecha em sete casos.

**Sobre o CA1.3.** A RNI1 está dentro do recorte do piloto — não aparece entre as regras
adiadas na história zero, e é atendível com o modelo de dados atual. O template do
repositório não trouxe esse cenário entre os cinco `it.todo`, então ele foi acrescentado
como sexto teste junto com o walking skeleton, com a validação correspondente em
`src/doacoes.js`.

**Uma observação sobre datas.** A validade é comparada com a data de hoje no fuso local,
e não via `toISOString()`, que converte para UTC e devolveria o dia seguinte nas últimas
três horas do dia no horário de Brasília. Os testes também usam datas relativas ao dia da
execução: uma validade fixa venceria com o tempo e passaria a esbarrar no CA1.3,
quebrando testes que não têm relação com ele. Validade igual ao dia de hoje é aceita —
só recusamos datas anteriores.

## Riscos

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| R1 | **Poucos doadores publicam** — o cadastro dá trabalho no meio da rotina de fechamento da cozinha, e o doador volta para o WhatsApp. Sem oferta, a plataforma não tem o que distribuir. | alta | alto | Manter o cadastro no mínimo viável (só os três campos obrigatórios da RN1) e medir, já no piloto, o tempo real de publicação. Se passar de ~30s, simplificar mais (campos pré-preenchidos, publicação recorrente). Começar com 3–4 doadores conhecidos, acompanhados de perto, em vez de captação ampla. |
| R2 | **Doação aceita não é coletada a tempo** — a ONG aceita e não busca; a doação fica presa em nome dela e a comida estraga sem que outra ONG pudesse ter recolhido. | média | alto | Registrar o não-comparecimento por ONG (base para a RNI3 nas próximas iterações) e, no piloto, acompanhar manualmente cada aceite até a coleta. Deixar a janela de retirada visível na lista para a ONG só aceitar o que consegue buscar. |

## Hipótese e experimento

**Suposição do caso.** Marta *acha* que o gargalo é o tempo entre a comida ficar
disponível e alguém coletá-la — mas não há medição que confirme.

**Hipótese testável.** *Reduzir o tempo entre publicação e coleta aumenta a fração de
doações que chegam a ser coletadas antes de expirar.* Ou seja: quanto mais rápido o
ciclo publicar → aceitar → coletar, menos comida se perde.

**Experimento.** Durante as duas primeiras semanas do piloto num bairro, instrumentar o
sistema para registrar, em cada doação, os instantes de **publicação**, **aceite** e
**coleta confirmada**. Com isso mede-se:

- a **mediana do tempo publicação → coleta** (o gargalo que Marta supõe);
- a **fração de doações que expiram sem coleta** (o desfecho que importa).

**Como a hipótese é validada ou refutada.** Cruzando as duas métricas: se as doações que
expiram forem justamente as de maior tempo até a coleta, a hipótese se sustenta e atacar
o tempo de coleta é prioridade. Se doações expirarem mesmo com tempo curto — ou se o
tempo for baixo e mesmo assim houver muito desperdício —, o gargalo é outro (falta de
ONG interessada, doação publicada tarde demais, janela curta demais) e o foco muda. O
experimento é barato: usa dados que a própria história zero já produz, sem construir
nada além do que o piloto precisa.

## Decisão de análise
- **Problema:**
- **Alternativas:**
- **Decisão e justificativa:**
- **Riscos e limitações:**

## Uso de IA

| Aula | Nível declarado | O que a IA fez | O que nós fizemos |
|---|---|---|---|
| 2 : stakeholders, objetivos e conflitos | IA para consulta | produziu o rascunho estruturado a partir do caso: tabela interesse × influência, formato "sujeito · condição · efeito" das regras e primeira versão do critério de decisão | revisamos ponto a ponto na revisão do Pull Request, conferimos cada regra contra o caso e assumimos as decisões: quais stakeholders além dos citados no caso entram, quais métricas medem os objetivos e qual critério resolve o conflito principal |
| 3 : histórias de usuário | IA como colaboradora | gerou uma primeira leva de oito histórias a partir do caso, sem filtro | avaliamos as oito pelo INVEST e mexemos em quatro: a que era tarefa técnica ("criar a tabela de doações no banco") virou H1, escrita do ponto de vista do doador; o "módulo completo de gestão" era épico e virou H6, que quebramos em H6a, H6b e H6c; a que já era critério de aceite (validar validade no passado e retornar erro 400) voltou a ser critério de aceite de H1; e "fazer login" ficou fora do recorte, porque não aparece em nenhuma regra de negócio nem em nenhum objetivo de impacto |
| 4 : critérios de aceite, riscos e hipótese | IA como colaboradora | redigiu os critérios no formato Dado/Quando/Então a partir das histórias e das regras já aprovadas, e uma primeira versão dos riscos e do experimento | conferimos cada critério contra o código que existe no repositório e corrigimos três pontos: um critério citava a RNI1 sem tratá-la, faltava o critério da validade vencida que a Aula 3 tinha prometido a H1 (virou CA1.3), e a afirmação de que os critérios casavam um a um com os cinco `it.todo` era falsa — levantamos o mapeamento real, em que o primeiro teste cobre dois critérios. Escolhemos os riscos R1 e R2 entre os candidatos e definimos as duas métricas do experimento |
| 4 : walking skeleton | IA como colaboradora | implementou as duas camadas que faltavam (`src/repositorio.js` e `src/doacoes.js`) e converteu os cinco `it.todo` do template em testes reais, mais o sexto teste do CA1.3 | rodamos a suíte e o servidor para conferir o fluxo ponta a ponta pelas rotas. Verificamos que o teste do CA1.3 realmente falha quando a validação é removida, em vez de aceitar o verde. Corrigimos duas coisas na proposta da IA: a validade seria comparada com `toISOString()`, que devolve a data em UTC e erraria o dia nas últimas três horas do horário de Brasília, e os testes usavam uma validade fixa que já estava vencida — passaram a usar datas relativas ao dia da execução |


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

**H1 → H2 → H3**: o doador publica uma doação, a ONG vê a lista de disponíveis, a ONG aceita e a doação some para as demais. É fina na largura e completa na profundidade, atravessa interface, regra de negócio e banco, e é o que o repositório já tem esboçado: as rotas `POST /api/doacoes`, `GET /api/doacoes` e `POST /api/doacoes/:id/aceitar` em `src/app.js`, e os cinco `it.todo` de `tests/doacoes.test.js`, que são exatamente os critérios de aceite dessa fatia.

**Fica de fora de propósito**, para a fatia não engordar: janela de retirada (RN2),
prioridade por proximidade (RN4) e confirmação de coleta com devolução da doação à lista
(RNI3), as três exigem dados que o modelo atual não tem. Ficam registradas como regra do
domínio e entram, ou não, nas próximas iterações.

## Critérios de aceite
**História X** — Dado … Quando … Então …

## Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|

## Hipótese e experimento

## Decisão de análise
- **Problema:**
- **Alternativas:**
- **Decisão e justificativa:**
- **Riscos e limitações:**

## Uso de IA

| Aula | Nível declarado | O que a IA fez | O que nós fizemos |
|---|---|---|---|
| 2 : stakeholders, objetivos e conflitos | IA para consulta | produziu o rascunho estruturado a partir do caso: tabela interesse × influência, formato "sujeito · condição · efeito" das regras e primeira versão do critério de decisão | revisamos ponto a ponto na revisão do Pull Request, conferimos cada regra contra o caso e assumimos as decisões: quais stakeholders além dos citados no caso entram, quais métricas medem os objetivos e qual critério resolve o conflito principal |
| 3 : histórias de usuário | IA como colaboradora | gerou uma primeira leva de oito histórias a partir do caso, sem filtro | avaliamos cada uma pelo INVEST, descartamos as que não eram história, quebramos o épico e escolhemos a história zero. As correções estão registradas abaixo |


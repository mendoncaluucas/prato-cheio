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
| # | História (Como… quero… para…) | INVEST: o que falha |
|---|---|---|

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


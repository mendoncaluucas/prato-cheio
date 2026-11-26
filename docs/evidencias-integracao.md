# Evidências dos testes de integração

Registro dos cenários de integração do Prato Cheio: o que foi feito, o que se esperava, o que
aconteceu e onde conferir. Os cenários estão em `tests/integracao.test.js` e atravessam várias
funcionalidades pela API (supertest contra o app real) e pelo PostgreSQL. Os testes por critério
de aceite continuam em `tests/doacoes.test.js`.

Tudo o que aparece abaixo foi executado em 26/11/2026 num PostgreSQL 18 descartável
(`postgres:18-alpine`, em contêiner local), com `DATABASE_URL` apontando para ele. As respostas
foram capturadas chamando a API com as mesmas requisições dos testes; os campos de cada
doação foram resumidos a `id`, `tipo`, `status`, `ong` e `motivo_retirada`, e as validades
(hoje + 7 dias) foram omitidas das tabelas.

## Como reproduzir

```bash
export DATABASE_URL=postgres://pratocheio:pratocheio@localhost:5432/pratocheio  # banco descartável
npx vitest run tests/integracao.test.js   # só os cenários de integração
npm test                                  # suíte inteira (86 testes)
npm run test:cobertura                    # suíte inteira com cobertura
```

Os testes apagam os dados do banco. Nunca aponte `DATABASE_URL` para o banco do grupo.

## Resultado da execução

| Execução | Resultado |
|---|---|
| `npx vitest run tests/integracao.test.js`, três vezes seguidas | 7 passaram em cada uma |
| `npm test` (79 testes anteriores + 7 novos) | 3 arquivos, 86 testes passaram |

Verificação de que os testes pegam falhas: removido o `AND status = ?` do `UPDATE` de
`aceitar()` em `src/repositorio.js`, o teste da corrida sem HTTP falhou nas três execuções
(`expected [...] to have a length of 1 but got 6`). Com o código original voltou a passar.
Fazendo `relatorio.js` contar a doação retirada como "em aberto", o cenário 2 falhou
(1 teste). As duas alterações foram desfeitas.

O teste da corrida pela API (várias ONGs via supertest) não detecta a remoção desse
`AND status = ?`: as requisições HTTP quase sempre se serializam e a checagem prévia da regra
recusa as perdedoras sozinha. Por isso existe o teste seguinte, que chama a regra direto.

## Cenário 1: da publicação à coleta (caminho feliz)

Teste: `integração entre funcionalidades > cenário 1: da publicação à coleta, e o relatório reflete a coleta`.

Funcionalidades: publicar doação, listar disponíveis, aceitar, aguardando coleta, confirmar coleta, relatório semanal.

| Passo | Requisição | Esperado | Obtido |
|---|---|---|---|
| 1 | `POST /api/doacoes` Sopa, depois Pão | 201, status `disponivel` | 201, ids 341 e 342, `disponivel` |
| 2 | `GET /api/doacoes` e `GET /api/doacoes/aceitas` | as duas doações disponíveis; nada aguardando coleta | `[341, 342]` e `[]` |
| 3 | `POST /api/doacoes/341/aceitar` `{"ong":"Amigos do Bem"}` | 200, `aceita`, em nome da ONG | `200 {"id":341,"status":"aceita","ong":"Amigos do Bem"}` |
| 4 | `GET /api/doacoes` e `GET /api/doacoes/aceitas` | só a 342 disponível; a 341 aguardando coleta | `[342]` e `[341]` com `ong: "Amigos do Bem"` |
| 5 | `POST /api/doacoes/341/coletar` | 200, `coletada` | `200 {"id":341,"status":"coletada","ong":"Amigos do Bem"}` |
| 6 | `GET /api/doacoes/aceitas` | vazio | `[]` |
| 7 | `GET /api/relatorios/semanal` | 2 publicadas, 1 coletada, 1 em aberto, taxa de 50% | ver abaixo |

Relatório obtido no passo 7:

```json
[{"semana":"2026-11-23","publicadas":2,"coletadas":1,"coletadasAposVencimento":0,"retiradas":0,"vencidasSemColeta":0,"emAberto":1,"taxaColeta":50,"medianaHorasAteColeta":0}]
```

Evidência: o teste passou nas três execuções; comando `npx vitest run tests/integracao.test.js`.

## Cenário 2: doação retirada por denúncia

Teste: `integração entre funcionalidades > cenário 2: doação retirada por denúncia some de todas as listas e não pode ser aceita`.

Funcionalidades: publicar, retirar com motivo, aceitar (recusa), confirmar coleta (recusa), as três listas, relatório.

| Passo | Requisição | Esperado | Obtido |
|---|---|---|---|
| 1 | `POST /api/doacoes` Iogurte e Arroz | 201 nas duas | ids 343 e 344, `disponivel` |
| 2 | `POST /api/doacoes/343/retirar` `{"motivo":"   "}` | 400, motivo obrigatório | `400 {"erro":"informe o motivo da retirada"}` |
| 3 | `POST /api/doacoes/343/retirar` com motivo | 200, `retirada`, motivo registrado | `200 {"id":343,"status":"retirada","motivo_retirada":"embalagem estufada, denunciada por um doador"}` |
| 4 | `POST /api/doacoes/343/aceitar` | 400 dizendo que foi retirada | `400 {"erro":"esta doação foi retirada da lista por ser imprópria"}` |
| 5 | `POST /api/doacoes/343/coletar` | 400 | `400 {"erro":"esta doação foi retirada da lista por ser imprópria e não deve ser buscada"}` |
| 6 | `GET /api/doacoes`, `/vencidas`, `/aceitas` | só a 344 em disponíveis; as outras vazias | `[344]`, `[]`, `[]` |
| 7 | `GET /api/relatorios/semanal` | 2 publicadas, 1 retirada, 1 em aberto, 0 coletadas | ver abaixo |

```json
[{"semana":"2026-11-23","publicadas":2,"coletadas":0,"coletadasAposVencimento":0,"retiradas":1,"vencidasSemColeta":0,"emAberto":1,"taxaColeta":0,"medianaHorasAteColeta":null}]
```

Evidência: o teste passou nas três execuções. A mutação do relatório descrita acima derrubou este cenário.

## Cenário 3: doação vencida sem aceite

Teste: `integração entre funcionalidades > cenário 3: doação vencida sem aceite aparece só em vencidas e o relatório a conta como perdida`.

A API recusa publicar com validade passada, então a doação vencida é gravada direto por `repo.inserir()`, como se tivesse sido publicada dias atrás (validade ontem).

| Passo | Requisição | Esperado | Obtido |
|---|---|---|---|
| 1 | doação vencida (id 345) pelo repositório; `POST /api/doacoes` Leite | Leite com 201 | id 346, `disponivel` |
| 2 | `GET /api/doacoes` e `GET /api/doacoes/vencidas` | só o Leite disponível; só o Pão vencido | `[346]` e `[345]` |
| 3 | `POST /api/doacoes/345/aceitar` | 400 | `400 {"erro":"doação vencida: a janela de retirada já passou"}` |
| 4 | `POST /api/doacoes/345/coletar` | 400 | `400 {"erro":"só é possível confirmar a coleta de uma doação aceita"}` |
| 5 | `POST /api/doacoes/346/aceitar` | 200 | `200 {"id":346,"status":"aceita","ong":"Amigos do Bem"}` |
| 6 | `GET /api/relatorios/semanal` | 1 vencida sem coleta, 1 em aberto | ver abaixo |

```json
[{"semana":"2026-11-23","publicadas":2,"coletadas":0,"coletadasAposVencimento":0,"retiradas":0,"vencidasSemColeta":1,"emAberto":1,"taxaColeta":0,"medianaHorasAteColeta":null}]
```

Evidência: o teste passou nas três execuções.

## Cenário de erro 1: ONGs disputando a mesma doação

Testes (dois):
- `cenário de erro: várias ONGs aceitam a mesma doação ao mesmo tempo e só uma ganha` (pela API, `Promise.all` com 6 ONGs);
- `cenário de erro: leituras simultâneas na regra de negócio, o banco garante um único aceite` (mesma disputa chamando `doacoes.aceitar` direto).

Esperado: exatamente uma ONG recebe 200; as demais recebem 400 com `doação já foi aceita por outra ONG`; a primeira segue como responsável; uma tentativa tardia recebe a mesma recusa.

Obtido (execução pela API, doação 347):

```
Amigos do Bem: 200 "Amigos do Bem"
Mesa Solidária: 400 "doação já foi aceita por outra ONG"
Pão e Afeto: 400 "doação já foi aceita por outra ONG"
Casa Acolhe: 400 "doação já foi aceita por outra ONG"
Rede Vida: 400 "doação já foi aceita por outra ONG"
Ação Fraterna: 400 "doação já foi aceita por outra ONG"
GET /api/doacoes/aceitas -> 200 [{"id":347,"status":"aceita","ong":"Amigos do Bem"}]
```

A ONG vencedora pode variar de uma execução para outra; o teste só exige que seja uma só e que
continue a dona da doação.

Evidência: os dois testes passaram nas três execuções. Sem o `AND status = ?` no `UPDATE`, o teste sem HTTP falhou (6 aceites em vez de 1).

## Cenário de erro 2: coleta e retirada simultâneas

Teste: `cenário de erro: coleta e retirada simultâneas da mesma doação, só uma vale`.

Esperado: com a doação aceita, `Promise.all([coletar, retirar])` dá um 200 e um 400, e o relatório
mostra uma coleta ou uma retirada, nunca as duas. Obtido: passou nas três execuções. A resposta
vencedora varia entre execuções, e o teste aceita as duas.

## Cenário de erro 3: erros de entrada ao longo do fluxo

Teste: `erros de entrada ao longo do fluxo recusam com a mensagem esperada e não alteram o estado`.

| Requisição | Esperado | Obtido |
|---|---|---|
| `POST /api/doacoes/99999/aceitar` | 400, não encontrada | `400 {"erro":"doação não encontrada"}` |
| `POST /api/doacoes/348/aceitar` `{"ong":""}` | 400, ONG obrigatória | `400 {"erro":"informe o nome da ONG que está aceitando a doação"}` |
| `POST /api/doacoes/348/coletar` (não aceita) | 400 | `400 {"erro":"só é possível confirmar a coleta de uma doação aceita"}` |

Depois das três recusas o teste confere que a doação segue `disponivel` e sem ONG, aceita e coleta
normalmente, e então confere duas recusas: coletar de novo (`a coleta desta doação já foi
confirmada`) e retirar uma doação coletada (`não é possível retirar uma doação que já foi
coletada`), com o relatório mantendo 1 coletada.

## Cobertura

Comando: `npm run test:cobertura` (vitest 2.1.9 com `@vitest/coverage-v8`), com o PostgreSQL
descartável e os 86 testes. O relatório em HTML vai para `coverage/`, que o git ignora.

```
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files       |   95.52 |    91.66 |   95.12 |   95.52 |
 app.js         |   93.22 |       75 |     100 |   93.22 | 24-26,54
 datas.js       |     100 |      100 |     100 |     100 |
 db.js          |      90 |    66.66 |    87.5 |      90 | 23-29,57,60-62
 doacoes.js     |     100 |      100 |     100 |     100 |
 relatorio.js   |     100 |      100 |     100 |     100 |
 repositorio.js |     100 |      100 |     100 |     100 |
 server.js      |       0 |        0 |       0 |       0 | 1-11
 status.js      |     100 |      100 |     100 |     100 |
```

Lacunas, sem correção nesta entrega:

- `server.js` (0%): é a inicialização do servidor. O CI cobre isso de outro jeito, subindo a aplicação e chamando `/api/saude`.
- `app.js` linhas 24-26 e 54: os dois caminhos que devolvem 500 (erro inesperado na rota e no tratador final). Nenhum teste força uma falha interna.
- `db.js` linhas 23-29, 57 e 60-62: o ramo do SQLite (abertura do banco e execução das consultas dentro de `query()`). Com `DATABASE_URL` definida esse ramo não roda; sem ela, o ramo do PostgreSQL ficaria sem cobertura. Os números mudam conforme o banco usado.

## CI

O workflow `.github/workflows/ci.yml` passou a ter o passo "Medir a cobertura dos testes"
(`npm run test:cobertura`), depois de `npm test`, e o resumo aparece no log do job. O
resultado do CI desta branch só existe depois do push e do Pull Request; este documento não
registra uma execução do CI que ainda não aconteceu. Para completar a evidência, anotar aqui o
link da execução quando o PR abrir.

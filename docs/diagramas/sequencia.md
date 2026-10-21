# Diagrama de sequência — duas ONGs aceitam a mesma doação (versão final)

Versão revisada a partir da [versão original da IA](original-ia.md), com as correções dos
problemas 3 e 4 da [análise crítica](analise-critica.md).

```mermaid
sequenceDiagram
    autonumber
    actor A as ONG A
    actor B as ONG B
    participant Rotas as Rotas<br/>(app.js)
    participant Regras as Regras<br/>(doacoes.js)
    participant Repo as Repositório<br/>(repositorio.js)
    participant DB as Banco

    par as duas ONGs clicam ao mesmo tempo
        A->>Rotas: POST /api/doacoes/7/aceitar { ong: "ONG A" }
        Rotas->>Regras: aceitar(7, "ONG A")
        Regras->>Repo: buscarPorId(7)
        Repo->>DB: SELECT … WHERE id = 7
        DB-->>Regras: status = 'disponivel'
        Note over Regras: verificação passa
    and
        B->>Rotas: POST /api/doacoes/7/aceitar { ong: "ONG B" }
        Rotas->>Regras: aceitar(7, "ONG B")
        Regras->>Repo: buscarPorId(7)
        Repo->>DB: SELECT … WHERE id = 7
        DB-->>Regras: status = 'disponivel'
        Note over Regras: verificação também passa:<br/>a ONG A ainda não gravou
    end

    Note over DB: o banco executa um UPDATE de cada vez

    Regras->>Repo: aceitar(7, "ONG A")
    Repo->>DB: UPDATE … SET status = 'aceita', ong = 'ONG A'<br/>WHERE id = 7 AND status = 'disponivel'
    DB-->>Repo: 1 linha atualizada
    Repo-->>Regras: doação aceita
    Regras-->>Rotas: doação
    Rotas-->>A: 200 OK

    Regras->>Repo: aceitar(7, "ONG B")
    Repo->>DB: UPDATE … SET status = 'aceita', ong = 'ONG B'<br/>WHERE id = 7 AND status = 'disponivel'
    DB-->>Repo: 0 linhas: o status já é 'aceita'
    Repo-->>Regras: nada atualizado
    Regras-->>Rotas: ErroDeNegocio "doação já foi aceita por outra ONG"
    Rotas-->>B: 400 { erro }
```

## O caso comum: as ONGs não clicam juntas

Quando a ONG B chega depois de a ONG A já ter gravado, a recusa acontece **antes** do
`UPDATE`, na verificação da aplicação:

```mermaid
sequenceDiagram
    actor B as ONG B
    participant Rotas as Rotas<br/>(app.js)
    participant Regras as Regras<br/>(doacoes.js)
    participant Repo as Repositório<br/>(repositorio.js)
    participant DB as Banco

    B->>Rotas: POST /api/doacoes/7/aceitar { ong: "ONG B" }
    Rotas->>Regras: aceitar(7, "ONG B")
    Regras->>Repo: buscarPorId(7)
    Repo->>DB: SELECT … WHERE id = 7
    DB-->>Regras: doação (ou nada)

    alt doação não existe
        Regras-->>Rotas: ErroDeNegocio "doação não encontrada"
    else status = 'retirada'
        Regras-->>Rotas: ErroDeNegocio "esta doação foi retirada da lista por ser imprópria"
    else status = 'aceita' ou 'coletada'
        Regras-->>Rotas: ErroDeNegocio "doação já foi aceita por outra ONG"
    else validade < hoje
        Regras-->>Rotas: ErroDeNegocio "doação vencida: a janela de retirada já passou"
    end
    Rotas-->>B: 400 { erro }
    Note over Repo,DB: o UPDATE nem chega a ser executado
```

## O que os dois diagramas mostram juntos (decisão D3)

| Camada | Papel | Quando age |
|---|---|---|
| Verificação em `doacoes.js` | dar a **mensagem certa** para cada motivo de recusa | quase sempre: a ONG B chega depois da ONG A |
| Condição no `UPDATE` | **garantir** que só uma ONG fique com a doação | só quando as duas passam pela verificação ao mesmo tempo |

O banco sozinho garantiria a regra, mas não saberia dizer o motivo da recusa: ele só devolve
"0 linhas". A aplicação sozinha diria o motivo, mas deixaria passar duas ONGs que verificam
ao mesmo tempo. A decisão D3 usa as duas.

Os testes `garantias no próprio UPDATE (decisão D3)`, em `tests/doacoes.test.js`, verificam
o primeiro diagrama: chamam o repositório direto, sem a verificação da aplicação, e conferem
que o segundo `UPDATE` não altera nada.

## O que mudou em relação à versão da IA

| Versão da IA | Versão final | Problema |
|---|---|---|
| Regras → Repositório direto | `buscarPorId` e a verificação antes do `UPDATE` | 3 |
| a recusa da ONG B vem do `UPDATE`, sempre | no caso comum, vem da verificação (segundo diagrama) | 3 |
| sem casos de erro | fragmento `alt` com as quatro recusas e suas mensagens | 3 |
| as ONGs em sequência | fragmento `par`: as duas leem a doação disponível antes de qualquer gravação | 4 |

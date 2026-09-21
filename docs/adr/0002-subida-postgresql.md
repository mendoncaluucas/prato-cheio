# ADR 0002 — Como o PostgreSQL vai subir na Unidade 3

- **Data:** 21/09/2026
- **Status:** aceito

## Contexto
O `src/db.js` já foi desenhado para isolar a troca de banco (SQLite → PostgreSQL) atrás
de `query()` devolvendo `{ rows }`. O README e o `.github/workflows/ci.yml` deixam
explícito que a forma como o PostgreSQL sobe é escolha do grupo, desde que fique
alcançável por `DATABASE_URL`, com schema migrado e CI verde. É preciso decidir isso antes
da refatoração da Unidade 3 para não travar o trabalho por falta de banco acessível.

## Alternativas consideradas
1. **PostgreSQL instalado localmente** — cada integrante instala na própria máquina.
   Sem custo, mas expõe divergência de versão/configuração entre Windows e Mac, e não
   resolve o banco do CI sozinho (o `ci.yml` já traz um bloco comentado usando o serviço
   `postgres` do GitHub Actions para isso).
2. **Contêiner Docker local** — mais uniforme entre integrantes que a instalação local,
   mas exige Docker instalado e algum conhecimento de `docker-compose`, que o grupo ainda
   não usou no projeto.
3. **Serviço gerenciado gratuito (Neon, Supabase ou Render)** — um único banco acessível
   por todos via `DATABASE_URL`, sem instalar nada localmente; mais próximo de produção.
   Risco: depende de internet e de limites do plano gratuito.

## Decisão
Alternativa 3: **serviço gerenciado gratuito**, usando o **Neon** com **PostgreSQL 16**,
alcançável por `DATABASE_URL`.

O que pesou foi a uniformidade. As alternativas 1 e 2 exigem que cada integrante monte o
banco na própria máquina, e o grupo trabalha em sistemas diferentes — divergência de
versão ou de configuração vira tempo perdido em depuração de ambiente, não em
refatoração, que é o que a Unidade 3 avalia. O Docker resolveria a uniformidade, mas
nenhum de nós usou `docker-compose` no projeto até aqui: seria uma ferramenta nova
aprendida no mesmo momento da troca de banco, dois riscos somados.

Entre os serviços gerenciados, o Neon foi escolhido por não exigir cartão de crédito no
plano gratuito e por entregar uma `DATABASE_URL` pronta, que é exatamente a interface
que o `src/db.js` já espera.

O CI não usa o Neon: o `ci.yml` já traz, comentado, o bloco do serviço `postgres` do
GitHub Actions. O pipeline sobe o seu próprio banco descartável a cada execução, sem
depender de rede externa nem gastar cota do plano gratuito.

## Consequências
- Positivas: um único banco para todo o grupo, sem instalação local; ambiente mais
  próximo de produção que SQLite em arquivo; o CI segue independente, com banco próprio
  e descartável; a troca fica contida em `src/db.js`, como a interface foi desenhada.
- Negativas / o que abrimos mão: passa a ser necessária internet para rodar a aplicação
  localmente na Unidade 3 — hoje o SQLite funciona offline. Ficamos sujeitos aos limites
  do plano gratuito (tamanho de banco e suspensão por inatividade, que adiciona alguns
  segundos na primeira conexão).
- Riscos e o que fazer se der errado: se o Neon ficar indisponível ou o plano mudar, a
  saída é a alternativa 2 (contêiner local), já que só muda a `DATABASE_URL` — nenhuma
  regra de negócio depende de onde o banco está. A credencial vai em variável de
  ambiente, nunca commitada; o `.env.example` documenta o formato esperado.

## Rastreabilidade
Atende ao requisito do README de banco alcançável por `DATABASE_URL` com CI verde, e à
troca de banco já prevista na interface de `src/db.js`.

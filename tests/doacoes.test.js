import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar, conexao } from '../src/db.js';
import * as repo from '../src/repositorio.js';

const app = criarApp();

// Datas relativas ao dia da execução: uma validade fixa venceria com o tempo e
// passaria a bater na regra do CA1.3, quebrando testes que nada têm a ver com ela.
function emDias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

const VALIDADE_FUTURA = emDias(7);
const VALIDADE_VENCIDA = emDias(-1);

const doacaoValida = {
  tipo: 'Sopa',
  quantidade: '10 porções',
  validade: VALIDADE_FUTURA
};

function publicar(doacao = doacaoValida) {
  return request(app).post('/api/doacoes').send(doacao);
}

function aceitar(id, ong) {
  return request(app).post(`/api/doacoes/${id}/aceitar`).send({ ong });
}

function coletar(id) {
  return request(app).post(`/api/doacoes/${id}/coletar`).send();
}

// Uma doação que venceu depois de publicada. Pela API isso é impossível de montar —
// a RNI1 recusa publicar com validade no passado —, então o teste grava direto pelo
// repositório, como se a doação tivesse sido publicada dias atrás.
function publicadaQueVenceu() {
  return repo.inserir({ tipo: 'Pão', quantidade: '5', validade: VALIDADE_VENCIDA });
}

describe('a aplicação sobe', () => {
  it('responde na verificação de saúde', async () => {
    const res = await request(app).get('/api/saude');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('publicar e listar doações', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // CA1.1 e CA2.1
  // Dado que um doador publicou uma doação
  // Quando uma ONG consulta as doações disponíveis
  // Então a doação aparece na lista, com status 'disponivel'
  it('mostra a doação publicada na lista de disponíveis', async () => {
    const criada = await publicar();
    expect(criada.status).toBe(201);
    expect(criada.body.status).toBe('disponivel');

    const res = await request(app).get('/api/doacoes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Sopa');
  });

  // CA1.2
  // Dado um doador publicando sem todos os campos obrigatórios
  // Quando o cadastro é enviado
  // Então a API recusa com 400 e nada é criado
  it('recusa doação sem os campos obrigatórios', async () => {
    const res = await publicar({ tipo: 'Sopa' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBeTruthy();

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // CA1.3 (RNI1)
  // Dado um doador publicando uma doação com validade já vencida
  // Quando o cadastro é enviado
  // Então a API recusa com 400 e nada é criado
  it('recusa doação com validade já vencida', async () => {
    const res = await publicar({ ...doacaoValida, validade: VALIDADE_VENCIDA });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBeTruthy();

    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });
});

describe('aceitar uma doação', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // CA3.1
  // Dado que existe uma doação disponível
  // Quando uma ONG a aceita
  // Então ela passa a constar como aceita por aquela ONG
  it('marca a doação como aceita pela ONG', async () => {
    const criada = await publicar();

    const res = await aceitar(criada.body.id, 'Amigos do Bem');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aceita');
    expect(res.body.ong).toBe('Amigos do Bem');
  });

  // CA2.2
  // Dado que uma doação foi aceita por uma ONG
  // Quando outra ONG consulta as doações disponíveis
  // Então essa doação não aparece mais na lista
  it('remove a doação da lista de disponíveis depois de aceita', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');

    const res = await request(app).get('/api/doacoes');
    expect(res.body).toHaveLength(0);
  });

  // CA3.2 (RNI2)
  // Dado que uma doação já foi aceita por uma ONG
  // Quando outra ONG tenta aceitar a mesma doação
  // Então a API recusa com 400 e a primeira ONG segue como responsável
  it('recusa aceitar uma doação que já foi aceita por outra ONG', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');

    const res = await aceitar(criada.body.id, 'Outra ONG');

    expect(res.status).toBe(400);
    expect(res.body.erro).toBeTruthy();
  });

  // ADR 0001 — a hora do aceite passa a ser registrada
  it('registra a hora do aceite', async () => {
    const criada = await publicar();
    expect(criada.body.aceita_em).toBeNull();

    const res = await aceitar(criada.body.id, 'Amigos do Bem');

    expect(res.body.aceita_em).toBeTruthy();
  });
});

describe('janela de retirada (RN2)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // Dado uma doação publicada cuja validade já passou
  // Quando uma ONG consulta as doações disponíveis
  // Então essa doação não aparece
  it('não mostra na lista uma doação que venceu depois de publicada', async () => {
    await publicadaQueVenceu();
    await publicar();

    const res = await request(app).get('/api/doacoes');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Sopa');
  });

  // A validade do próprio dia ainda vale, como na publicação (CA1.3)
  it('mostra na lista uma doação que vence hoje', async () => {
    await publicar({ ...doacaoValida, validade: emDias(0) });

    const res = await request(app).get('/api/doacoes');

    expect(res.body).toHaveLength(1);
  });

  // Dado uma doação que venceu, mas ainda aberta na tela de uma ONG
  // Quando a ONG tenta aceitá-la
  // Então a API recusa com 400, porque fora da janela ela não está mais disponível
  it('recusa aceitar uma doação que já venceu', async () => {
    const vencida = await publicadaQueVenceu();

    const res = await aceitar(vencida.id, 'Amigos do Bem');

    expect(res.status).toBe(400);
    expect(res.body.erro).toBeTruthy();
  });
});

describe('confirmar a coleta (ADR 0001)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // Dado uma doação aceita por uma ONG
  // Quando a ONG confirma que buscou
  // Então a doação passa a coletada e a hora da coleta fica registrada
  it('marca a doação como coletada e registra a hora', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');

    const res = await coletar(criada.body.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('coletada');
    expect(res.body.ong).toBe('Amigos do Bem');
    expect(res.body.coletada_em).toBeTruthy();
  });

  // As três marcas que o experimento da hipótese mede ficam preenchidas
  it('guarda as três marcas temporais ao fim do ciclo', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');

    const res = await coletar(criada.body.id);

    expect(res.body.criada_em).toBeTruthy();
    expect(res.body.aceita_em).toBeTruthy();
    expect(res.body.coletada_em).toBeTruthy();
  });

  // A mensagem é conferida porque o UPDATE condicional também barraria esse caso,
  // mas sem saber o motivo: é a verificação anterior que explica a recusa à ONG.
  it('recusa confirmar a coleta de uma doação que ninguém aceitou', async () => {
    const criada = await publicar();

    const res = await coletar(criada.body.id);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/doação aceita/);
  });

  it('recusa confirmar duas vezes a mesma coleta', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');
    const primeira = await coletar(criada.body.id);

    const res = await coletar(criada.body.id);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi confirmada/);
    const doacao = await repo.buscarPorId(criada.body.id);
    expect(doacao.coletada_em).toBe(primeira.body.coletada_em);
  });

  it('recusa confirmar a coleta de uma doação que não existe', async () => {
    const res = await coletar(9999);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });

  it('lista as aceitas que aguardam coleta, e tira da lista as já coletadas', async () => {
    const a = await publicar();
    const b = await publicar({ ...doacaoValida, tipo: 'Pão' });
    await publicar({ ...doacaoValida, tipo: 'Frutas' });
    await aceitar(a.body.id, 'Amigos do Bem');
    await aceitar(b.body.id, 'Amigos do Bem');
    await coletar(a.body.id);

    const res = await request(app).get('/api/doacoes/aceitas');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].tipo).toBe('Pão');
  });
});

describe('migração do banco (ADR 0001)', () => {
  afterAll(async () => { await encerrar(); });

  // Quem já tinha um dados.sqlite da Unidade 1 não pode precisar apagá-lo:
  // migrar() acrescenta as colunas novas a uma tabela que existia sem elas.
  it('acrescenta aceita_em e coletada_em a uma tabela criada na Unidade 1', async () => {
    await migrar();
    conexao().exec(`
      DROP TABLE doacoes;
      CREATE TABLE doacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL,
        quantidade TEXT NOT NULL, validade TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'disponivel', ong TEXT,
        criada_em TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await migrar();

    const colunas = conexao().prepare('PRAGMA table_info(doacoes)').all().map((c) => c.name);
    expect(colunas).toContain('aceita_em');
    expect(colunas).toContain('coletada_em');
  });
});

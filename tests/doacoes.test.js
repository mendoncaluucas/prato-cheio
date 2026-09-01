import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';

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
});

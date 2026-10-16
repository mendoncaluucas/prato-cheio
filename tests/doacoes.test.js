import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar, conexao } from '../src/db.js';
import * as repo from '../src/repositorio.js';
import { montarRelatorioSemanal } from '../src/doacoes.js';

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

function retirar(id, motivo) {
  return request(app).post(`/api/doacoes/${id}/retirar`).send({ motivo });
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

describe('retirar doação denunciada (H6c)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // CA6c.1
  // Dado uma doação disponível denunciada como imprópria
  // Quando quem administra a retira informando o motivo
  // Então ela passa a retirada, some da lista e o motivo e a hora ficam registrados
  it('retira uma doação disponível e registra o motivo e a hora', async () => {
    const criada = await publicar();

    const res = await retirar(criada.body.id, 'embalagem violada');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('retirada');
    expect(res.body.motivo_retirada).toBe('embalagem violada');
    expect(res.body.retirada_em).toBeTruthy();
    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(0);
  });

  // CA6c.2
  // Dado uma doação já aceita por uma ONG, mas ainda não coletada
  // Quando quem administra a retira
  // Então ela sai de "aguardando coleta" e a ONG não consegue mais confirmar a coleta
  it('retira uma doação aceita e impede a coleta', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');

    await retirar(criada.body.id, 'fora da temperatura adequada');

    const aguardando = await request(app).get('/api/doacoes/aceitas');
    expect(aguardando.body).toHaveLength(0);
    const res = await coletar(criada.body.id);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/retirada/);
  });

  // CA6c.3
  // Dado uma doação disponível
  // Quando quem administra tenta retirá-la sem informar o motivo
  // Então a API recusa com 400 e a doação continua disponível
  it('recusa retirar sem motivo', async () => {
    const criada = await publicar();

    const semMotivo = await retirar(criada.body.id);
    const emBranco = await retirar(criada.body.id, '   ');

    expect(semMotivo.status).toBe(400);
    expect(emBranco.status).toBe(400);
    expect(semMotivo.body.erro).toMatch(/motivo/);
    const lista = await request(app).get('/api/doacoes');
    expect(lista.body).toHaveLength(1);
  });

  // CA6c.4
  // Dado uma doação já coletada
  // Quando quem administra tenta retirá-la
  // Então a API recusa com 400, porque o alimento já foi entregue
  it('recusa retirar uma doação que já foi coletada', async () => {
    const criada = await publicar();
    await aceitar(criada.body.id, 'Amigos do Bem');
    await coletar(criada.body.id);

    const res = await retirar(criada.body.id, 'denúncia tardia');

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/coletada/);
  });

  // CA6c.5
  it('recusa retirar duas vezes, mantendo o primeiro motivo', async () => {
    const criada = await publicar();
    await retirar(criada.body.id, 'embalagem violada');

    const res = await retirar(criada.body.id, 'outro motivo');

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/já foi retirada/);
    const doacao = await repo.buscarPorId(criada.body.id);
    expect(doacao.motivo_retirada).toBe('embalagem violada');
  });

  // CA6c.6
  it('recusa aceitar uma doação retirada, dizendo o motivo real', async () => {
    const criada = await publicar();
    await retirar(criada.body.id, 'embalagem violada');

    const res = await aceitar(criada.body.id, 'Amigos do Bem');

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/retirada/);
  });

  it('recusa retirar uma doação que não existe', async () => {
    const res = await retirar(9999, 'qualquer');

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });
});

// Grava uma doação com as marcas de hora escolhidas pelo teste, no formato UTC que o
// banco usa ('AAAA-MM-DD HH:MM:SS'). Pela API as horas seriam sempre "agora".
function doacaoEm(criadaEm, { status = 'disponivel', coletadaEm = null, validade = VALIDADE_FUTURA } = {}) {
  conexao().prepare(
    `INSERT INTO doacoes (tipo, quantidade, validade, status, criada_em, coletada_em)
     VALUES ('Sopa', '10', ?, ?, ?, ?)`
  ).run(validade, status, criadaEm, coletadaEm);
}

function relatorio() {
  return request(app).get('/api/relatorios/semanal');
}

describe('relatório semanal (H6b)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // CA6b.1
  // Dado doações publicadas em semanas diferentes
  // Quando Marta consulta o relatório
  // Então há uma linha por semana, identificada pela segunda-feira, da mais recente para a mais antiga
  it('agrupa por semana, da mais recente para a mais antiga', async () => {
    doacaoEm('2026-10-05 10:00:00'); // segunda
    doacaoEm('2026-10-11 20:00:00'); // domingo da mesma semana
    doacaoEm('2026-10-12 09:00:00'); // segunda seguinte

    const res = await relatorio();

    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.semana)).toEqual(['2026-10-12', '2026-10-05']);
    expect(res.body[1].publicadas).toBe(2);
  });

  // CA6b.2
  // Dado doações em todas as situações possíveis numa mesma semana
  // Quando Marta consulta o relatório
  // Então cada doação aparece em exatamente uma situação, e as situações somam as publicadas
  it('conta cada doação em uma única situação', async () => {
    doacaoEm('2026-10-05 10:00:00', { status: 'coletada', coletadaEm: '2026-10-05 12:00:00' });
    doacaoEm('2026-10-05 10:00:00', { status: 'retirada' });
    doacaoEm('2026-10-05 10:00:00', { status: 'disponivel', validade: VALIDADE_VENCIDA });
    doacaoEm('2026-10-05 10:00:00', { status: 'aceita', validade: VALIDADE_VENCIDA });
    doacaoEm('2026-10-05 10:00:00', { status: 'disponivel' });

    const [s] = (await relatorio()).body;

    expect(s).toMatchObject({
      publicadas: 5, coletadas: 1, coletadasAposVencimento: 0, retiradas: 1, vencidasSemColeta: 2, emAberto: 1
    });
    expect(
      s.coletadas + s.coletadasAposVencimento + s.retiradas + s.vencidasSemColeta + s.emAberto
    ).toBe(s.publicadas);
  });

  // CA6b.3
  // Dado uma semana com doações retiradas por serem impróprias
  // Quando a taxa de coleta é calculada
  // Então as retiradas ficam fora do denominador
  it('calcula a taxa de coleta sem contar as retiradas', async () => {
    doacaoEm('2026-10-05 10:00:00', { status: 'coletada', coletadaEm: '2026-10-05 11:00:00' });
    doacaoEm('2026-10-05 10:00:00', { status: 'disponivel', validade: VALIDADE_VENCIDA });
    doacaoEm('2026-10-05 10:00:00', { status: 'retirada' });
    doacaoEm('2026-10-05 10:00:00', { status: 'retirada' });

    const [s] = (await relatorio()).body;

    expect(s.taxaColeta).toBe(50); // 1 coletada de 2 consideradas, não de 4 publicadas
  });

  // CA6b.4 — situação de erro: sem denominador, não há taxa
  it('não calcula taxa quando todas as doações da semana foram retiradas', async () => {
    doacaoEm('2026-10-05 10:00:00', { status: 'retirada' });

    const [s] = (await relatorio()).body;

    expect(s.taxaColeta).toBeNull();
  });

  // Pela API, um 0/0 sem proteção viraria NaN e o JSON o transformaria em null, e o
  // teste acima passaria do mesmo jeito. Chamando a função direto, a diferença aparece.
  it('devolve null, e não NaN, para a taxa sem denominador', () => {
    const [s] = montarRelatorioSemanal(
      [{ criada_em: '2026-10-05 10:00:00', status: 'retirada', validade: '2026-12-31', coletada_em: null }],
      '2026-10-16'
    );

    expect(s.taxaColeta).toBeNull();
  });

  // CA6b.5
  // Dado doações coletadas com tempos diferentes desde a publicação
  // Quando Marta consulta o relatório
  // Então ela vê a mediana de horas entre publicação e coleta, a medida do experimento da hipótese
  it('mostra a mediana de horas entre publicação e coleta', async () => {
    doacaoEm('2026-10-05 08:00:00', { status: 'coletada', coletadaEm: '2026-10-05 09:00:00' }); // 1 h
    doacaoEm('2026-10-05 08:00:00', { status: 'coletada', coletadaEm: '2026-10-05 11:00:00' }); // 3 h
    doacaoEm('2026-10-05 08:00:00', { status: 'coletada', coletadaEm: '2026-10-06 08:00:00' }); // 24 h
    doacaoEm('2026-10-05 08:00:00', { status: 'disponivel' }); // sem coleta: fora da mediana

    const [s] = (await relatorio()).body;

    expect(s.medianaHorasAteColeta).toBe(3); // e não a média, que daria 9,3
  });

  it('não mostra mediana numa semana sem coletas', async () => {
    doacaoEm('2026-10-05 08:00:00');

    const [s] = (await relatorio()).body;

    expect(s.medianaHorasAteColeta).toBeNull();
    expect(s.taxaColeta).toBe(0);
  });

  // CA6b.6 — situação de borda: sem doações, o relatório vem vazio, não com erro
  it('devolve lista vazia quando não há doações', async () => {
    const res = await relatorio();

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // A semana é a da hora gravada, em UTC (limitação registrada no ADR 0006)
  it('separa domingo 23h59 e segunda 00h00 em semanas diferentes', async () => {
    doacaoEm('2026-10-11 23:59:59');
    doacaoEm('2026-10-12 00:00:00');

    const res = await relatorio();

    expect(res.body).toHaveLength(2);
  });
});

// Decisão D3: a condição de status fica no próprio UPDATE. Pela API, a verificação de
// doacoes.js barra esses casos antes, então a condição do banco só agiria numa corrida
// real entre duas requisições. Estes testes chamam o repositório direto, sem a
// verificação, para provar que o banco sozinho também recusa.
describe('coleta após o vencimento (H6b, opção registrada no projeto)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // Horários ao meio-dia em UTC: no fuso do Brasil continua sendo o mesmo dia, então o
  // teste dá o mesmo resultado aqui e no CI, que roda em UTC.
  // CA6b.7
  it('conta à parte a coleta confirmada depois da validade, fora da taxa', async () => {
    doacaoEm('2026-10-05 12:00:00', { status: 'coletada', validade: '2026-10-07', coletadaEm: '2026-10-06 12:00:00' });
    doacaoEm('2026-10-05 12:00:00', { status: 'coletada', validade: '2026-10-06', coletadaEm: '2026-10-09 12:00:00' });

    const [s] = (await relatorio()).body;

    expect(s.coletadas).toBe(1);
    expect(s.coletadasAposVencimento).toBe(1);
    expect(s.taxaColeta).toBe(50); // só a coletada no prazo conta como comida salva
  });

  it('considera no prazo a coleta feita no próprio dia da validade', async () => {
    doacaoEm('2026-10-05 12:00:00', { status: 'coletada', validade: '2026-10-06', coletadaEm: '2026-10-06 15:00:00' });

    const [s] = (await relatorio()).body;

    expect(s.coletadas).toBe(1);
    expect(s.coletadasAposVencimento).toBe(0);
  });

  it('continua permitindo confirmar a coleta de uma doação aceita que já venceu', async () => {
    const { id } = await repo.inserir({ tipo: 'Pão', quantidade: '5', validade: VALIDADE_FUTURA });
    await repo.aceitar(id, 'Amigos do Bem');
    conexao().prepare('UPDATE doacoes SET validade = ? WHERE id = ?').run(VALIDADE_VENCIDA, id);

    const res = await coletar(id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('coletada');
  });
});

describe('validação de entrada', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  async function nadaFoiCriado() {
    const { rows } = { rows: conexao().prepare('SELECT COUNT(*) AS n FROM doacoes').all() };
    expect(rows[0].n).toBe(0);
  }

  // Com a validade comparada como texto, estes formatos escapavam da RN2 e da RNI1:
  // "31/12/2020" ficava disponível para sempre, mesmo vencida.
  it.each([
    ['formato brasileiro', '31/12/2020'],
    ['texto qualquer', 'abc'],
    ['número', 20261231],
    ['dia que não existe', '2027-02-31'],
    ['mês que não existe', '2027-13-01']
  ])('recusa validade em %s', async (_, validade) => {
    const res = await publicar({ ...doacaoValida, validade });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/AAAA-MM-DD/);
    await nadaFoiCriado();
  });

  it('recusa campos preenchidos só com espaços (RN1)', async () => {
    const res = await publicar({ tipo: '   ', quantidade: '  ', validade: VALIDADE_FUTURA });

    expect(res.status).toBe(400);
    await nadaFoiCriado();
  });

  it('grava os textos sem os espaços das pontas', async () => {
    const res = await publicar({ ...doacaoValida, tipo: '  Sopa  ', quantidade: ' 10 porções ' });

    expect(res.body.tipo).toBe('Sopa');
    expect(res.body.quantidade).toBe('10 porções');
  });

  // Um objeto no lugar de um texto era tratado pelo node:sqlite como parâmetros
  // nomeados, e os valores seguintes escorregavam para a coluna errada.
  it('recusa um objeto no lugar de um texto, sem chegar ao banco', async () => {
    const res = await publicar({ tipo: {}, quantidade: VALIDADE_FUTURA, validade: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('tipo, quantidade e validade são obrigatórios');
    await nadaFoiCriado();
  });

  // CA3.1: a doação fica registrada "em nome daquela ONG". Antes, sem nome, ela era
  // gravada em nome de "ONG"; com nome vazio, em nome de ninguém.
  it.each([
    ['sem ONG', {}],
    ['com ONG vazia', { ong: '' }],
    ['com ONG só de espaços', { ong: '   ' }],
    ['com ONG que não é texto', { ong: {} }]
  ])('recusa aceitar %s, e a doação continua disponível', async (_, corpo) => {
    const criada = await publicar();

    const res = await request(app).post(`/api/doacoes/${criada.body.id}/aceitar`).send(corpo);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nome da ONG/);
    expect((await repo.buscarPorId(criada.body.id)).status).toBe('disponivel');
  });

  it('recusa um motivo de retirada que não é texto', async () => {
    const criada = await publicar();

    const res = await retirar(criada.body.id, { motivo: 'embalagem' });

    expect(res.status).toBe(400);
    expect((await repo.buscarPorId(criada.body.id)).status).toBe('disponivel');
  });

  it.each(['abc', '0', '-1', '1.5'])('responde "não encontrada" para o identificador %s', async (id) => {
    const res = await request(app).post(`/api/doacoes/${id}/coletar`);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não encontrada/);
  });
});

describe('robustez do servidor', () => {
  // Antes, o Express devolvia uma página HTML com o stack trace, e a interface quebrava
  // ao tentar ler a resposta como JSON.
  it('responde em JSON quando o corpo da requisição é um JSON malformado', async () => {
    const res = await request(app)
      .post('/api/doacoes')
      .set('Content-Type', 'application/json')
      .send('{"tipo":');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.erro).toMatch(/JSON/);
  });

  // ADR 0003: a troca para PostgreSQL deve ficar contida em src/db.js. datetime('now')
  // só existe no SQLite; se voltar ao repositório, a migração quebra aceite, coleta e
  // retirada.
  it('não usa função de data específica do SQLite no repositório', async () => {
    const { readFileSync } = await import('node:fs');
    const codigo = readFileSync(new URL('../src/repositorio.js', import.meta.url), 'utf8')
      .split('\n')
      .filter((linha) => !linha.trim().startsWith('//'))
      .join('\n');

    expect(codigo).not.toMatch(/datetime\s*\(/i);
  });

  it('grava as marcas de hora no mesmo formato de criada_em', async () => {
    await migrar(); await limparBanco();
    const criada = await publicar();
    const res = await aceitar(criada.body.id, 'Amigos do Bem');
    const formato = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

    expect(res.body.criada_em).toMatch(formato);
    expect(res.body.aceita_em).toMatch(formato);
    await encerrar();
  });

  // Antes, iniciar o servidor de outra pasta (o depurador do VS Code, por exemplo)
  // dava 404 na página e criava um banco novo e vazio na pasta errada.
  it('serve a interface mesmo quando iniciado de outra pasta', async () => {
    const original = process.cwd();
    const { fileURLToPath } = await import('node:url');
    process.chdir(fileURLToPath(new URL('../src', import.meta.url)));
    let outro;
    try {
      outro = criarApp();
    } finally {
      process.chdir(original);
    }

    const res = await request(outro).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Prato Cheio/);
  });
});

describe('garantias no próprio UPDATE (decisão D3)', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  it('o UPDATE do aceite não altera uma doação que já não está disponível', async () => {
    const criada = await publicar();
    await repo.aceitar(criada.body.id, 'Amigos do Bem');

    const segunda = await repo.aceitar(criada.body.id, 'Outra ONG');

    expect(segunda).toBeUndefined();
    expect((await repo.buscarPorId(criada.body.id)).ong).toBe('Amigos do Bem');
  });

  it('o UPDATE da coleta não altera uma doação que já foi coletada', async () => {
    const criada = await publicar();
    await repo.aceitar(criada.body.id, 'Amigos do Bem');
    const primeira = await repo.coletar(criada.body.id);

    const segunda = await repo.coletar(criada.body.id);

    expect(segunda).toBeUndefined();
    expect((await repo.buscarPorId(criada.body.id)).coletada_em).toBe(primeira.coletada_em);
  });

  it('o UPDATE da retirada não altera uma doação já coletada', async () => {
    const criada = await publicar();
    await repo.aceitar(criada.body.id, 'Amigos do Bem');
    await repo.coletar(criada.body.id);

    const retirada = await repo.retirar(criada.body.id, 'denúncia tardia');

    expect(retirada).toBeUndefined();
    expect((await repo.buscarPorId(criada.body.id)).status).toBe('coletada');
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
    expect(colunas).toContain('retirada_em');
    expect(colunas).toContain('motivo_retirada');
  });
});

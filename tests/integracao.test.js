// Cenários de integração: cada teste atravessa várias funcionalidades pela API real
// (supertest contra o app) e pelo PostgreSQL, em vez de conferir uma regra isolada.
// Os testes por critério de aceite estão em tests/doacoes.test.js.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';
import * as repo from '../src/repositorio.js';
import * as doacoes from '../src/doacoes.js';

const app = criarApp();

// Datas relativas ao dia da execução, pelo mesmo motivo de tests/doacoes.test.js.
function emDias(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

const VALIDADE_FUTURA = emDias(7);
const VALIDADE_VENCIDA = emDias(-1);

const publicar = (doacao) => request(app).post('/api/doacoes').send(doacao);
const aceitar = (id, ong) => request(app).post(`/api/doacoes/${id}/aceitar`).send({ ong });
const coletar = (id) => request(app).post(`/api/doacoes/${id}/coletar`).send();
const retirar = (id, motivo) => request(app).post(`/api/doacoes/${id}/retirar`).send({ motivo });

const disponiveis = () => request(app).get('/api/doacoes');
const aguardandoColeta = () => request(app).get('/api/doacoes/aceitas');
const vencidas = () => request(app).get('/api/doacoes/vencidas');
const relatorio = () => request(app).get('/api/relatorios/semanal');

const ids = (res) => res.body.map((d) => d.id);

// As doações de cada teste nascem todas agora, então caem na mesma semana. Somar as
// semanas evita que o teste quebre se rodar exatamente na virada da semana.
function totais(res) {
  const soma = (campo) => res.body.reduce((n, s) => n + s[campo], 0);
  return {
    publicadas: soma('publicadas'),
    coletadas: soma('coletadas'),
    coletadasAposVencimento: soma('coletadasAposVencimento'),
    retiradas: soma('retiradas'),
    vencidasSemColeta: soma('vencidasSemColeta'),
    emAberto: soma('emAberto')
  };
}

describe('integração entre funcionalidades', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  // Cenário 1 (caminho feliz): H1 publicar -> H2 listar -> H3 aceitar -> coleta (ADR 0001) -> H6b relatório.
  // Duas doações são publicadas: uma percorre o ciclo todo e a outra fica em aberto, para a
  // taxa do relatório (1 coletada de 2 publicadas = 50%) provar que cada situação foi contada.
  it('cenário 1: da publicação à coleta, e o relatório reflete a coleta', async () => {
    const sopa = await publicar({ tipo: 'Sopa', quantidade: '10 porções', validade: VALIDADE_FUTURA });
    const pao = await publicar({ tipo: 'Pão', quantidade: '20 unidades', validade: VALIDADE_FUTURA });
    expect(sopa.status).toBe(201);
    expect(pao.status).toBe(201);
    const idSopa = sopa.body.id;
    const idPao = pao.body.id;

    // Publicadas, as duas aparecem para a ONG; ainda não há nada aguardando coleta.
    expect(ids(await disponiveis())).toEqual([idSopa, idPao]);
    expect((await aguardandoColeta()).body).toEqual([]);

    // A ONG aceita a sopa: sai de disponíveis e entra em aguardando coleta, em nome dela.
    const aceita = await aceitar(idSopa, 'Amigos do Bem');
    expect(aceita.status).toBe(200);
    expect(aceita.body).toMatchObject({ id: idSopa, status: 'aceita', ong: 'Amigos do Bem' });
    expect(aceita.body.aceita_em).toBeTruthy();

    expect(ids(await disponiveis())).toEqual([idPao]);
    const aguardando = await aguardandoColeta();
    expect(ids(aguardando)).toEqual([idSopa]);
    expect(aguardando.body[0].ong).toBe('Amigos do Bem');

    // Antes da coleta, o relatório ainda não conta a sopa como coletada.
    expect(totais(await relatorio())).toMatchObject({ publicadas: 2, coletadas: 0, emAberto: 2 });

    // A ONG confirma a coleta: sai de aguardando coleta e não volta a disponíveis.
    const coletada = await coletar(idSopa);
    expect(coletada.status).toBe(200);
    expect(coletada.body).toMatchObject({ id: idSopa, status: 'coletada', ong: 'Amigos do Bem' });
    expect(coletada.body.coletada_em).toBeTruthy();

    expect((await aguardandoColeta()).body).toEqual([]);
    expect(ids(await disponiveis())).toEqual([idPao]);
    expect((await vencidas()).body).toEqual([]);

    // O relatório reflete: 2 publicadas, 1 coletada no prazo, 1 em aberto, taxa de 50%.
    const rel = await relatorio();
    expect(rel.status).toBe(200);
    expect(totais(rel)).toEqual({
      publicadas: 2, coletadas: 1, coletadasAposVencimento: 0,
      retiradas: 0, vencidasSemColeta: 0, emAberto: 1
    });
    expect(rel.body).toHaveLength(1);
    expect(rel.body[0].taxaColeta).toBe(50);
    expect(rel.body[0].medianaHorasAteColeta).toBeGreaterThanOrEqual(0);
    expect(rel.body[0].medianaHorasAteColeta).toBeLessThan(1);
  });

  // Cenário 2: H1 publicar -> H6c retirar por denúncia -> H3 aceitar (recusa) -> listas -> H6b relatório.
  it('cenário 2: doação retirada por denúncia some de todas as listas e não pode ser aceita', async () => {
    const impropria = await publicar({ tipo: 'Iogurte', quantidade: '30 potes', validade: VALIDADE_FUTURA });
    const boa = await publicar({ tipo: 'Arroz', quantidade: '5 kg', validade: VALIDADE_FUTURA });
    const idImpropria = impropria.body.id;
    const idBoa = boa.body.id;
    expect(ids(await disponiveis())).toEqual([idImpropria, idBoa]);

    // Retirar exige motivo: sem ele, a doação continua disponível.
    const semMotivo = await retirar(idImpropria, '   ');
    expect(semMotivo.status).toBe(400);
    expect(semMotivo.body.erro).toBe('informe o motivo da retirada');
    expect(ids(await disponiveis())).toEqual([idImpropria, idBoa]);

    // Com motivo, a retirada vale e o motivo fica registrado.
    const retirada = await retirar(idImpropria, 'embalagem estufada, denunciada por um doador');
    expect(retirada.status).toBe(200);
    expect(retirada.body).toMatchObject({
      id: idImpropria, status: 'retirada', motivo_retirada: 'embalagem estufada, denunciada por um doador'
    });
    expect(retirada.body.retirada_em).toBeTruthy();

    // A ONG tenta aceitar a doação retirada, e a recusa diz o porquê.
    const tentativa = await aceitar(idImpropria, 'Amigos do Bem');
    expect(tentativa.status).toBe(400);
    expect(tentativa.body.erro).toBe('esta doação foi retirada da lista por ser imprópria');

    // Também não dá para confirmar a coleta de uma doação retirada.
    const coleta = await coletar(idImpropria);
    expect(coleta.status).toBe(400);
    expect(coleta.body.erro).toBe('esta doação foi retirada da lista por ser imprópria e não deve ser buscada');

    // Ela não aparece em nenhuma das três listas; a doação boa segue disponível.
    expect(ids(await disponiveis())).toEqual([idBoa]);
    expect((await vencidas()).body).toEqual([]);
    expect((await aguardandoColeta()).body).toEqual([]);

    // Relatório: a retirada é contada à parte e não entra na taxa (0 coletadas de 1 considerada).
    const rel = await relatorio();
    expect(totais(rel)).toEqual({
      publicadas: 2, coletadas: 0, coletadasAposVencimento: 0,
      retiradas: 1, vencidasSemColeta: 0, emAberto: 1
    });
    expect(rel.body[0].taxaColeta).toBe(0);
  });

  // Cenário 3: doação que venceu sem aceite. A API não deixa publicar com validade passada
  // (RNI1), então ela é gravada pelo repositório, como se tivesse sido publicada dias atrás.
  // Atravessa H4a (vencidas), H2 (disponíveis), H3 (aceitar recusado) e H6b (relatório).
  it('cenário 3: doação vencida sem aceite aparece só em vencidas e o relatório a conta como perdida', async () => {
    const vencida = await repo.inserir({ tipo: 'Pão', quantidade: '5', validade: VALIDADE_VENCIDA });
    const viva = await publicar({ tipo: 'Leite', quantidade: '12 caixas', validade: VALIDADE_FUTURA });

    // Só a doação dentro da validade aparece para as ONGs; a vencida vai para o doador.
    expect(ids(await disponiveis())).toEqual([viva.body.id]);
    const lista = await vencidas();
    expect(ids(lista)).toEqual([vencida.id]);
    expect(lista.body[0].status).toBe('disponivel');

    // A ONG não consegue aceitar nem coletar a vencida.
    const tentativa = await aceitar(vencida.id, 'Amigos do Bem');
    expect(tentativa.status).toBe(400);
    expect(tentativa.body.erro).toBe('doação vencida: a janela de retirada já passou');
    const coleta = await coletar(vencida.id);
    expect(coleta.status).toBe(400);
    expect(coleta.body.erro).toBe('só é possível confirmar a coleta de uma doação aceita');
    expect((await aguardandoColeta()).body).toEqual([]);

    // A doação viva segue o fluxo normal e não aparece em vencidas.
    expect((await aceitar(viva.body.id, 'Amigos do Bem')).status).toBe(200);
    expect(ids(await vencidas())).toEqual([vencida.id]);

    // Relatório: 1 vencida sem coleta e 1 doação aceita ainda dentro do prazo (em aberto).
    expect(totais(await relatorio())).toEqual({
      publicadas: 2, coletadas: 0, coletadasAposVencimento: 0,
      retiradas: 0, vencidasSemColeta: 1, emAberto: 1
    });
  });

  // Cenário de erro: RNI2 sob concorrência, pela API. Várias ONGs aceitam a mesma doação ao
  // mesmo tempo: exatamente uma ganha, as outras recebem 400 e a vencedora segue responsável.
  // A mutação sem o AND status do UPDATE não derruba este teste (as requisições HTTP quase
  // sempre se serializam); o teste seguinte, sem HTTP, é o que prova a garantia do banco.
  it('cenário de erro: várias ONGs aceitam a mesma doação ao mesmo tempo e só uma ganha', async () => {
    const criada = await publicar({ tipo: 'Sopa', quantidade: '10 porções', validade: VALIDADE_FUTURA });
    const id = criada.body.id;
    const ongs = ['Amigos do Bem', 'Mesa Solidária', 'Pão e Afeto', 'Casa Acolhe', 'Rede Vida', 'Ação Fraterna'];

    const respostas = await Promise.all(ongs.map((ong) => aceitar(id, ong)));

    const vencedoras = respostas.filter((r) => r.status === 200);
    const perdedoras = respostas.filter((r) => r.status === 400);
    expect(vencedoras).toHaveLength(1);
    expect(perdedoras).toHaveLength(ongs.length - 1);
    for (const perdedora of perdedoras) {
      expect(perdedora.body.erro).toBe('doação já foi aceita por outra ONG');
    }

    // A ONG que ganhou continua responsável; as perdedoras não sobrescreveram o aceite.
    const ongVencedora = vencedoras[0].body.ong;
    expect(ongs).toContain(ongVencedora);
    const aguardando = await aguardandoColeta();
    expect(aguardando.body).toHaveLength(1);
    expect(aguardando.body[0]).toMatchObject({ id, status: 'aceita', ong: ongVencedora });
    expect((await disponiveis()).body).toEqual([]);

    // Uma tentativa tardia, já sem concorrência, recebe a mesma recusa e o dono não muda.
    const tardia = await aceitar(id, 'Terceira ONG');
    expect(tardia.status).toBe(400);
    expect(tardia.body.erro).toBe('doação já foi aceita por outra ONG');
    expect((await aguardandoColeta()).body[0].ong).toBe(ongVencedora);
  });

  // Mesma disputa, sem a camada HTTP. Pela API cada requisição abre a sua conexão e o aceite
  // de uma costuma terminar antes de a outra ler a doação, então a checagem prévia da regra
  // recusa sozinha. Chamando a regra direto, todas leem "disponível" antes de qualquer
  // escrita e só o UPDATE condicional do banco impede o duplo aceite.
  it('cenário de erro: leituras simultâneas na regra de negócio, o banco garante um único aceite', async () => {
    const criada = await publicar({ tipo: 'Sopa', quantidade: '10 porções', validade: VALIDADE_FUTURA });
    const id = criada.body.id;
    const ongs = ['Amigos do Bem', 'Mesa Solidária', 'Pão e Afeto', 'Casa Acolhe', 'Rede Vida', 'Ação Fraterna'];

    const resultados = await Promise.allSettled(ongs.map((ong) => doacoes.aceitar(id, ong)));

    const vencedoras = resultados.filter((r) => r.status === 'fulfilled');
    const perdedoras = resultados.filter((r) => r.status === 'rejected');
    expect(vencedoras).toHaveLength(1);
    expect(perdedoras).toHaveLength(ongs.length - 1);
    for (const perdedora of perdedoras) {
      expect(perdedora.reason).toBeInstanceOf(doacoes.ErroDeNegocio);
      expect(perdedora.reason.message).toBe('doação já foi aceita por outra ONG');
    }

    const aguardando = await aguardandoColeta();
    expect(aguardando.body).toHaveLength(1);
    expect(aguardando.body[0].ong).toBe(vencedoras[0].value.ong);
  });

  // Cenário de erro: coleta e retirada simultâneas da mesma doação aceita. O UPDATE
  // condicional faz com que apenas uma das duas mude o estado.
  it('cenário de erro: coleta e retirada simultâneas da mesma doação, só uma vale', async () => {
    const criada = await publicar({ tipo: 'Arroz', quantidade: '5 kg', validade: VALIDADE_FUTURA });
    const id = criada.body.id;
    await aceitar(id, 'Amigos do Bem');

    const [coleta, retirada] = await Promise.all([coletar(id), retirar(id, 'denúncia de impropriedade')]);

    // Uma resposta é 200; a outra é 400 (recusa da regra, ou do UPDATE condicional).
    expect([coleta.status, retirada.status].sort()).toEqual([200, 400]);

    // O estado final é o da requisição que ganhou, sem mistura dos dois.
    const rel = totais(await relatorio());
    if (coleta.status === 200) {
      expect(coleta.body.status).toBe('coletada');
      expect(rel).toMatchObject({ coletadas: 1, retiradas: 0 });
    } else {
      expect(retirada.body.status).toBe('retirada');
      expect(rel).toMatchObject({ coletadas: 0, retiradas: 1 });
    }
    expect((await aguardandoColeta()).body).toEqual([]);
  });

  // Erros de entrada ao longo do fluxo: cada um recusa com a mensagem da regra e não altera nada.
  it('erros de entrada ao longo do fluxo recusam com a mensagem esperada e não alteram o estado', async () => {
    const criada = await publicar({ tipo: 'Sopa', quantidade: '10 porções', validade: VALIDADE_FUTURA });
    const id = criada.body.id;

    // Aceitar um id que não existe.
    const inexistente = await aceitar(99999, 'Amigos do Bem');
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.erro).toBe('doação não encontrada');

    // Aceitar sem informar a ONG.
    const semOng = await aceitar(id, '');
    expect(semOng.status).toBe(400);
    expect(semOng.body.erro).toBe('informe o nome da ONG que está aceitando a doação');

    // Coletar uma doação que ainda não foi aceita.
    const coletaPrematura = await coletar(id);
    expect(coletaPrematura.status).toBe(400);
    expect(coletaPrematura.body.erro).toBe('só é possível confirmar a coleta de uma doação aceita');

    // Nada mudou: a doação segue disponível e sem ONG.
    const lista = await disponiveis();
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({ id, status: 'disponivel', ong: null });

    // Fluxo completo, e a segunda confirmação de coleta é recusada.
    await aceitar(id, 'Amigos do Bem');
    const primeira = await coletar(id);
    expect(primeira.status).toBe(200);
    const segunda = await coletar(id);
    expect(segunda.status).toBe(400);
    expect(segunda.body.erro).toBe('a coleta desta doação já foi confirmada');

    // Retirar depois de coletada também é recusado, e o relatório segue com a coleta.
    const retiradaTardia = await retirar(id, 'tarde demais');
    expect(retiradaTardia.status).toBe(400);
    expect(retiradaTardia.body.erro).toBe('não é possível retirar uma doação que já foi coletada');
    expect(totais(await relatorio())).toMatchObject({ publicadas: 1, coletadas: 1, retiradas: 0 });
  });
});

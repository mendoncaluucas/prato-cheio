// Testes da interface (public/index.html) com jsdom: sobe a aplicação de verdade, abre a
// página e clica nos botões. Protege a refatoração do código repetido de envio ao servidor.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { criarApp } from '../src/app.js';
import { migrar, limparBanco, encerrar } from '../src/db.js';

let servidor;
let base;
let janela;

async function esperar(condicao) {
  for (let i = 0; i < 100; i++) {
    if (condicao()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('a página não chegou ao estado esperado');
}

// Fecha a página depois de dar tempo para os carregamentos em andamento terminarem: o
// script da página continua rodando e falharia ao achar o documento já descartado.
async function fecharPagina() {
  if (!janela) return;
  await new Promise((r) => setTimeout(r, 200));
  janela.close();
  janela = undefined;
}

async function abrirPagina({ motivo = null } = {}) {
  await fecharPagina();
  const dom = await JSDOM.fromURL(base, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (url, opcoes) => fetch(new URL(url, base), opcoes);
      w.prompt = () => motivo;
    }
  });
  janela = dom.window;
  // O primeiro carregamento termina quando o relatório deixa de estar vazio ou mostra a nota.
  await esperar(() => janela.document.getElementById('lista').children.length > 0);
  return janela.document;
}

function botao(documento, texto) {
  return [...documento.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
}

async function publicarPelaApi(tipo = 'Sopa') {
  const validade = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await fetch(`${base}/api/doacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, quantidade: '10 porções', validade })
  });
}

beforeAll(async () => {
  await migrar();
  await new Promise((r) => { servidor = criarApp().listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

beforeEach(async () => { await limparBanco(); });

afterAll(async () => {
  await fecharPagina();
  await new Promise((r) => servidor.close(r));
  await encerrar();
});

describe('interface: ações que enviam ao servidor', () => {
  it('aceitar mostra o aviso de sucesso e tira a doação da lista', async () => {
    await publicarPelaApi('Sopa');
    const doc = await abrirPagina();

    botao(doc, 'Aceitar').click();

    await esperar(() => doc.getElementById('aviso').textContent.includes('Doação aceita: Sopa'));
    expect(doc.getElementById('aviso').className).toContain('ok');
    await esperar(() => doc.getElementById('aguardando').textContent.includes('aceita por Minha ONG'));
  });

  it('aceitar uma doação que outra ONG já aceitou mostra o erro da API', async () => {
    await publicarPelaApi();
    const doc = await abrirPagina();
    const id = (await (await fetch(`${base}/api/doacoes`)).json())[0].id;
    await fetch(`${base}/api/doacoes/${id}/aceitar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ong: 'Outra ONG' })
    });

    botao(doc, 'Aceitar').click();

    await esperar(() => doc.getElementById('aviso').className.includes('erro'));
    expect(doc.getElementById('aviso').textContent).toMatch(/já foi aceita/);
  });

  it('confirmar coleta mostra o aviso de sucesso', async () => {
    await publicarPelaApi('Pão');
    const doc = await abrirPagina();
    botao(doc, 'Aceitar').click();
    await esperar(() => botao(doc, 'Confirmar coleta'));

    botao(doc, 'Confirmar coleta').click();

    await esperar(() => doc.getElementById('aviso').textContent.includes('Coleta confirmada: Pão'));
    expect(doc.getElementById('aviso').className).toContain('ok');
  });

  it('retirar com motivo mostra o aviso de sucesso', async () => {
    await publicarPelaApi('Frutas');
    const doc = await abrirPagina({ motivo: 'embalagem violada' });

    botao(doc, 'Retirar').click();

    await esperar(() => doc.getElementById('aviso').textContent.includes('Doação retirada: Frutas'));
    expect(doc.getElementById('aviso').className).toContain('ok');
  });

  it('retirar sem motivo mostra o erro da API', async () => {
    await publicarPelaApi();
    const doc = await abrirPagina({ motivo: '' });

    botao(doc, 'Retirar').click();

    await esperar(() => doc.getElementById('aviso').className.includes('erro'));
    expect(doc.getElementById('aviso').textContent).toMatch(/motivo/);
  });

  it('retirar cancelado no prompt não envia nada', async () => {
    await publicarPelaApi();
    const doc = await abrirPagina({ motivo: null });

    botao(doc, 'Retirar').click();
    await new Promise((r) => setTimeout(r, 200));

    expect(doc.getElementById('aviso').hidden).toBe(true);
  });

  it('publicar com campos vazios mostra o erro e publicar certo limpa os campos', async () => {
    await publicarPelaApi('Base');
    const doc = await abrirPagina();

    doc.getElementById('publicar').click();
    await esperar(() => doc.getElementById('aviso').className.includes('erro'));
    expect(doc.getElementById('aviso').textContent).toMatch(/obrigatórios/);

    doc.getElementById('tipo').value = 'Arroz';
    doc.getElementById('quantidade').value = '5 kg';
    doc.getElementById('validade').value = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    doc.getElementById('publicar').click();
    await esperar(() => doc.getElementById('aviso').textContent === 'Doação publicada.');
    expect(doc.getElementById('tipo').value).toBe('');
  });
});

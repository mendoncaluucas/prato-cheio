import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { migrar, limparBanco, encerrar, query } from '../src/db.js';
import * as repo from '../src/repositorio.js';

// Roda um trecho de código num processo separado, com o ambiente que o teste escolher.
// Serve para os casos em que o módulo falha ao ser carregado.
function rodarIsolado(codigo, ambiente) {
  try {
    const saida = execFileSync(process.execPath, ['--input-type=module', '-e', codigo], {
      cwd: new URL('..', import.meta.url),
      env: { PATH: process.env.PATH, ...ambiente },
      stdio: 'pipe',
      encoding: 'utf8'
    });
    return { codigo: 0, saida };
  } catch (erro) {
    return { codigo: erro.status, saida: `${erro.stdout}${erro.stderr}` };
  }
}

describe('configuração do banco', () => {
  it('o db.js recusa subir sem DATABASE_URL e explica o motivo', () => {
    const r = rodarIsolado("await import('./src/db.js')", {});
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('DATABASE_URL');
  });

  it('o vitest recusa rodar sem DATABASE_URL_TESTE, mesmo com DATABASE_URL no ambiente', () => {
    const r = rodarIsolado("await import('./vitest.config.js')", {
      DATABASE_URL: 'postgres://usuario:senha@banco-do-grupo.neon.tech/banco'
    });
    expect(r.codigo).not.toBe(0);
    expect(r.saida).toContain('DATABASE_URL_TESTE');
    expect(r.saida).toContain('docker run');
  });

  it('o vitest usa a DATABASE_URL_TESTE e ignora a DATABASE_URL herdada', () => {
    const r = rodarIsolado(
      "const { default: c } = await import('./vitest.config.js'); console.log(c.test.env.DATABASE_URL)",
      {
        DATABASE_URL: 'postgres://usuario:senha@banco-do-grupo.neon.tech/banco',
        DATABASE_URL_TESTE: 'postgres://teste:teste@localhost:5433/teste'
      }
    );
    expect(r.codigo).toBe(0);
    expect(r.saida.trim()).toBe('postgres://teste:teste@localhost:5433/teste');
  });
});

describe('validade como DATE', () => {
  beforeEach(async () => { await migrar(); await limparBanco(); });
  afterAll(async () => { await encerrar(); });

  it('a coluna validade é do tipo date', async () => {
    const { rows } = await query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'doacoes' AND column_name = 'validade'`
    );
    expect(rows[0].data_type).toBe('date');
  });

  it('o repositório devolve a validade como texto AAAA-MM-DD', async () => {
    const doacao = await repo.inserir({ tipo: 'Pão', quantidade: '5', validade: '2031-03-09' });
    expect(doacao.validade).toBe('2031-03-09');
    const lida = await repo.buscarPorId(doacao.id);
    expect(lida.validade).toBe('2031-03-09');
  });

  it('migrar converte uma validade que ainda era texto, sem perder dados', async () => {
    await query('ALTER TABLE doacoes ALTER COLUMN validade TYPE TEXT');
    await query(
      `INSERT INTO doacoes (tipo, quantidade, validade, criada_em) VALUES ('Pão', '5', '2031-03-09', '2026-10-05 10:00:00')`
    );
    await migrar();
    const { rows } = await query('SELECT validade FROM doacoes');
    expect(rows[0].validade).toBe('2031-03-09');
    const tipo = await query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'doacoes' AND column_name = 'validade'`
    );
    expect(tipo.rows[0].data_type).toBe('date');
  });
});

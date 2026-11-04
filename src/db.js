// Conexão com o banco. A interface (`query` devolvendo `{ rows }`) é a mesma nos dois bancos,
// então a troca fica contida neste arquivo e não vaza para as regras de negócio (ADR 0003).
//
// Com DATABASE_URL, o banco é o PostgreSQL (ADR 0002). Sem ela, é o SQLite do `node:sqlite`,
// que continua servindo para rodar sem internet enquanto a migração não termina.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const URL_BANCO = process.env.DATABASE_URL;

// Sem DATABASE_FILE, o banco fica na raiz do projeto, resolvida a partir deste arquivo.
// Um caminho relativo dependeria da pasta de onde o servidor foi iniciado e, rodando de
// outro lugar, criaria um banco novo e vazio, como se os dados tivessem sumido.
const ARQUIVO = process.env.DATABASE_FILE || fileURLToPath(new URL('../dados.sqlite', import.meta.url));

let db;
let pool;

// `node:sqlite` é módulo embutido do Node 22+. Carregado via createRequire porque
// algumas ferramentas (como o Vite/Vitest) ainda não o reconhecem como embutido, e só
// quando for usado, para o aviso de módulo experimental não aparecer com o PostgreSQL.
function sqlite() {
  if (!db) {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
    db = new DatabaseSync(ARQUIVO);
  }
  return db;
}

function postgres() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: URL_BANCO });
    // Sem este tratamento, uma conexão ociosa derrubada pelo servidor encerra o processo.
    // O Neon suspende o banco depois de um tempo parado, então isso acontece na prática.
    pool.on('error', (erro) => console.error(erro));
  }
  return pool;
}

// O código usa `?` como marcador nos dois bancos. O PostgreSQL espera $1, $2...
function marcadoresPostgres(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

/**
 * Executa uma consulta e devolve { rows }.
 * Use `?` como marcador de parâmetro (evita injeção de SQL):
 *   query('SELECT * FROM doacoes WHERE id = ?', [id])
 */
export async function query(sql, valores = []) {
  if (URL_BANCO) {
    const resultado = await postgres().query(marcadoresPostgres(sql), valores);
    return { rows: resultado.rows, alteradas: resultado.rowCount };
  }
  const stmt = sqlite().prepare(sql);
  const ehLeitura = /^\s*(select|with|pragma)/i.test(sql) || /returning/i.test(sql);
  if (ehLeitura) return { rows: stmt.all(...valores) };
  const info = stmt.run(...valores);
  return { rows: [], alteradas: info.changes };
}

/** Nomes das colunas da tabela de doações. */
export async function colunas() {
  const { rows } = await query(URL_BANCO
    ? `SELECT column_name AS name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'doacoes'`
    : 'PRAGMA table_info(doacoes)');
  return rows.map((c) => c.name);
}

/** Cria o schema, se ainda não existir. Rodado por `npm run db:migrar` e ao subir o servidor. */
export async function migrar() {
  const id = URL_BANCO ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  await query(`
    CREATE TABLE IF NOT EXISTS doacoes (
      id          ${id},
      tipo        TEXT NOT NULL,
      quantidade  TEXT NOT NULL,
      validade    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'disponivel',
      ong         TEXT,
      criada_em   TEXT NOT NULL,
      aceita_em   TEXT,
      coletada_em TEXT,
      retirada_em TEXT,
      motivo_retirada TEXT
    )
  `);

  // Colunas acrescentadas na Unidade 2 (ADR 0001 e H6c). O CREATE TABLE acima não altera
  // uma tabela que já existe, então um dados.sqlite criado antes recebe as colunas aqui.
  const existentes = await colunas();
  for (const coluna of ['aceita_em', 'coletada_em', 'retirada_em', 'motivo_retirada']) {
    if (!existentes.includes(coluna)) {
      await query(`ALTER TABLE doacoes ADD COLUMN ${coluna} TEXT`);
    }
  }
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  await query('DELETE FROM doacoes');
}

export async function encerrar() {
  if (db) { db.close(); db = undefined; }
  if (pool) { await pool.end(); pool = undefined; }
}

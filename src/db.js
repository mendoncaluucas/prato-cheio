// Conexão com o banco. Já vem pronto — não precisa mexer agora.
//
// UNIDADE 1: SQLite, embutido no Node (módulo `node:sqlite`) — nada para instalar.
// UNIDADE 3: este arquivo será refatorado para PostgreSQL. A interface abaixo
//            (`query` devolvendo `{ rows }`) foi desenhada para que a troca fique
//            contida aqui, sem espalhar mudança pelo resto do código.
// `node:sqlite` é módulo embutido do Node 22+. Carregado via createRequire porque
// algumas ferramentas (como o Vite/Vitest) ainda não o reconhecem como embutido.
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

const ARQUIVO = process.env.DATABASE_FILE || 'dados.sqlite';

let db;

export function conexao() {
  if (!db) db = new DatabaseSync(ARQUIVO);
  return db;
}

/**
 * Executa uma consulta e devolve { rows }.
 * Use `?` como marcador de parâmetro (evita injeção de SQL):
 *   query('SELECT * FROM doacoes WHERE id = ?', [id])
 */
export async function query(sql, valores = []) {
  const stmt = conexao().prepare(sql);
  const ehLeitura = /^\s*(select|with)/i.test(sql) || /returning/i.test(sql);
  if (ehLeitura) return { rows: stmt.all(...valores) };
  const info = stmt.run(...valores);
  return { rows: [], alteradas: info.changes };
}

/** Cria o schema, se ainda não existir. Rodado por `npm run db:migrar` e ao subir o servidor. */
export async function migrar() {
  conexao().exec(`
    CREATE TABLE IF NOT EXISTS doacoes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo        TEXT NOT NULL,
      quantidade  TEXT NOT NULL,
      validade    TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'disponivel',
      ong         TEXT,
      criada_em   TEXT NOT NULL DEFAULT (datetime('now')),
      aceita_em   TEXT,
      coletada_em TEXT
    )
  `);

  // Colunas acrescentadas na Unidade 2 (ADR 0001). O CREATE TABLE acima não altera
  // uma tabela que já existe, então um dados.sqlite criado antes recebe as colunas aqui.
  const existentes = conexao().prepare('PRAGMA table_info(doacoes)').all().map((c) => c.name);
  for (const coluna of ['aceita_em', 'coletada_em']) {
    if (!existentes.includes(coluna)) {
      conexao().exec(`ALTER TABLE doacoes ADD COLUMN ${coluna} TEXT`);
    }
  }
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  conexao().exec('DELETE FROM doacoes');
}

export async function encerrar() {
  if (db) { db.close(); db = undefined; }
}

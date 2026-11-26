// Conexão com o banco: PostgreSQL, pela DATABASE_URL (ADR 0002 e ADR 0003).
// A interface (`query` devolvendo `{ rows }`) fica aqui, longe das regras de negócio.
import pg from 'pg';

const URL_BANCO = process.env.DATABASE_URL;

if (!URL_BANCO) {
  throw new Error(
    'DATABASE_URL não está definida. Copie o .env.example para .env e preencha a connection ' +
    'string do PostgreSQL (o README explica como subir um com Docker).'
  );
}

// O pg devolve DATE (tipo 1082) como objeto Date no fuso da máquina, e a API trabalha com
// texto AAAA-MM-DD. Devolver o valor cru do banco mantém o formato e evita o deslocamento
// de um dia que o fuso causaria.
pg.types.setTypeParser(1082, (valor) => valor);

let pool;

function postgres() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: URL_BANCO });
    // Sem este tratamento, uma conexão ociosa derrubada pelo servidor encerra o processo.
    // O Neon suspende o banco depois de um tempo parado, então isso acontece na prática.
    pool.on('error', (erro) => console.error(erro));
  }
  return pool;
}

// O código usa `?` como marcador nas consultas. O PostgreSQL espera $1, $2...
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
  const resultado = await postgres().query(marcadoresPostgres(sql), valores);
  return { rows: resultado.rows, alteradas: resultado.rowCount };
}

/** Nomes das colunas da tabela de doações. */
export async function colunas() {
  const { rows } = await query(
    `SELECT column_name AS name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'doacoes'`
  );
  return rows.map((c) => c.name);
}

/** Cria o schema, se ainda não existir. Rodado por `npm run db:migrar` e ao subir o servidor. */
export async function migrar() {
  await query(`
    CREATE TABLE IF NOT EXISTS doacoes (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT NOT NULL,
      quantidade  TEXT NOT NULL,
      validade    DATE NOT NULL,
      status      TEXT NOT NULL DEFAULT 'disponivel',
      ong         TEXT,
      criada_em   TEXT NOT NULL,
      aceita_em   TEXT,
      coletada_em TEXT,
      retirada_em TEXT,
      motivo_retirada TEXT
    )
  `);

  // O CREATE TABLE acima não altera uma tabela que já existe. Um banco criado antes
  // das mudanças abaixo recebe os ajustes aqui, e rodar de novo não faz nada.

  // Colunas acrescentadas na Unidade 2 (ADR 0001 e H6c).
  const existentes = await colunas();
  for (const coluna of ['aceita_em', 'coletada_em', 'retirada_em', 'motivo_retirada']) {
    if (!existentes.includes(coluna)) {
      await query(`ALTER TABLE doacoes ADD COLUMN ${coluna} TEXT`);
    }
  }

  // A validade era TEXT na primeira versão do schema; agora é DATE (ADR 0003). As datas já
  // gravadas foram validadas como AAAA-MM-DD pela API, então a conversão não perde nada.
  const { rows } = await query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'doacoes' AND column_name = 'validade'`
  );
  if (rows[0].data_type !== 'date') {
    await query('ALTER TABLE doacoes ALTER COLUMN validade TYPE DATE USING validade::date');
  }
}

/** Apaga todos os dados. Usado pelos testes. */
export async function limparBanco() {
  await query('DELETE FROM doacoes');
}

export async function encerrar() {
  if (pool) { await pool.end(); pool = undefined; }
}

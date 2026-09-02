// Camada de dados do Prato Cheio — acesso ao banco.
// A conexão e o schema estão em src/db.js.
//
// Marcador de parâmetro é `?` (SQL parametrizado evita injeção):
//   const { rows } = await query('SELECT * FROM doacoes WHERE id = ?', [id]);
import { query } from './db.js';

// Insere a doação e devolve a linha criada.
// O status 'disponivel' vem do DEFAULT do schema.
export async function inserir({ tipo, quantidade, validade }) {
  const { rows } = await query(
    `INSERT INTO doacoes (tipo, quantidade, validade)
     VALUES (?, ?, ?)
     RETURNING *`,
    [tipo, quantidade, validade]
  );
  return rows[0];
}

// Devolve apenas as doações ainda disponíveis, da mais antiga para a mais recente.
export async function listarDisponiveis() {
  const { rows } = await query(
    `SELECT * FROM doacoes WHERE status = 'disponivel' ORDER BY id`
  );
  return rows;
}

// Busca uma doação pelo id. Devolve undefined se não existir.
export async function buscarPorId(id) {
  const { rows } = await query(`SELECT * FROM doacoes WHERE id = ?`, [id]);
  return rows[0];
}

// Marca a doação como aceita pela ONG e devolve a linha atualizada.
//
// O `AND status = 'disponivel'` é o que garante a RNI2 no próprio banco: se duas
// ONGs aceitarem a mesma doação ao mesmo tempo, só a primeira encontra a linha
// disponível. Para a segunda o UPDATE não casa com nenhuma linha e devolve vazio,
// em vez de sobrescrever a ONG que já havia registrado o aceite.
export async function aceitar(id, ong) {
  const { rows } = await query(
    `UPDATE doacoes
        SET status = 'aceita', ong = ?
      WHERE id = ? AND status = 'disponivel'
     RETURNING *`,
    [ong, id]
  );
  return rows[0];
}

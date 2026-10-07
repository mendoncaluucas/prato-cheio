// Regras de negócio das doações.
//
// As validações ficam aqui, e não nas rotas: src/app.js só traduz HTTP e o
// repositório só fala SQL. Erro lançado neste módulo vira resposta 400.
import * as repo from './repositorio.js';

// Data de hoje em AAAA-MM-DD, no fuso local.
// Não usamos toISOString() porque ele converte para UTC e, no fuso do Brasil,
// devolveria o dia seguinte durante as últimas três horas do dia.
function hoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// H1 — o doador publica uma doação.
// CA1.1: tipo, quantidade e validade preenchidos criam a doação (RN1).
// CA1.2: faltando qualquer um dos três, recusa (RN1).
// CA1.3: validade já vencida na publicação, recusa (RNI1).
export async function criarDoacao({ tipo, quantidade, validade }) {
  if (!tipo || !quantidade || !validade) {
    throw new Error('tipo, quantidade e validade são obrigatórios');
  }
  // A validade do próprio dia ainda vale: só recusamos datas anteriores a hoje.
  if (validade < hoje()) {
    throw new Error('validade já vencida: a doação não pode ser publicada');
  }
  return repo.inserir({ tipo, quantidade, validade });
}

// H2 — a ONG vê as doações disponíveis (CA2.1, CA2.2).
// RN2: doação com a janela de retirada vencida deixa de aparecer. A validade do
// próprio dia ainda vale, como na publicação.
export async function listarDisponiveis() {
  return repo.listarDisponiveis(hoje());
}

// Doações aceitas que ainda esperam a confirmação de coleta (ADR 0001).
export async function listarAguardandoColeta() {
  return repo.listarAguardandoColeta();
}

// H3 — a ONG aceita uma doação (CA3.1, CA3.2).
export async function aceitar(id, ong) {
  const doacao = await repo.buscarPorId(id);
  if (!doacao) {
    throw new Error('doação não encontrada');
  }
  if (doacao.status !== 'disponivel') {
    throw new Error('doação já foi aceita por outra ONG');
  }
  // RN2: fora da janela, a doação já não está disponível — mesmo que ainda tenha
  // aparecido na lista de quem a abriu antes da virada do dia.
  if (doacao.validade < hoje()) {
    throw new Error('doação vencida: a janela de retirada já passou');
  }

  const atualizada = await repo.aceitar(id, ong);
  // O UPDATE já filtra por status disponível. Se não devolveu linha, outra ONG
  // aceitou entre a busca acima e a escrita — aqui isso vira mensagem de erro.
  if (!atualizada) {
    throw new Error('doação já foi aceita por outra ONG');
  }
  return atualizada;
}

// ADR 0001 — a ONG confirma que buscou a doação. Fecha o ciclo de vida
// disponivel → aceita → coletada e registra a hora da coleta, que o experimento da
// hipótese e o Objetivo de Impacto 1 precisam medir.
export async function coletar(id) {
  const doacao = await repo.buscarPorId(id);
  if (!doacao) {
    throw new Error('doação não encontrada');
  }
  if (doacao.status === 'coletada') {
    throw new Error('a coleta desta doação já foi confirmada');
  }
  if (doacao.status !== 'aceita') {
    throw new Error('só é possível confirmar a coleta de uma doação aceita');
  }

  const atualizada = await repo.coletar(id);
  // Mesmo raciocínio do aceite: se não voltou linha, outra confirmação chegou antes.
  if (!atualizada) {
    throw new Error('a coleta desta doação já foi confirmada');
  }
  return atualizada;
}

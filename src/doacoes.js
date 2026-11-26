// Regras de negócio das doações.
//
// As validações ficam aqui, e não nas rotas: src/app.js só traduz HTTP e o
// repositório só fala SQL. Erro de regra (ErroDeNegocio) vira resposta 400; qualquer
// outro erro é falha do servidor e vira 500.
import * as repo from './repositorio.js';
import { STATUS } from './status.js';
import { hoje } from './datas.js';
import { montarRelatorioSemanal } from './relatorio.js';

// Os testes e outros módulos importam daqui; o cálculo mudou de arquivo, o contrato não.
export { montarRelatorioSemanal };

// Recusa por regra de negócio: a mensagem é feita para quem usa o sistema ler.
export class ErroDeNegocio extends Error {}

// --- validação de entrada --------------------------------------------------------
// O corpo da requisição chega como o cliente quiser. Nada segue para o banco sem passar
// por aqui: além de proteger as regras, um valor que não seja texto ou número quebraria
// o SQL — o node:sqlite trata um objeto como parâmetros nomeados, e os parâmetros
// seguintes escorregam de posição.

// Texto preenchido, sem espaços nas pontas; undefined se não for. O PostgreSQL não guarda o
// caractere nulo em texto: sem esta recusa, ele viraria erro 500 em vez de 400.
function textoPreenchido(valor) {
  if (typeof valor !== 'string' || valor.includes('\0')) return undefined;
  return valor.trim() !== '' ? valor.trim() : undefined;
}

// Data real no formato AAAA-MM-DD. As comparações de validade são feitas como texto,
// então qualquer outro formato ("31/12/2020", "abc") escaparia da RN2 e da RNI1.
function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Maior valor da coluna id no PostgreSQL (SERIAL). Acima disso o banco recusa a consulta.
const ID_MAXIMO = 2147483647;

// Identificador numérico positivo. Qualquer outra coisa não corresponde a uma doação.
function idValido(id) {
  if (!/^[1-9]\d*$/.test(String(id)) || Number(id) > ID_MAXIMO) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  return Number(id);
}

// Busca a doação pelo id já validado; sem ela, não há o que aceitar, retirar ou coletar.
async function buscarOuRecusar(numero) {
  const doacao = await repo.buscarPorId(numero);
  if (!doacao) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  return doacao;
}

// O UPDATE do repositório já filtra pelo status esperado. Se não devolveu linha, outra
// requisição mudou a doação entre a busca e a escrita: vira a mensagem de recusa.
function exigirAtualizada(linha, mensagem) {
  if (!linha) {
    throw new ErroDeNegocio(mensagem);
  }
  return linha;
}

// H1 — o doador publica uma doação.
// CA1.1: tipo, quantidade e validade preenchidos criam a doação (RN1).
// CA1.2: faltando qualquer um dos três, recusa (RN1).
// CA1.3: validade já vencida na publicação, recusa (RNI1).
export async function criarDoacao({ tipo, quantidade, validade } = {}) {
  const t = textoPreenchido(tipo);
  const q = textoPreenchido(quantidade);
  if (!t || !q || validade === undefined || validade === null || validade === '') {
    throw new ErroDeNegocio('tipo, quantidade e validade são obrigatórios');
  }
  if (!dataValida(validade)) {
    throw new ErroDeNegocio('validade deve ser uma data real no formato AAAA-MM-DD');
  }
  // A validade do próprio dia ainda vale: só recusamos datas anteriores a hoje.
  if (validade < hoje()) {
    throw new ErroDeNegocio('validade já vencida: a doação não pode ser publicada');
  }
  return repo.inserir({ tipo: t, quantidade: q, validade });
}

// H2 — a ONG vê as doações disponíveis (CA2.1, CA2.2).
// RN2: doação com a janela de retirada vencida deixa de aparecer. A validade do
// próprio dia ainda vale, como na publicação.
export async function listarDisponiveis() {
  return repo.listarDisponiveis(hoje());
}

// H4a — o doador vê o que venceu sem ser aceito (CA4a.1 a CA4a.4).
// A validade do próprio dia ainda vale, então só entra quem venceu antes de hoje.
export async function listarVencidasSemAceite() {
  return repo.listarVencidasSemAceite(hoje());
}

// Doações aceitas que ainda esperam a confirmação de coleta (ADR 0001).
export async function listarAguardandoColeta() {
  return repo.listarAguardandoColeta();
}

// H3 — a ONG aceita uma doação (CA3.1, CA3.2).
// CA3.1 diz que a doação fica registrada "em nome daquela ONG": sem nome, não há aceite.
export async function aceitar(id, ong) {
  const numero = idValido(id);
  const nome = textoPreenchido(ong);
  if (!nome) {
    throw new ErroDeNegocio('informe o nome da ONG que está aceitando a doação');
  }
  const doacao = await buscarOuRecusar(numero);
  if (doacao.status === STATUS.RETIRADA) {
    throw new ErroDeNegocio('esta doação foi retirada da lista por ser imprópria');
  }
  if (doacao.status !== STATUS.DISPONIVEL) {
    throw new ErroDeNegocio('doação já foi aceita por outra ONG');
  }
  // RN2: fora da janela, a doação já não está disponível — mesmo que ainda tenha
  // aparecido na lista de quem a abriu antes da virada do dia.
  if (doacao.validade < hoje()) {
    throw new ErroDeNegocio('doação vencida: a janela de retirada já passou');
  }

  // Se não voltou linha, outra ONG aceitou entre a busca acima e a escrita.
  return exigirAtualizada(await repo.aceitar(numero, nome), 'doação já foi aceita por outra ONG');
}

// H6b — o relatório semanal de coletas; o cálculo está em src/relatorio.js.
export async function relatorioSemanal() {
  return montarRelatorioSemanal(await repo.listarParaRelatorio(), hoje());
}

// H6c — quem administra a plataforma retira da lista uma doação denunciada como
// imprópria, para que nenhuma ONG busque alimento fora das condições.
// O motivo é obrigatório: é o registro que a vigilância sanitária pode cobrar.
export async function retirar(id, motivo) {
  const numero = idValido(id);
  const texto = textoPreenchido(motivo);
  if (!texto) {
    throw new ErroDeNegocio('informe o motivo da retirada');
  }
  const doacao = await buscarOuRecusar(numero);
  if (doacao.status === STATUS.RETIRADA) {
    throw new ErroDeNegocio('esta doação já foi retirada');
  }
  if (doacao.status === STATUS.COLETADA) {
    throw new ErroDeNegocio('não é possível retirar uma doação que já foi coletada');
  }

  // Se não voltou linha, foi coletada ou retirada por outra pessoa no meio do caminho.
  return exigirAtualizada(
    await repo.retirar(numero, texto),
    'a doação mudou de estado e não pôde ser retirada; atualize a lista'
  );
}

// ADR 0001 — a ONG confirma que buscou a doação. Fecha o ciclo de vida
// disponivel → aceita → coletada e registra a hora da coleta, que o experimento da
// hipótese e o Objetivo de Impacto 1 precisam medir.
// Confirmar depois da validade é permitido — a ONG pode ter buscado a tempo e só
// confirmado depois —, mas o relatório conta essa coleta à parte.
export async function coletar(id) {
  const numero = idValido(id);
  const doacao = await buscarOuRecusar(numero);
  if (doacao.status === STATUS.COLETADA) {
    throw new ErroDeNegocio('a coleta desta doação já foi confirmada');
  }
  if (doacao.status === STATUS.RETIRADA) {
    throw new ErroDeNegocio('esta doação foi retirada da lista por ser imprópria e não deve ser buscada');
  }
  if (doacao.status !== STATUS.ACEITA) {
    throw new ErroDeNegocio('só é possível confirmar a coleta de uma doação aceita');
  }

  // Mesmo raciocínio do aceite: se não voltou linha, outra confirmação chegou antes.
  return exigirAtualizada(await repo.coletar(numero), 'a coleta desta doação já foi confirmada');
}

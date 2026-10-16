// Regras de negócio das doações.
//
// As validações ficam aqui, e não nas rotas: src/app.js só traduz HTTP e o
// repositório só fala SQL. Erro de regra (ErroDeNegocio) vira resposta 400; qualquer
// outro erro é falha do servidor e vira 500.
import * as repo from './repositorio.js';

// Recusa por regra de negócio: a mensagem é feita para quem usa o sistema ler.
export class ErroDeNegocio extends Error {}

// Dia em AAAA-MM-DD, no fuso local.
// Não usamos toISOString() porque ele converte para UTC e, no fuso do Brasil,
// devolveria o dia seguinte durante as últimas três horas do dia.
function diaLocal(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function hoje() {
  return diaLocal(new Date());
}

// --- validação de entrada --------------------------------------------------------
// O corpo da requisição chega como o cliente quiser. Nada segue para o banco sem passar
// por aqui: além de proteger as regras, um valor que não seja texto ou número quebraria
// o SQL — o node:sqlite trata um objeto como parâmetros nomeados, e os parâmetros
// seguintes escorregam de posição.

// Texto preenchido, sem espaços nas pontas; undefined se não for.
function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : undefined;
}

// Data real no formato AAAA-MM-DD. As comparações de validade são feitas como texto,
// então qualquer outro formato ("31/12/2020", "abc") escaparia da RN2 e da RNI1.
function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Identificador numérico positivo. Qualquer outra coisa não corresponde a uma doação.
function idValido(id) {
  if (!/^[1-9]\d*$/.test(String(id))) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  return Number(id);
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
  const doacao = await repo.buscarPorId(numero);
  if (!doacao) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  if (doacao.status === 'retirada') {
    throw new ErroDeNegocio('esta doação foi retirada da lista por ser imprópria');
  }
  if (doacao.status !== 'disponivel') {
    throw new ErroDeNegocio('doação já foi aceita por outra ONG');
  }
  // RN2: fora da janela, a doação já não está disponível — mesmo que ainda tenha
  // aparecido na lista de quem a abriu antes da virada do dia.
  if (doacao.validade < hoje()) {
    throw new ErroDeNegocio('doação vencida: a janela de retirada já passou');
  }

  const atualizada = await repo.aceitar(numero, nome);
  // O UPDATE já filtra por status disponível. Se não devolveu linha, outra ONG
  // aceitou entre a busca acima e a escrita — aqui isso vira mensagem de erro.
  if (!atualizada) {
    throw new ErroDeNegocio('doação já foi aceita por outra ONG');
  }
  return atualizada;
}

// As marcas de hora são gravadas como 'AAAA-MM-DD HH:MM:SS', em UTC.
function instanteUTC(marca) {
  return Date.parse(marca.replace(' ', 'T') + 'Z');
}

// Segunda-feira (em UTC) da semana de uma marca de hora, como 'AAAA-MM-DD'.
function segundaDaSemana(marca) {
  const d = new Date(instanteUTC(marca));
  const desdeSegunda = (d.getUTCDay() + 6) % 7; // domingo = 6, segunda = 0
  const segunda = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - desdeSegunda));
  return segunda.toISOString().slice(0, 10);
}

function mediana(valores) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

const umaCasa = (n) => Math.round(n * 10) / 10;

// H6b — Marta vê, a cada semana, quantas das doações publicadas terminaram coletadas.
//
// Cada doação entra na semana em que foi publicada e cai em exatamente uma situação:
// coletada no prazo, coletada após o vencimento, retirada, vencida sem coleta ou ainda
// em aberto. A taxa de coleta conta só as coletadas no prazo — alimento buscado depois
// de vencer não é comida boa salva — e não conta as retiradas: alimento impróprio não é
// comida boa desperdiçada, e contá-lo puniria a taxa justamente quando o sistema agiu
// certo. A mediana de horas até a coleta é a medida do experimento da hipótese
// (Objetivo de Impacto 1) e considera todas as coletas, no prazo ou não.
export async function relatorioSemanal() {
  return montarRelatorioSemanal(await repo.listarParaRelatorio(), hoje());
}

export function montarRelatorioSemanal(linhas, diaDeHoje) {
  const semanas = new Map();
  for (const d of linhas) {
    const chave = segundaDaSemana(d.criada_em);
    if (!semanas.has(chave)) {
      semanas.set(chave, {
        semana: chave, publicadas: 0, coletadas: 0, coletadasAposVencimento: 0,
        retiradas: 0, vencidasSemColeta: 0, emAberto: 0, horasAteColeta: []
      });
    }
    const s = semanas.get(chave);
    s.publicadas++;
    if (d.status === 'coletada') {
      s.horasAteColeta.push((instanteUTC(d.coletada_em) - instanteUTC(d.criada_em)) / 3_600_000);
      // O dia da coleta é comparado no fuso local, o mesmo da validade.
      if (diaLocal(new Date(instanteUTC(d.coletada_em))) > d.validade) {
        s.coletadasAposVencimento++;
      } else {
        s.coletadas++;
      }
    } else if (d.status === 'retirada') {
      s.retiradas++;
    } else if (d.validade < diaDeHoje) {
      s.vencidasSemColeta++; // disponível ou aceita, mas a janela já passou
    } else {
      s.emAberto++;
    }
  }

  return [...semanas.values()]
    .sort((a, b) => b.semana.localeCompare(a.semana))
    .map(({ horasAteColeta, ...s }) => {
      const consideradas = s.publicadas - s.retiradas;
      const med = mediana(horasAteColeta);
      return {
        ...s,
        taxaColeta: consideradas > 0 ? umaCasa((s.coletadas / consideradas) * 100) : null,
        medianaHorasAteColeta: med === null ? null : umaCasa(med)
      };
    });
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
  const doacao = await repo.buscarPorId(numero);
  if (!doacao) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  if (doacao.status === 'retirada') {
    throw new ErroDeNegocio('esta doação já foi retirada');
  }
  if (doacao.status === 'coletada') {
    throw new ErroDeNegocio('não é possível retirar uma doação que já foi coletada');
  }

  const atualizada = await repo.retirar(numero, texto);
  // Se não voltou linha, a doação mudou de estado entre a busca e a escrita —
  // foi coletada ou retirada por outra pessoa no meio do caminho.
  if (!atualizada) {
    throw new ErroDeNegocio('a doação mudou de estado e não pôde ser retirada; atualize a lista');
  }
  return atualizada;
}

// ADR 0001 — a ONG confirma que buscou a doação. Fecha o ciclo de vida
// disponivel → aceita → coletada e registra a hora da coleta, que o experimento da
// hipótese e o Objetivo de Impacto 1 precisam medir.
// Confirmar depois da validade é permitido — a ONG pode ter buscado a tempo e só
// confirmado depois —, mas o relatório conta essa coleta à parte.
export async function coletar(id) {
  const numero = idValido(id);
  const doacao = await repo.buscarPorId(numero);
  if (!doacao) {
    throw new ErroDeNegocio('doação não encontrada');
  }
  if (doacao.status === 'coletada') {
    throw new ErroDeNegocio('a coleta desta doação já foi confirmada');
  }
  if (doacao.status === 'retirada') {
    throw new ErroDeNegocio('esta doação foi retirada da lista por ser imprópria e não deve ser buscada');
  }
  if (doacao.status !== 'aceita') {
    throw new ErroDeNegocio('só é possível confirmar a coleta de uma doação aceita');
  }

  const atualizada = await repo.coletar(numero);
  // Mesmo raciocínio do aceite: se não voltou linha, outra confirmação chegou antes.
  if (!atualizada) {
    throw new ErroDeNegocio('a coleta desta doação já foi confirmada');
  }
  return atualizada;
}

// Relatório semanal (H6b): agrupa as doações por semana e calcula as taxas.
// Só calcula: quem busca os dados e decide o dia de hoje é src/doacoes.js.
import { STATUS } from './status.js';
import { diaLocal, instanteUTC } from './datas.js';

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
    if (d.status === STATUS.COLETADA) {
      s.horasAteColeta.push((instanteUTC(d.coletada_em) - instanteUTC(d.criada_em)) / 3_600_000);
      // O dia da coleta é comparado no fuso local, o mesmo da validade.
      if (diaLocal(new Date(instanteUTC(d.coletada_em))) > d.validade) {
        s.coletadasAposVencimento++;
      } else {
        s.coletadas++;
      }
    } else if (d.status === STATUS.RETIRADA) {
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

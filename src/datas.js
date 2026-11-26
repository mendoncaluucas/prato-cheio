// Datas do sistema: o dia local da validade e as marcas de hora em UTC.

// Dia em AAAA-MM-DD, no fuso local.
// Não usamos toISOString() porque ele converte para UTC e, no fuso do Brasil,
// devolveria o dia seguinte durante as últimas três horas do dia.
export function diaLocal(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function hoje() {
  return diaLocal(new Date());
}

// As marcas de hora são gravadas como 'AAAA-MM-DD HH:MM:SS', em UTC.
export function instanteUTC(marca) {
  return Date.parse(marca.replace(' ', 'T') + 'Z');
}

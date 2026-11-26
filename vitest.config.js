// Os testes apagam os dados a cada execução (limparBanco). Por isso o vitest só aceita
// DATABASE_URL_TESTE, que deve apontar para um PostgreSQL descartável, e nunca herda a
// DATABASE_URL do ambiente, que pode ser a do banco do grupo no Neon.
const urlTeste = process.env.DATABASE_URL_TESTE;

if (!urlTeste) {
  throw new Error(
    [
      'DATABASE_URL_TESTE não está definida.',
      'Os testes apagam os dados do banco, então precisam de um PostgreSQL só para eles.',
      'Suba um descartável e aponte a variável para ele:',
      '  docker run -d --name pc-pg-teste -e POSTGRES_USER=pratocheio -e POSTGRES_PASSWORD=pratocheio -e POSTGRES_DB=pratocheio -p 5433:5432 postgres:18-alpine',
      '  DATABASE_URL_TESTE=postgres://pratocheio:pratocheio@localhost:5433/pratocheio npm test',
      'Nunca use a URL do Neon aqui.'
    ].join('\n')
  );
}

export default {
  test: {
    // A DATABASE_URL do processo de teste vem sempre da DATABASE_URL_TESTE, e a do
    // ambiente é sobrescrita.
    env: { DATABASE_URL: urlTeste },
    // Um arquivo de teste por vez: todos dividem o mesmo banco, e um limparBanco()
    // apagaria os dados do outro.
    fileParallelism: false
  }
};

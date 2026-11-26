export default {
  test: {
    // SQLite em memória: os testes não tocam o arquivo do banco de desenvolvimento.
    // O vitest não lê o .env, então o banco do grupo fica de fora. Só o CI define a
    // DATABASE_URL, apontando para um PostgreSQL descartável: os testes apagam os dados.
    env: { DATABASE_FILE: ':memory:' },
    // Um arquivo de teste por vez. No SQLite em memória cada arquivo tem o seu banco, mas no
    // PostgreSQL do CI todos dividem o mesmo e um limparBanco() apagaria os dados do outro.
    fileParallelism: false,
    // Cobertura só quando pedida (npm run test:cobertura). Sem limiar mínimo: o relatório
    // serve para enxergar o que os testes não exercitam, não para reprovar o build.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage'
    }
  }
};

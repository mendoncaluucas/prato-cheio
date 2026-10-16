import { fileURLToPath } from 'node:url';
import express from 'express';
import * as doacoes from './doacoes.js';

// Caminho da interface a partir deste arquivo, e não da pasta de onde o servidor foi
// iniciado: rodando de outro lugar (o depurador do VS Code, por exemplo), um caminho
// relativo apontaria para uma pasta que não existe.
const PUBLICO = fileURLToPath(new URL('../public', import.meta.url));

const ERRO_INTERNO = { erro: 'erro interno no servidor; tente novamente' };

// Executa a ação da rota e traduz o resultado para HTTP. Recusa por regra de negócio
// vira 400 com a mensagem da regra. Qualquer outro erro é falha do servidor: vai para o
// log e o cliente recebe 500, sem detalhes internos do banco ou do código.
function responder(acao, status = 200) {
  return async (req, res) => {
    try {
      res.status(status).json(await acao(req));
    } catch (erro) {
      if (erro instanceof doacoes.ErroDeNegocio) {
        res.status(400).json({ erro: erro.message });
        return;
      }
      console.error(erro);
      res.status(500).json(ERRO_INTERNO);
    }
  };
}

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLICO));

  // Verificação de saúde: usada pelo CI para provar que a aplicação sobe.
  app.get('/api/saude', (req, res) => res.json({ ok: true }));

  app.get('/api/doacoes', responder(() => doacoes.listarDisponiveis()));
  app.post('/api/doacoes', responder((req) => doacoes.criarDoacao(req.body ?? {}), 201));
  app.get('/api/doacoes/aceitas', responder(() => doacoes.listarAguardandoColeta()));
  app.get('/api/relatorios/semanal', responder(() => doacoes.relatorioSemanal()));
  app.post('/api/doacoes/:id/aceitar', responder((req) => doacoes.aceitar(req.params.id, req.body?.ong)));
  app.post('/api/doacoes/:id/retirar', responder((req) => doacoes.retirar(req.params.id, req.body?.motivo)));
  app.post('/api/doacoes/:id/coletar', responder((req) => doacoes.coletar(req.params.id)));

  // Erros que não passam pelas rotas acima. Sem este tratamento, o Express devolveria
  // uma página HTML com o stack trace — inclusive para um JSON malformado no corpo.
  app.use((erro, req, res, next) => {
    if (erro.type === 'entity.parse.failed') {
      res.status(400).json({ erro: 'o corpo da requisição não é um JSON válido' });
      return;
    }
    console.error(erro);
    res.status(erro.status && erro.status < 500 ? erro.status : 500).json(ERRO_INTERNO);
  });

  return app;
}

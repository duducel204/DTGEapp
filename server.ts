import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { dtgeEngine } from './src/engine/dtgeEngine';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', engine: 'DTGE-v1.0', timestamp: new Date().toISOString() });
  });

  // Pipeline Execution
  app.post('/api/pipeline/run', async (req, res) => {
    try {
      const { texto_bruto, usuario_origem, parametros } = req.body;
      if (!texto_bruto) {
        return res.status(400).json({ error: 'Campo "texto_bruto" é obrigatório.' });
      }

      const resultado = await dtgeEngine.executarPipelineCompleto({
        texto_bruto,
        usuario_origem: usuario_origem || 'operador_web',
        parametros: parametros || {}
      });

      res.json(resultado);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao executar pipeline' });
    }
  });

  // Audit Logs
  app.get('/api/logs', (req, res) => {
    const limite = parseInt(req.query.limite as string) || 100;
    const agente = req.query.agente as string;
    const tipo = req.query.tipo as string;

    const logs = dtgeEngine.getLogs(limite, agente, tipo);
    res.json(logs);
  });

  // System Summary Metrics
  app.get('/api/logs/summary', (req, res) => {
    const summary = dtgeEngine.getResumoSistema();
    res.json(summary);
  });

  // Hashes Registry
  app.get('/api/hashes', (req, res) => {
    const limite = parseInt(req.query.limite as string) || 50;
    const hashes = dtgeEngine.getHashesRegistry(limite);
    res.json(hashes);
  });

  // Verify Hash
  app.post('/api/hashes/verify', (req, res) => {
    const { conteudo, hash_esperado } = req.body;
    if (!conteudo || !hash_esperado) {
      return res.status(400).json({ error: 'conteudo e hash_esperado são obrigatórios' });
    }

    const integro = dtgeEngine.verificarIntegridadeHash(conteudo, hash_esperado);
    res.json({ integro, hash_esperado });
  });

  // Artifacts
  app.get('/api/artifacts', (req, res) => {
    const artifacts = dtgeEngine.getArtefatos();
    res.json(artifacts);
  });

  app.get('/api/artifacts/:id', (req, res) => {
    const artifact = dtgeEngine.getArtefatoById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artefato não encontrado' });
    }
    res.json(artifact);
  });

  // Agents Status
  app.get('/api/agentes', (req, res) => {
    const agentes = dtgeEngine.getAgentesStatus();
    res.json(agentes);
  });

  // Checkpoints
  app.get('/api/checkpoints', (req, res) => {
    const cps = dtgeEngine.getCheckpoints();
    res.json(cps);
  });

  app.post('/api/checkpoints', (req, res) => {
    const { descricao } = req.body;
    const cp = dtgeEngine.criarCheckpoint(descricao || 'Checkpoint manual via Web UI');
    res.json(cp);
  });

  // Rollback
  app.post('/api/rollback', (req, res) => {
    const { id_checkpoint } = req.body;
    if (!id_checkpoint) {
      return res.status(400).json({ error: 'id_checkpoint é obrigatório' });
    }

    const resRollback = dtgeEngine.executarRollback(id_checkpoint);
    if (!resRollback.sucesso) {
      return res.status(400).json(resRollback);
    }
    res.json(resRollback);
  });

  // Canonical Contracts & Documentation Files
  app.get('/api/contracts', (req, res) => {
    const files = [
      'PROTOCOLO_DREAMTEAM_CLAUDE_v1.md',
      'BRIEFING_CLAUDE_v1.md',
      'CONTRATO_QUALIFICADOR_INTENCAO_v1.md',
      'CONTRATO_ORQUESTRADOR_v1.md',
      'CONTRATO_SENTINELA_v1.md',
      'CONTRATO_ARQUITETO_v1.md',
      'CONTRATO_ANALISTA_v1.md',
      'CONTRATO_EXECUTOR_v1.md',
      'CONTRATO_REGISTRADOR_v1.md',
      'CONTRATO_ROLLBACK_v1.md',
      'CANONIZACAO_ORQUESTRADOR_v1.md',
      'CANONIZACAO_SENTINELA_v1.md',
      'CANONIZACAO_ARQUITETO_v1.md',
      'CANONIZACAO_ANALISTA_v1.md',
      'CANONIZACAO_EXECUTOR_v1.md',
      'CANONIZACAO_REGISTRADOR_v1.md',
      'CANONIZACAO_ROLLBACK_v1.md'
    ];

    const result = files.map(filename => {
      const filePath = path.join(process.cwd(), filename);
      let content = '';
      if (fs.existsSync(filePath)) {
        try {
          content = fs.readFileSync(filePath, 'utf-8');
        } catch {
          content = `# ${filename}\n(Erro ao ler contrato)`;
        }
      } else {
        content = `# ${filename}\nContract document available in DTGE Specification.`;
      }
      return {
        filename,
        title: filename.replace('.md', '').replace(/_/g, ' '),
        content
      };
    });

    res.json(result);
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DTGE Server] Rodando na porta ${PORT} (0.0.0.0)`);
  });
}

startServer();

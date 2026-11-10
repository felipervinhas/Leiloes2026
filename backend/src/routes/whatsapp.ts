import { Router } from 'express';
import * as w from '../controllers/whatsappController';

// Rotas do WhatsApp (/api/:banco/whatsapp/...). Montadas depois do authMiddleware.
// O webhook da Meta fica fora deste router (público) — ver routes/index.ts.
// O módulo é ligado por nós, direto no banco: UPDATE Configuracoes SET WPP_ATIVA = 'S'
const router = Router({ mergeParams: true });

router.get('/status', w.status);

router.use(w.exigirWhatsapp);

router.get('/config', w.obterConfig);
router.put('/config', w.atualizarConfig);
router.post('/config/testar', w.testarConexao);

router.get('/templates', w.templates);

router.post('/campanhas/previa', w.previa);
router.post('/campanhas/teste', w.envioTeste);
router.get('/campanhas', w.listarCampanhas);
router.post('/campanhas', w.criarCampanha);
router.get('/campanhas/:id', w.buscarCampanha);
router.delete('/campanhas/:id', w.excluirCampanha);
router.get('/campanhas/:id/envios', w.envios);
router.post('/campanhas/:id/iniciar', w.iniciar);
router.post('/campanhas/:id/pausar', w.pausar);
router.post('/campanhas/:id/cancelar', w.cancelar);
router.post('/campanhas/:id/reenviar-falhas', w.reenviarFalhas);

router.get('/conversas', w.conversas);
router.get('/conversas/:chave', w.mensagens);
router.post('/conversas/:chave/responder', w.responder);

router.get('/descadastrados', w.listarOptout);
router.post('/descadastrados', w.adicionarOptout);
router.delete('/descadastrados/:chave', w.removerOptout);

export default router;

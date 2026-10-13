import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { bancoStorage } from '../config/bancoContext';
import { resolveBancoReal } from '../config/bancoAliases';
import * as conc from '../controllers/conciliacaoController';

// Rotas da área Financeiro (/api/:banco/conciliacao/...). Montadas depois do
// authMiddleware; o status fica fora do bloqueio por plano porque é por ele que
// a tela descobre se o módulo está contratado. O plano NÃO é ligado por rota:
// o adm de cada empresa cliente também é 'S', e ligaria o módulo sem contratar.
// Ativação é nossa, direto no banco: UPDATE Configuracoes SET CONC_ATIVA = 'S', CONC_PLANO = '...'
const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// O multer perde o AsyncLocalStorage do banco (ver routes/index.ts) — reafirma antes do controller
function reafirmarBanco(req: Request, _res: Response, next: NextFunction) {
  bancoStorage.run(resolveBancoReal(req.params.banco), next);
}

router.get('/status', conc.status);

router.use(conc.exigirConciliacao);

router.get('/resumo', conc.resumo);
router.get('/contas', conc.listarContas);
router.post('/contas', conc.criarConta);
router.put('/contas/:id', conc.atualizarConta);
router.post('/importar', upload.single('file'), reafirmarBanco, conc.importar);
router.get('/importacoes', conc.listarImportacoes);
router.get('/lancamentos', conc.listarLancamentos);
router.post('/conciliar-automatico', conc.conciliarAutomatico);
router.get('/lancamentos/:id/candidatos', conc.candidatos);
router.post('/lancamentos/:id/baixas', conc.confirmarBaixa);
router.post('/lancamentos/:id/desfazer', conc.desfazer);
router.post('/lancamentos/:id/nao-venda', conc.naoVenda);
router.get('/pendencias', conc.pendencias);
router.get('/repasses', conc.repasses);
router.get('/relatorios/recebimentos', conc.recebimentos);

export default router;

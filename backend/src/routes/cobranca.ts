import { Router } from 'express';
import * as c from '../controllers/cobrancaController';

// Intermediação de Cobrança (/api/:banco/cobranca/...). Montada depois do authMiddleware.
// O status fica fora do bloqueio porque é por ele que as telas descobrem se o módulo está
// contratado. Ativação é nossa, direto no banco: UPDATE Configuracoes SET COBR_ATIVA = 'S'
const router = Router({ mergeParams: true });

router.get('/status', c.status);

router.use(c.exigirCobranca);

router.get('/resumo', c.resumo);
router.get('/parcelas', c.listarParcelas);
router.post('/parcelas/baixar', c.baixar);
router.get('/parcelas/:id/baixas', c.baixasDaParcela);
router.get('/parcelas/:id/historico', c.historicoDaParcela);
router.put('/parcelas/:id/renegociar', c.renegociar);
router.post('/baixas/:id/desfazer', c.desfazerBaixa);
router.post('/quitar-anteriores', c.quitarAnteriores);

router.put('/lotes', c.salvarLotes);
router.get('/lotes/:id', c.configDoLote);
router.get('/lotes/:id/historico', c.historicoDoLote);

router.get('/vendedores', c.listarVendedores);
router.get('/vendedores/:id/lotes', c.lotesDoVendedor);
router.get('/vendedores/:id/padrao', c.padraoDoVendedor);
router.put('/vendedores/:id', c.salvarVendedor);
router.delete('/vendedores/:id', c.excluirVendedor);
router.get('/vendedores/:id/acesso', c.statusAcesso);
router.put('/vendedores/:id/acesso', c.configurarAcesso);
router.put('/config/taxa', c.salvarTaxaPadrao);

router.get('/fechamentos', c.listarFechamentos);
router.get('/fechamentos/previa', c.previa);
router.get('/fechamentos/competencia/:comp', c.competencia);
router.post('/fechamentos', c.fechar);
router.get('/fechamentos/:id', c.detalheFechamento);
router.post('/fechamentos/:id/reabrir', c.reabrirFechamento);
router.put('/fechamentos/:id/situacao', c.situacaoFechamento);

export default router;

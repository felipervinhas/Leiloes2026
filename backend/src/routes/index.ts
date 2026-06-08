import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { bancoMiddleware } from '../middleware/banco';
import authRoutes from './auth';
import * as cidade from '../controllers/cidadeController';
import * as raca from '../controllers/racaController';
import * as condicao from '../controllers/condicaoPagtoController';
import * as perfil from '../controllers/perfilController';
import * as usuario from '../controllers/usuarioController';
import * as leilao from '../controllers/leilaoController';
import * as lote from '../controllers/loteController';
import * as cliente from '../controllers/clienteController';
import { getConfiguracoes } from '../controllers/configController';
import * as upload from '../controllers/uploadController';
import * as lance from '../controllers/lanceController';
import * as consultaVendas from '../controllers/consultaVendasController';
import * as cotacao from '../controllers/cotacaoController';
import * as notificacao from '../controllers/notificacaoController';
import * as despesa from '../controllers/despesaController';
import multer from 'multer';

const memStorage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// health check global (sem banco)
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Todas as rotas reais ficam sob /:banco
const bancoRouter = Router({ mergeParams: true });
router.use('/:banco', bancoMiddleware, bancoRouter);

// Rotas públicas (sem JWT)
bancoRouter.use('/auth', authRoutes);
bancoRouter.get('/configuracoes', getConfiguracoes);

// Rotas protegidas
bancoRouter.use(authMiddleware);

bancoRouter.get('/cidades', cidade.listar);
bancoRouter.get('/cidades/:id', cidade.buscar);
bancoRouter.post('/cidades', cidade.criar);
bancoRouter.put('/cidades/:id', cidade.atualizar);
bancoRouter.delete('/cidades/:id', cidade.deletar);

bancoRouter.get('/racas', raca.listar);
bancoRouter.get('/racas/:id', raca.buscar);
bancoRouter.post('/racas', raca.criar);
bancoRouter.put('/racas/:id', raca.atualizar);
bancoRouter.delete('/racas/:id', raca.deletar);

bancoRouter.get('/condicoes-pagamento', condicao.listar);
bancoRouter.get('/condicoes-pagamento/:id', condicao.buscar);
bancoRouter.post('/condicoes-pagamento', condicao.criar);
bancoRouter.put('/condicoes-pagamento/:id', condicao.atualizar);
bancoRouter.delete('/condicoes-pagamento/:id', condicao.deletar);

bancoRouter.get('/perfis', perfil.listar);
bancoRouter.get('/perfis/:id', perfil.buscar);
bancoRouter.post('/perfis', perfil.criar);
bancoRouter.put('/perfis/:id', perfil.atualizar);
bancoRouter.delete('/perfis/:id', perfil.deletar);

bancoRouter.get('/usuarios', usuario.listar);
bancoRouter.get('/usuarios/:id', usuario.buscar);
bancoRouter.post('/usuarios', usuario.criar);
bancoRouter.put('/usuarios/:id', usuario.atualizar);
bancoRouter.delete('/usuarios/:id', usuario.deletar);

bancoRouter.get('/leiloes', leilao.listar);
bancoRouter.get('/leiloes/:id', leilao.buscar);
bancoRouter.post('/leiloes', leilao.criar);
bancoRouter.put('/leiloes/:id', leilao.atualizar);
bancoRouter.delete('/leiloes/:id', leilao.deletar);
bancoRouter.get('/leiloes/:id/imagens', upload.getImagensLeilao);
bancoRouter.post('/leiloes/:id/imagens/desktop', memStorage.single('file'), upload.uploadLeilaoDesktop);
bancoRouter.post('/leiloes/:id/imagens/mobile', memStorage.single('file'), upload.uploadLeilaoMobile);
bancoRouter.post('/leiloes/:id/imagens/media', memStorage.single('file'), upload.uploadLeilaoMedia);
bancoRouter.delete('/leiloes/:id/imagens/:tipo', upload.deletarLeilaoImagem);

bancoRouter.get('/lotes', lote.listar);
bancoRouter.get('/lotes/:id', lote.buscar);
bancoRouter.post('/lotes', lote.criar);
bancoRouter.put('/lotes/:id', lote.atualizar);
bancoRouter.delete('/lotes/:id', lote.deletar);
bancoRouter.post('/lotes/:id/duplicar', lote.duplicar);
bancoRouter.get('/lotes/:id/imagens', upload.getImagensLote);
bancoRouter.post('/lotes/:id/imagens/:num', memStorage.single('file'), upload.uploadLoteImagem);
bancoRouter.delete('/lotes/:id/imagens/:num', upload.deletarLoteImagem);

bancoRouter.get('/consulta-vendas', consultaVendas.consultar);
bancoRouter.get('/consulta-vendas/racas/:idLeilao', consultaVendas.racas);
bancoRouter.get('/consulta-vendas/lotes/:idLeilao', consultaVendas.lotes);

bancoRouter.get('/lances', lance.listar);
bancoRouter.get('/lances/resumo/:idLeilao', lance.resumo);

bancoRouter.get('/cotacoes', cotacao.listar);
bancoRouter.post('/cotacoes', cotacao.criar);
bancoRouter.put('/cotacoes/:id', cotacao.atualizar);
bancoRouter.delete('/cotacoes/:id', cotacao.deletar);

bancoRouter.get('/notificacoes', notificacao.listar);
bancoRouter.post('/notificacoes', notificacao.criar);
bancoRouter.delete('/notificacoes/:id', notificacao.deletar);
bancoRouter.post('/notificacoes/enviar', notificacao.enviar);

bancoRouter.get('/despesas', despesa.listar);
bancoRouter.post('/despesas', despesa.criar);
bancoRouter.put('/despesas/:id', despesa.atualizar);
bancoRouter.delete('/despesas/:id', despesa.deletar);

bancoRouter.get('/clientes', cliente.listar);
bancoRouter.get('/clientes/:id', cliente.buscar);
bancoRouter.post('/clientes', cliente.criar);
bancoRouter.put('/clientes/:id', cliente.atualizar);
bancoRouter.delete('/clientes/:id', cliente.deletar);
bancoRouter.patch('/clientes/:id/senha', cliente.alterarSenha);

export default router;

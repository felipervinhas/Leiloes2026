import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getBanco } from '../config/bancoContext';
import { CobrancaError } from '../services/cobranca/acessoService';
import * as portal from '../services/cobranca/portalService';
import * as parc from '../services/cobranca/parcelasService';
import * as fech from '../services/cobranca/fechamentoService';
import { registrarLog } from '../services/logService';

// Painel do cliente (/api/:banco/portal/...). Montado ANTES do authMiddleware do sistema:
// tem login próprio (CPF/CNPJ ou e-mail + a senha do app/site) e token próprio, assinado
// com outro segredo e com tipo 'portal' — o token do cliente não abre nenhuma rota
// administrativa, e o do usuário administrativo não abre o painel.
const router = Router({ mergeParams: true });

export const TIPO_TOKEN_PORTAL = 'portal';
const segredo = () => `${process.env.JWT_SECRET}:portal-cliente`;

interface ClientePortal { tipo: string; idCliente: number; nome: string; banco: string; lk?: string }
const clienteDe = (req: Request) => (req as any).cliente as ClientePortal;

const tratar = (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (e: any) {
      if (e instanceof CobrancaError) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  };

router.post('/login', tratar(async (req, res) => {
  const { login, senha } = req.body || {};
  const c = await portal.autenticar(String(login || ''), String(senha || ''));
  const token = jwt.sign({ tipo: TIPO_TOKEN_PORTAL, idCliente: c.idCliente, nome: c.nome, banco: getBanco() }, segredo(), { expiresIn: '8h' });
  await registrarLog({ id: c.idCliente, nome: c.nome } as any, 'Alterar', 'Painel do Cliente - Login', c.idCliente);
  res.json({ token, cliente: { id: c.idCliente, nome: c.nome } });
}));

// Link exclusivo enviado pela leiloeira: o cliente confirma os 4 primeiros dígitos do CPF/CNPJ
// e fica com a sessão por 30 dias no aparelho. A sessão leva o começo do hash do link (lk):
// gerar outro link ou revogar derruba quem entrou pelo anterior.
router.get('/link/:token', tratar(async (req, res) => {
  res.json(await portal.infoLink(String(req.params.token)));
}));

router.post('/link/confirmar', tratar(async (req, res) => {
  const { token, digitos } = req.body || {};
  const c = await portal.confirmarLink(String(token || ''), String(digitos || ''));
  const jwtToken = jwt.sign({ tipo: TIPO_TOKEN_PORTAL, idCliente: c.idCliente, nome: c.nome, banco: getBanco(), lk: c.lk }, segredo(), { expiresIn: '30d' });
  await registrarLog({ id: c.idCliente, nome: c.nome } as any, 'Alterar', 'Painel do Cliente - Acesso pelo link', c.idCliente);
  res.json({ token: jwtToken, cliente: { id: c.idCliente, nome: c.nome } });
}));

async function exigirCliente(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Faça o login' });
  let d: ClientePortal;
  try { d = jwt.verify(h.slice(7), segredo()) as ClientePortal; } catch { return res.status(401).json({ error: 'Sessão expirada. Faça o login de novo.' }); }
  if (d.tipo !== TIPO_TOKEN_PORTAL || d.banco !== getBanco()) return res.status(401).json({ error: 'Sessão inválida' });
  try {
    if (!(await portal.aindaLiberado(d.idCliente, d.lk))) return res.status(401).json({ error: 'Acesso ao painel não está liberado' });
  } catch (e) { return next(e); }
  (req as any).cliente = d;
  next();
}

router.use(exigirCliente);

router.get('/me', (req, res) => res.json({ id: clienteDe(req).idCliente, nome: clienteDe(req).nome }));

router.get('/recebimentos', tratar(async (req, res) => {
  res.json(await portal.parcelasDoCliente(clienteDe(req).idCliente, 'VENDEDOR'));
}));

router.get('/pagamentos', tratar(async (req, res) => {
  res.json(await portal.parcelasDoCliente(clienteDe(req).idCliente, 'COMPRADOR'));
}));

router.get('/parcelas/:id/historico', tratar(async (req, res) => {
  const id = Number(req.params.id);
  await portal.exigirParcelaDoCliente(id, clienteDe(req).idCliente);
  res.json(await parc.historico({ idParcela: id }));
}));

// Renegociação pelo vendedor: vale na hora, fica no histórico como "pelo vendedor".
router.put('/parcelas/:id/renegociar', tratar(async (req, res) => {
  const c = clienteDe(req);
  const id = Number(req.params.id);
  await portal.exigirParcelaDoCliente(id, c.idCliente, 'VENDEDOR');
  const b = req.body || {};
  await parc.renegociar(id, { vencimento: b.vencimento || undefined, valor: b.valor != null ? Number(b.valor) : undefined, motivo: b.motivo || undefined },
    { id: c.idCliente, nome: c.nome }, 'VENDEDOR', c.idCliente);
  await registrarLog({ id: c.idCliente, nome: c.nome } as any, 'Alterar', 'Painel do Cliente - Renegociação', id);
  res.json({ ok: true });
}));

router.get('/fechamentos', tratar(async (req, res) => {
  res.json(await fech.listar({ idVendedor: clienteDe(req).idCliente }));
}));

router.get('/fechamentos/:id', tratar(async (req, res) => {
  const id = Number(req.params.id);
  await portal.exigirFechamentoDoCliente(id, clienteDe(req).idCliente);
  res.json(await fech.detalhe(id));
}));

export default router;

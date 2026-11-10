import { Request, Response, NextFunction } from 'express';
import { registrarLog } from '../services/logService';
import {
  configParaTela, ehAdmin, lerConfig, credenciais, moduloAtivo, salvarConfig, temAcessoWhatsapp, WhatsappError,
} from '../services/whatsapp/configService';
import { garantirTabelasWhatsapp } from '../services/whatsapp/schema';
import * as camp from '../services/whatsapp/campanhaService';
import * as conv from '../services/whatsapp/conversaService';
import { assinaturaValida, processarWebhook } from '../services/whatsapp/webhookService';
import { assinarAppNaConta, infoNumero, MetaError } from '../services/whatsapp/metaApi';
import { FONTES } from '../services/whatsapp/templateService';

const usuarioDe = (req: Request) => (req as any).usuario;

/** Erros de regra viram resposta com status e mensagem; erros da Meta viram 400 com a mensagem dela. */
const tratar = (fn: (req: Request, res: Response) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try { await fn(req, res); } catch (e: any) {
      if (e instanceof WhatsappError) return res.status(e.status).json({ error: e.message, dados: e.dados });
      if (e instanceof MetaError) return res.status(400).json({ error: `WhatsApp/Meta: ${e.message}` });
      next(e);
    }
  };

// ───────────────────────── webhook (público, sem JWT) ─────────────────────────

/** Verificação feita pela Meta ao cadastrar a URL do webhook no app. */
export const webhookVerificar = tratar(async (req, res) => {
  const cfg = await lerConfig();
  const ok = req.query['hub.mode'] === 'subscribe' && !!cfg?.verifyToken && req.query['hub.verify_token'] === cfg.verifyToken;
  if (!ok) return res.status(403).send('Token de verificação inválido');
  res.status(200).send(String(req.query['hub.challenge'] || ''));
});

export const webhookReceber = async (req: Request, res: Response) => {
  try {
    await garantirTabelasWhatsapp();
    const cfg = await lerConfig();
    if (!assinaturaValida((req as any).rawBody, req.header('x-hub-signature-256'), cfg?.appSecret || '')) {
      return res.status(401).send('Assinatura inválida');
    }
    // Processa antes de responder, mas sempre responde 200: se a Meta não receber 200
    // ela reenvia o mesmo evento (o processamento ignora duplicados).
    await processarWebhook(req.body);
  } catch (e: any) {
    console.error('[WhatsApp] erro no webhook:', e?.message || e);
  }
  res.sendStatus(200);
};

// ───────────────────────── acesso ─────────────────────────

export const status = tratar(async (req, res) => {
  const ativo = await moduloAtivo();
  const cfg = await lerConfig();
  res.json({
    ativo,
    configurado: !!(cfg?.token && cfg.phoneNumberId),
    acesso: temAcessoWhatsapp(usuarioDe(req)),
    admin: ehAdmin(usuarioDe(req)),
    naoLidas: ativo ? await conv.contarNaoLidas() : 0,
  });
});

export async function exigirWhatsapp(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await moduloAtivo())) return res.status(402).json({ error: 'Envio por WhatsApp não contratado para esta empresa' });
    if (!temAcessoWhatsapp(usuarioDe(req))) return res.status(403).json({ error: 'Usuário sem acesso ao WhatsApp' });
    next();
  } catch (e) { next(e); }
}

function exigirAdmin(req: Request) {
  if (!ehAdmin(usuarioDe(req))) throw new WhatsappError(403, 'Só administradores podem alterar a configuração do WhatsApp');
}

// ───────────────────────── configuração ─────────────────────────

export const obterConfig = tratar(async (req, res) => {
  exigirAdmin(req);
  res.json(await configParaTela());
});

/** Liga o app à conta do WhatsApp para os eventos chegarem no webhook. Devolve o erro em texto, sem lançar. */
async function ligarWebhook(): Promise<{ webhookLigado: boolean; webhookErro?: string }> {
  const cfg = await lerConfig();
  if (!cfg?.token || !cfg.wabaId) return { webhookLigado: false, webhookErro: 'Informe o WABA ID e o token' };
  try {
    return { webhookLigado: await assinarAppNaConta(credenciais(cfg)) };
  } catch (e: any) {
    return { webhookLigado: false, webhookErro: e?.message || String(e) };
  }
}

export const atualizarConfig = tratar(async (req, res) => {
  exigirAdmin(req);
  await salvarConfig(req.body, usuarioDe(req)?.nome);
  await registrarLog(usuarioDe(req), 'Alterar', 'WhatsApp - Configuração', 1);
  res.json({ ...(await configParaTela()), ...(await ligarWebhook()) });
});

export const testarConexao = tratar(async (req, res) => {
  exigirAdmin(req);
  const info = await infoNumero(credenciais(await lerConfig()));
  let templates: number | null = null;
  try { templates = (await camp.templatesAprovados(true)).length; } catch { /* WABA ausente/errado */ }
  res.json({ ...info, templates, ...(await ligarWebhook()) });
});

// ───────────────────────── templates ─────────────────────────

export const templates = tratar(async (req, res) => {
  const lista = await camp.templatesAprovados(req.query.atualizar === '1');
  res.json({ templates: lista, fontes: FONTES });
});

// ───────────────────────── campanhas ─────────────────────────

export const previa = tratar(async (req, res) => { res.json(await camp.previa(req.body)); });

export const listarCampanhas = tratar(async (_req, res) => { res.json(await camp.listarCampanhas()); });

export const buscarCampanha = tratar(async (req, res) => { res.json(await camp.buscarCampanha(Number(req.params.id))); });

export const criarCampanha = tratar(async (req, res) => {
  const id = await camp.criarCampanha(req.body, usuarioDe(req));
  await registrarLog(usuarioDe(req), 'Inserir', 'WhatsApp - Campanhas', id);
  res.status(201).json({ id });
});

export const envios = tratar(async (req, res) => {
  res.json(await camp.listarEnvios(Number(req.params.id), req.query as any));
});

const acao = (fn: (id: number) => Promise<any>, nome: string) => tratar(async (req, res) => {
  const id = Number(req.params.id);
  const r = await fn(id);
  await registrarLog(usuarioDe(req), 'Alterar', `WhatsApp - Campanhas (${nome})`, id);
  res.json({ ok: true, resultado: r ?? null });
});

export const iniciar = acao(camp.iniciar, 'iniciar');
export const pausar = acao(camp.pausar, 'pausar');
export const cancelar = acao(camp.cancelar, 'cancelar');
export const reenviarFalhas = acao(camp.reenviarFalhas, 'reenviar falhas');

export const excluirCampanha = tratar(async (req, res) => {
  const id = Number(req.params.id);
  await camp.excluir(id);
  await registrarLog(usuarioDe(req), 'Deletar', 'WhatsApp - Campanhas', id);
  res.status(204).send();
});

export const envioTeste = tratar(async (req, res) => {
  const r = await camp.envioTeste(req.body);
  await registrarLog(usuarioDe(req), 'Inserir', 'WhatsApp - Envio de teste', r.numero);
  res.json(r);
});

// ───────────────────────── conversas ─────────────────────────

export const conversas = tratar(async (req, res) => {
  res.json(await conv.listarConversas({ naoLidas: req.query.naoLidas === '1', busca: req.query.busca as string }));
});

export const mensagens = tratar(async (req, res) => { res.json(await conv.mensagensDaConversa(req.params.chave)); });

export const responder = tratar(async (req, res) => {
  await conv.responder(req.params.chave, req.body?.texto, usuarioDe(req)?.nome);
  res.json({ ok: true });
});

// ───────────────────────── descadastrados ─────────────────────────

export const listarOptout = tratar(async (req, res) => { res.json(await conv.listarOptout(req.query.busca as string)); });

export const adicionarOptout = tratar(async (req, res) => {
  const chave = await conv.adicionarOptout(req.body, usuarioDe(req)?.nome);
  await registrarLog(usuarioDe(req), 'Inserir', 'WhatsApp - Descadastrados', chave);
  res.status(201).json({ chave });
});

export const removerOptout = tratar(async (req, res) => {
  await conv.removerOptout(req.params.chave);
  await registrarLog(usuarioDe(req), 'Deletar', 'WhatsApp - Descadastrados', req.params.chave);
  res.status(204).send();
});

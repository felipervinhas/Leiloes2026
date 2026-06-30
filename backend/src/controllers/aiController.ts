import { Request, Response } from 'express';
import { chat, MensagemChat } from '../services/aiService';

export async function chatAI(req: Request, res: Response) {
  const { mensagem, historico = [] } = req.body as {
    mensagem: string;
    historico?: MensagemChat[];
  };

  if (!mensagem?.trim()) {
    return res.status(400).json({ error: 'mensagem é obrigatória' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Assistente IA não configurado (ANTHROPIC_API_KEY ausente)' });
  }

  try {
    const resposta = await chat(historico, mensagem.trim());
    return res.json({ resposta });
  } catch (err: any) {
    console.error('[AI]', err?.message ?? err);
    return res.status(500).json({ error: 'Erro ao processar a pergunta' });
  }
}

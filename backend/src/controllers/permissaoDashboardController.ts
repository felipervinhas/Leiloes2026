import { Request, Response } from 'express';
import * as svc from '../services/permissaoDashboardService';

export const obter = async (req: Request, res: Response) => {
  try {
    const permissoes = await svc.obterPermissoes(Number(req.params.id));
    res.json(permissoes);
  } catch (err: any) {
    res.status(400).json({ erro: err.message });
  }
};

export const atualizar = async (req: Request, res: Response) => {
  try {
    // Verifica se o usuário logado tem perfil 1
    const usuarioLogado = (req as any).usuario;
    if (!usuarioLogado || !usuarioLogado.perfis || !usuarioLogado.perfis.some((p: any) => p.id === 1)) {
      return res.status(403).json({ erro: 'Apenas ADMs com perfil 1 podem atualizar permissões' });
    }
    
    await svc.atualizarPermissoes(Number(req.params.id), req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ erro: err.message });
  }
};

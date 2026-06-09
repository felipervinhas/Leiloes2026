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
    await svc.atualizarPermissoes(Number(req.params.id), req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ erro: err.message });
  }
};

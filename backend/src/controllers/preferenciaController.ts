import { Request, Response } from 'express';
import * as svc from '../services/preferenciaService';

export const get = async (req: Request, res: Response) => {
  try {
    const usuario = (req as any).usuario;
    const valor = await svc.getPreferencia(Number(usuario.id), req.params.chave);
    res.json({ valor });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
};

export const set = async (req: Request, res: Response) => {
  try {
    const usuario = (req as any).usuario;
    await svc.setPreferencia(Number(usuario.id), req.params.chave, req.body.valor);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
};

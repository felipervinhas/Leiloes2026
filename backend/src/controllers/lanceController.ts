import { Request, Response } from 'express';
import * as svc from '../services/lanceService';

export const listar = async (req: Request, res: Response) => {
  const { idLeilao, idLote } = req.query;
  res.json(await svc.listarLances(idLeilao ? Number(idLeilao) : undefined, idLote ? Number(idLote) : undefined));
};

export const resumo = async (req: Request, res: Response) => {
  const idLeilao = Number(req.params.idLeilao);
  if (!idLeilao) return res.status(400).json({ error: 'idLeilao obrigatório' });
  res.json(await svc.resumoLances(idLeilao));
};

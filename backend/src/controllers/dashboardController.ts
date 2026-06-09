import { Request, Response } from 'express';
import { getDashboardData, getTopsPorCategoria } from '../services/dashboardService';

export const dashboard = async (_req: Request, res: Response) => {
  const data = await getDashboardData();
  res.json(data);
};

export const topsPorCategoria = async (req: Request, res: Response) => {
  const idCategoria = req.query.categoria ? Number(req.query.categoria) : undefined;
  const data = await getTopsPorCategoria(idCategoria);
  res.json(data);
};

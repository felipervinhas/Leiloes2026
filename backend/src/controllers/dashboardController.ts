import { Request, Response } from 'express';
import { getDashboardData } from '../services/dashboardService';

export const dashboard = async (_req: Request, res: Response) => {
  const data = await getDashboardData();
  res.json(data);
};

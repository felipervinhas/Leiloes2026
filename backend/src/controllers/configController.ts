import { Request, Response } from 'express';
import { buscarConfiguracoes } from '../services/configService';

export async function getConfiguracoes(req: Request, res: Response) {
  const config = await buscarConfiguracoes();
  if (!config) return res.status(404).json({ error: 'Configurações não encontradas' });
  res.json(config);
}

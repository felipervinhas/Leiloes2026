import { Request, Response } from 'express';
import axios from 'axios';
import { buscarConfiguracoes } from '../services/configService';

export async function getConfiguracoes(req: Request, res: Response) {
  const config = await buscarConfiguracoes();
  if (!config) return res.status(404).json({ error: 'Configurações não encontradas' });
  res.json(config);
}

export async function getLogoBase64(req: Request, res: Response) {
  const config = await buscarConfiguracoes();
  if (!config?.logoUrl) return res.json({ logo: null });
  try {
    const r = await axios.get(config.logoUrl, { responseType: 'arraybuffer' });
    const contentType = (r.headers['content-type'] as string) || 'image/png';
    const base64 = Buffer.from(r.data).toString('base64');
    res.json({ logo: `data:${contentType};base64,${base64}` });
  } catch {
    res.json({ logo: null });
  }
}

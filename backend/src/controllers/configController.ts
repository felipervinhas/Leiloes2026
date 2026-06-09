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
    if (contentType.includes('svg')) return res.json({ logo: null });
    const base64 = Buffer.from(r.data).toString('base64');
    res.json({ logo: `data:${contentType};base64,${base64}` });
  } catch {
    res.json({ logo: null });
  }
}

// Serve a imagem bruta do logo (para o PDF renderer buscar via URL proxy)
export async function getLogoImagem(req: Request, res: Response) {
  const config = await buscarConfiguracoes();
  if (!config?.logoUrl) return res.status(404).end();
  try {
    const r = await axios.get(config.logoUrl, { responseType: 'arraybuffer' });
    const contentType = (r.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(r.data));
  } catch {
    res.status(502).end();
  }
}

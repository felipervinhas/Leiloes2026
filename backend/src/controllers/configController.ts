import { Request, Response } from 'express';
import axios from 'axios';
import { buscarConfiguracoes, trocarLogotipo } from '../services/configService';
import { registrarLog } from '../services/logService';

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

const TIPOS_LOGO = ['image/png', 'image/jpeg'];
const TAMANHO_MAX_LOGO = 2 * 1024 * 1024;

// PNG ou JPG apenas: são os formatos que o gerador de PDF (@react-pdf) embute nos relatórios
export async function uploadLogo(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  if (!TIPOS_LOGO.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Envie uma imagem PNG ou JPG' });
  }
  if (req.file.size > TAMANHO_MAX_LOGO) {
    return res.status(400).json({ error: 'A imagem deve ter no máximo 2 MB' });
  }
  const resultado = await trocarLogotipo(req.file.buffer, req.file.mimetype);
  await registrarLog((req as any).usuario, 'Alterar', 'Configurações', 'logotipo');
  res.json(resultado);
}

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
  if (!config?.logoUrl) { console.log('[logo] logoUrl vazio'); return res.json({ logo: null }); }
  try {
    console.log('[logo] buscando:', config.logoUrl);
    const r = await axios.get(config.logoUrl, { responseType: 'arraybuffer' });
    const contentType = (r.headers['content-type'] as string) || 'image/png';
    console.log('[logo] content-type:', contentType, '| bytes:', r.data.byteLength);

    // react-pdf/renderer não suporta SVG no componente Image
    if (contentType.includes('svg')) {
      console.log('[logo] formato SVG não suportado pelo PDF renderer');
      return res.json({ logo: null, aviso: 'svg-nao-suportado' });
    }

    const base64 = Buffer.from(r.data).toString('base64');
    res.json({ logo: `data:${contentType};base64,${base64}` });
  } catch (err: any) {
    console.error('[logo] erro ao buscar:', err.message);
    res.json({ logo: null });
  }
}

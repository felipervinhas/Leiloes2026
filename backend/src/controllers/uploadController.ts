import { Request, Response } from 'express';
import { uploadS3, deletarS3, urlS3, s3Keys } from '../services/s3Service';

export async function uploadLeilaoDesktop(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const key = s3Keys.leilaoDesktop(id);
  const url = await uploadS3(key, req.file.buffer, req.file.mimetype);
  res.json({ url, key });
}

export async function uploadLeilaoMobile(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const key = s3Keys.leilaoMobile(id);
  const url = await uploadS3(key, req.file.buffer, req.file.mimetype);
  res.json({ url, key });
}

export async function uploadLeilaoMedia(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const key = s3Keys.leilaoMedia(id);
  const url = await uploadS3(key, req.file.buffer, req.file.mimetype);
  res.json({ url, key });
}

export async function uploadLoteImagem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const num = Number(req.params.num) as 1 | 2 | 3 | 4;
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  if (![1, 2, 3, 4].includes(num)) return res.status(400).json({ error: 'Número de imagem inválido (1-4)' });
  const key = s3Keys.loteImagem(id, num);
  const url = await uploadS3(key, req.file.buffer, req.file.mimetype);
  res.json({ url, key });
}

export async function deletarLoteImagem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const num = Number(req.params.num) as 1 | 2 | 3 | 4;
  await deletarS3(s3Keys.loteImagem(id, num));
  res.json({ ok: true });
}

export async function deletarLeilaoImagem(req: Request, res: Response) {
  const id = Number(req.params.id);
  const tipo = req.params.tipo as 'desktop' | 'mobile' | 'media';
  const keyMap = { desktop: s3Keys.leilaoDesktop, mobile: s3Keys.leilaoMobile, media: s3Keys.leilaoMedia };
  if (!keyMap[tipo]) return res.status(400).json({ error: 'Tipo inválido' });
  await deletarS3(keyMap[tipo](id));
  res.json({ ok: true });
}

export function getImagensLeilao(req: Request, res: Response) {
  const id = Number(req.params.id);
  res.json({
    desktop: urlS3(s3Keys.leilaoDesktop(id)),
    mobile:  urlS3(s3Keys.leilaoMobile(id)),
    media:   urlS3(s3Keys.leilaoMedia(id)),
  });
}

export async function getImagensLote(req: Request, res: Response) {
  const id = Number(req.params.id);
  let idRef = id;
  try {
    const { getPool, sql } = await import('../config/database');
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id)
      .query(`SELECT ISNULL(ID_DUPLICADO, 0) AS ID_DUPLICADO FROM Lotes WHERE ID=@id`);
    const dup = r.recordset[0]?.ID_DUPLICADO ?? 0;
    if (dup > 0) idRef = dup;
  } catch { /* se coluna não existir, usa id original */ }
  res.json([1, 2, 3, 4].map(n => ({
    num: n,
    url: urlS3(s3Keys.loteImagem(idRef, n as 1 | 2 | 3 | 4)),
    key: s3Keys.loteImagem(idRef, n as 1 | 2 | 3 | 4),
  })));
}

import { Request, Response } from 'express';
import { calcularAcertoComprador } from '../services/acertoCompradorService';

export const buscar = async (req: Request, res: Response) => {
  const idComprador = Number(req.query.idComprador);
  const idLeilao = req.query.idLeilao ? Number(req.query.idLeilao) : undefined;
  if (!idComprador) {
    return res.status(400).json({ error: 'Informe idComprador' });
  }
  res.json(await calcularAcertoComprador(idComprador, idLeilao));
};

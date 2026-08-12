import { Request, Response } from 'express';
import { calcularAcertoVendedor } from '../services/acertoVendedorService';

export const buscar = async (req: Request, res: Response) => {
  const idVendedor = Number(req.query.idVendedor);
  const idLeilao = req.query.idLeilao ? Number(req.query.idLeilao) : undefined;
  if (!idVendedor) {
    return res.status(400).json({ error: 'Informe idVendedor' });
  }
  res.json(await calcularAcertoVendedor(idVendedor, idLeilao));
};

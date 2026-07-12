import { Request, Response } from 'express';
import { calcularAcertoVendedor } from '../services/acertoVendedorService';

export const buscar = async (req: Request, res: Response) => {
  const idLeilao = Number(req.query.idLeilao);
  const idVendedor = Number(req.query.idVendedor);
  if (!idLeilao || !idVendedor) {
    return res.status(400).json({ error: 'Informe idLeilao e idVendedor' });
  }
  res.json(await calcularAcertoVendedor(idLeilao, idVendedor));
};

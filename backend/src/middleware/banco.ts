import { Request, Response, NextFunction } from 'express';
import { bancoStorage } from '../config/bancoContext';
import { BANCOS_PERMITIDOS } from '../config/database';

export function bancoMiddleware(req: Request, res: Response, next: NextFunction) {
  const banco = req.params.banco;
  if (!BANCOS_PERMITIDOS.includes(banco)) {
    res.status(400).json({ error: `Banco inválido. Opções: ${BANCOS_PERMITIDOS.join(', ')}` });
    return;
  }
  bancoStorage.run(banco, next);
}

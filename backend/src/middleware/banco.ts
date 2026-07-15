import { Request, Response, NextFunction } from 'express';
import { bancoStorage } from '../config/bancoContext';
import { BANCOS_PERMITIDOS } from '../config/database';
import { resolveBancoReal } from '../config/bancoAliases';

export function bancoMiddleware(req: Request, res: Response, next: NextFunction) {
  const banco = resolveBancoReal(req.params.banco);
  if (!BANCOS_PERMITIDOS.includes(banco)) {
    res.status(400).json({ error: 'Banco inválido.' });
    return;
  }
  bancoStorage.run(banco, next);
}

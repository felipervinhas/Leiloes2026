import { Request, Response } from 'express';
import { getDashboardData, getTopsPorCategoria } from '../services/dashboardService';
import * as permSvc from '../services/permissaoDashboardService';

export const dashboard = async (req: Request, res: Response) => {
  try {
    const usuarioLogado = (req as any).usuario;
    const data = await getDashboardData();
    
    // Se for ADM, buscar suas permissões
    let permissoes = null;
    if (usuarioLogado && usuarioLogado.adm === 'S') {
      try {
        permissoes = await permSvc.obterPermissoes(usuarioLogado.id);
      } catch {
        // Se não tiver permissões, assume todas como 'S' (mostra tudo)
        permissoes = {
          idUsuario: usuarioLogado.id,
          verComissoes: 'S',
          verValoresLiquidos: 'S',
          verInfoFinanceira: 'S',
          verTopCompradores: 'S',
          verTopVendedores: 'S',
          verVencimentos: 'S',
        };
      }
    }
    
    res.json({ ...data, permissoes });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
};

export const topsPorCategoria = async (req: Request, res: Response) => {
  try {
    const idCategoria = req.query.categoria ? Number(req.query.categoria) : undefined;
    const data = await getTopsPorCategoria(idCategoria);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
};

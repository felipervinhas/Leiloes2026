import { Request, Response } from 'express';
import * as svc from '../services/consultaVendasService';

export const consultar = async (req: Request, res: Response) => {
  const { idLeilao, idLote, idVendedor, idComprador, defesa, idRacas } = req.query;

  const filtros: svc.FiltrosConsulta = {
    idLeilao:    idLeilao    ? Number(idLeilao)    : undefined,
    idLote:      idLote      ? Number(idLote)      : undefined,
    idVendedor:  idVendedor  ? Number(idVendedor)  : undefined,
    idComprador: idComprador ? Number(idComprador) : undefined,
    defesa:      defesa as 'S' | 'N' | undefined,
    idRacas:     idRacas
      ? String(idRacas).split(',').map(Number).filter(Boolean)
      : undefined,
  };

  // Sem nenhum filtro reconhecido, a consulta roda irrestrita sobre VWVendas
  // (8 joins + 3 subqueries correlacionadas) — a tela já bloqueia isso no
  // cliente, mas o backend precisa recusar também (chamada direta à API,
  // bug futuro no frontend). idLote/defesa/idRacas sozinhos não bastam:
  // sem idLeilao/idVendedor/idComprador o filtro por lote ainda varre tudo.
  if (!filtros.idLeilao && !filtros.idVendedor && !filtros.idComprador) {
    return res.status(400).json({ error: 'Informe ao menos um filtro (leilão, vendedor ou comprador)' });
  }

  res.json(await svc.consultarVendas(filtros));
};

export const racas = async (req: Request, res: Response) => {
  const idLeilao = Number(req.params.idLeilao);
  if (!idLeilao) return res.status(400).json({ error: 'idLeilao obrigatório' });
  res.json(await svc.racasPorLeilao(idLeilao));
};

export const lotes = async (req: Request, res: Response) => {
  const idLeilao = Number(req.params.idLeilao);
  if (!idLeilao) return res.status(400).json({ error: 'idLeilao obrigatório' });
  res.json(await svc.lotesPorLeilao(idLeilao));
};

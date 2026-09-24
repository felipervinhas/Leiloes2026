import { Request, Response } from 'express';
import * as svc from '../services/consultaVendasService';

export const consultar = async (req: Request, res: Response) => {
  const { idLeilao, idLote, idVendedor, idComprador, defesa, idRacas, ano } = req.query;

  const filtros: svc.FiltrosConsulta = {
    idLeilao:    idLeilao    ? Number(idLeilao)    : undefined,
    idLote:      idLote      ? Number(idLote)      : undefined,
    idVendedor:  idVendedor  ? Number(idVendedor)  : undefined,
    idComprador: idComprador ? Number(idComprador) : undefined,
    defesa:      defesa as 'S' | 'N' | undefined,
    idRacas:     idRacas
      ? String(idRacas).split(',').map(Number).filter(Boolean)
      : undefined,
    ano:         ano ? Number(ano) : undefined,
  };

  // Sem nenhum filtro reconhecido, a consulta roda irrestrita sobre VWVendas
  // (8 joins + 3 subqueries correlacionadas) — a tela já bloqueia isso no
  // cliente, mas o backend precisa recusar também (chamada direta à API,
  // bug futuro no frontend). idLote/defesa/idRacas sozinhos não bastam:
  // sem idLeilao/idVendedor/idComprador o filtro por lote ainda varre tudo.
  // Raça + Ano também basta (ex.: todos os compradores de Crioulo em 2025) —
  // raça sozinha varreria a base inteira (15s+ nas raças maiores).
  const racaComAno = !!filtros.idRacas?.length && !!filtros.ano;
  if (!filtros.idLeilao && !filtros.idVendedor && !filtros.idComprador && !racaComAno) {
    return res.status(400).json({ error: 'Informe leilão, vendedor, comprador ou raça + ano' });
  }

  res.json(await svc.consultarVendas(filtros));
};

export const racasDasVendas = async (req: Request, res: Response) => {
  const num = (v: unknown) => (v ? Number(v) : undefined);
  res.json(await svc.racasDasVendas({
    idLeilao: num(req.query.idLeilao),
    idVendedor: num(req.query.idVendedor),
    idComprador: num(req.query.idComprador),
    ano: num(req.query.ano),
  }));
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

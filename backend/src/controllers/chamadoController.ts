import { Request, Response } from 'express';
import * as svc from '../services/chamadoService';
import { uploadS3, deletarS3, s3Keys } from '../services/s3Service';
import { registrarLog } from '../services/logService';

export const listar = async (req: Request, res: Response) => {
  res.json(await svc.listarChamados(req.query.busca as string, req.query.status as string));
};

export const buscar = async (req: Request, res: Response) => {
  const data = await svc.buscarChamadoPorId(Number(req.params.id));
  if (!data) return res.status(404).json({ error: 'Não encontrado' });
  res.json(data);
};

export const criar = async (req: Request, res: Response) => {
  const usuario = (req as any).usuario;
  const { tipo, titulo, descricao } = req.body;
  if (!tipo || !titulo || !descricao) {
    return res.status(400).json({ error: 'Tipo, título e descrição são obrigatórios' });
  }
  const id = await svc.criarChamado({ tipo, titulo, descricao, idUsuario: usuario?.id, nomeUsuario: usuario?.nome });
  if (req.file) {
    const key = s3Keys.chamadoImagem(id);
    await uploadS3(key, req.file.buffer, req.file.mimetype);
    await svc.definirImagemChamado(id, key);
  }
  await registrarLog(usuario, 'Inserir', 'Chamados', id);
  res.status(201).json({ id });
};

export const atualizarStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, resposta } = req.body;
  if (!status) return res.status(400).json({ error: 'Status é obrigatório' });
  await svc.atualizarStatusChamado(id, status, resposta);
  await registrarLog((req as any).usuario, 'Alterar', 'Chamados', id);
  res.json({ ok: true });
};

export const deletar = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const chamado = await svc.buscarChamadoPorId(id);
  if (chamado?.imagemKey) await deletarS3(chamado.imagemKey);
  await svc.deletarChamado(id);
  await registrarLog((req as any).usuario, 'Deletar', 'Chamados', id);
  res.status(204).send();
};

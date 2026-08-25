import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getPool } from '../config/database';
import { getBanco } from '../config/bancoContext';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const bucketCache = new Map<string, string>();

// Cada tenant (banco) tem seu próprio bucket S3, legado do sistema Delphi
// (Configuracoes.bucket) — ex.: "knorrleiloes" pro Knorr, "macedo" pro
// MacedoLeiloes. Só cai no AWS_BUCKET do .env se o tenant não tiver
// configurado (cadastro incompleto).
export async function resolveBucket(): Promise<string> {
  const banco = getBanco();
  const cached = bucketCache.get(banco);
  if (cached) return cached;
  const pool = await getPool();
  const r = await pool.request().query('SELECT TOP 1 bucket FROM Configuracoes');
  const bucket = r.recordset[0]?.bucket || process.env.AWS_BUCKET || 'macedo';
  bucketCache.set(banco, bucket);
  return bucket;
}

// Marca quando cada key foi enviada nesta execução do processo, pra anexar
// ?v=timestamp na URL e forçar o navegador a buscar de novo em vez de
// reaproveitar a imagem antiga em cache (o nome do arquivo nunca muda).
const uploadedAt = new Map<string, number>();

export function s3PublicUrl(bucket: string, key: string): string {
  const v = uploadedAt.get(key);
  return `https://${bucket}.s3.us-east-2.amazonaws.com/${key}${v ? `?v=${v}` : ''}`;
}

export async function uploadS3(key: string, buffer: Buffer, mimetype: string): Promise<string> {
  const bucket = await resolveBucket();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  uploadedAt.set(key, Date.now());
  return s3PublicUrl(bucket, key);
}

export async function deletarS3(key: string): Promise<void> {
  const bucket = await resolveBucket();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  // Não usar .delete(key) aqui: isso tiraria o "?v=" da URL, fazendo-a voltar
  // pra forma "crua" que o navegador pode ter em cache de uma visita anterior
  // (o nome do arquivo no S3 nunca muda) — a imagem apagada "reaparecia" ao
  // reabrir o cadastro. Marcando um novo timestamp força uma URL nunca vista
  // antes, garantindo que o navegador busque de novo (e receba 404/vazio).
  uploadedAt.set(key, Date.now());
}

export async function existeS3(key: string): Promise<boolean> {
  const bucket = await resolveBucket();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function urlS3(key: string): Promise<string> {
  const bucket = await resolveBucket();
  return s3PublicUrl(bucket, key);
}

// Nomes dos arquivos seguindo o padrão do sistema Delphi
export const s3Keys = {
  leilaoDesktop: (id: number) => `desktop_leilao_img_${id}.png`,
  leilaoMobile:  (id: number) => `mobile_leilao_img_${id}.png`,
  leilaoMedia:   (id: number) => `leilao_media_${id}.jpg`,
  loteImagem:    (id: number, num: 1 | 2 | 3 | 4) => `lote_${num}_img_${id}.jpg`,
  chamadoImagem: (id: number) => `chamados/chamado_${id}.jpg`,
  clienteDocumento: (tipo: 'documento' | 'residencia' | 'renda' | 'analise', id: number, ext: 'jpg' | 'pdf') =>
    `${tipo}_user_${id}.${ext}`,
};

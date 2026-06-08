import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_BUCKET || 'macedo';

export async function uploadS3(key: string, buffer: Buffer, mimetype: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  }));
  return `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`;
}

export async function deletarS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function urlS3(key: string): string {
  return `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`;
}

// Nomes dos arquivos seguindo o padrão do sistema Delphi
export const s3Keys = {
  leilaoDesktop: (id: number) => `desktop_leilao_img_${id}.png`,
  leilaoMobile:  (id: number) => `mobile_leilao_img_${id}.png`,
  leilaoMedia:   (id: number) => `leilao_media_${id}.jpg`,
  loteImagem:    (id: number, num: 1 | 2 | 3 | 4) => `lote_${num}_img_${id}.jpg`,
};

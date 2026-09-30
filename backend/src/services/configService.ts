import { getPool } from '../config/database';
import { copiarS3, uploadS3SemCache } from './s3Service';

export interface Configuracoes {
  empresa: string;
  empresaEndereco: string;
  logotipo: string;
  logoUrl: string;
  bucket: string;
  corMenuTop: string;
  corMenuBottom: string;
  corLetraTop: string;
  corLetraBottom: string;
  url: string;
  porta: number;
  mostrarCotacoes: string;
  controleClientes: string;
}

function delphiColorToCss(cor: string): string {
  if (!cor) return '#000000';
  const named: Record<string, string> = {
    clblack: '#000000', clwhite: '#ffffff', clred: '#ff0000',
    clblue: '#0000ff', clgreen: '#008000', clyellow: '#ffff00',
  };
  const lower = cor.toLowerCase();
  if (named[lower]) return named[lower];
  // Delphi $00BBGGRR → CSS #RRGGBB
  const hex = cor.replace(/^\$/, '').padStart(8, '0');
  const bb = hex.substring(2, 4);
  const gg = hex.substring(4, 6);
  const rr = hex.substring(6, 8);
  return `#${rr}${gg}${bb}`;
}

export async function buscarConfiguracoes(): Promise<Configuracoes | null> {
  const pool = await getPool();
  const r = await pool.request().query('SELECT TOP 1 * FROM Configuracoes');
  if (!r.recordset.length) return null;
  const c = r.recordset[0];

  const bucket = c.bucket || '';
  const logoUrl = c.Logotipo
    ? `https://${bucket}.s3.us-east-2.amazonaws.com/${c.Logotipo}`
    : '';

  return {
    empresa: c.Empresa || '',
    empresaEndereco: c.EmpresaEndereco || '',
    logotipo: c.Logotipo || '',
    logoUrl,
    bucket,
    corMenuTop: delphiColorToCss(c.CorMenuTop),
    corMenuBottom: delphiColorToCss(c.CorMenuBottom),
    corLetraTop: delphiColorToCss(c.CorLetraTop),
    corLetraBottom: delphiColorToCss(c.CorLetraBottom),
    url: c.URL || '',
    porta: c.PORTA || 0,
    mostrarCotacoes: c.MOSTRAR_COTACOES || 'N',
    controleClientes: c.CONTROLE_CLIENTES || 'N',
  };
}

/**
 * Troca o logotipo do tenant no bucket S3.
 *
 * Mantém o MESMO nome de arquivo de Configuracoes.Logotipo (ex.: "Logotipo.jpg")
 * em vez de criar um novo: o Delphi lê esse campo como nome de arquivo local
 * (LoadFromFile) — trocar o valor quebraria o Delphi de quem ainda o usa.
 * Antes de sobrescrever, guarda uma cópia em logotipo-backup/ pra poder voltar.
 */
export async function trocarLogotipo(buffer: Buffer, mimetype: string): Promise<{ url: string; backup: string | null }> {
  const pool = await getPool();
  const r = await pool.request().query('SELECT TOP 1 Logotipo FROM Configuracoes');
  const key = (r.recordset[0]?.Logotipo || '').trim() || 'Logotipo.jpg';

  const carimbo = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupKey = `logotipo-backup/${carimbo}_${key}`;
  const copiou = await copiarS3(key, backupKey);

  const url = await uploadS3SemCache(key, buffer, mimetype);

  // Se o Logotipo estava vazio no cadastro, registra o nome usado
  if (!(r.recordset[0]?.Logotipo || '').trim()) {
    await pool.request().input('logo', key).query('UPDATE Configuracoes SET Logotipo = @logo');
  }
  return { url, backup: copiou ? backupKey : null };
}

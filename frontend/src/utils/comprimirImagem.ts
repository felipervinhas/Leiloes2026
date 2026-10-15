// Deixa a foto mais leve antes do upload, sem perda visível: limita o lado maior e regrava
// em JPEG com qualidade 85%. As fotos de lote chegavam com ~1,2 MB em 1920 px (JPEG quase
// sem compressão); regravadas ficam em torno de 300 KB — o site e o app carregam mais rápido
// e o upload no celular, em campo, também.
//
// Sempre JPEG: o nome no S3 é fixo (lote_N_img_ID.jpg) e o site, o app e o Delphi leem esse nome.

const TIPOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface OpcoesCompressao { ladoMaximo?: number; qualidade?: number; }

async function carregar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // imageOrientation 'from-image' aplica a rotação do EXIF (foto de celular "deitada")
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as any); } catch { /* cai no <img> */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('imagem inválida')); };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Devolve a foto comprimida, ou a original quando não é foto (PDF, GIF...), quando a
 * compressão falha ou quando não compensa (menos de 10% de ganho sem precisar reduzir).
 */
export async function comprimirImagem(file: File, opcoes: OpcoesCompressao = {}): Promise<File> {
  const { ladoMaximo = 1920, qualidade = 0.85 } = opcoes;
  if (!TIPOS.includes(file.type.toLowerCase())) return file;
  try {
    const img = await carregar(file);
    const w = (img as any).width, h = (img as any).height;
    const escala = Math.min(1, ladoMaximo / Math.max(w, h));
    const largura = Math.round(w * escala), altura = Math.round(h * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura; canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff'; // PNG com transparência: fundo branco no JPEG, em vez de preto
    ctx.fillRect(0, 0, largura, altura);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img as any, 0, 0, largura, altura);
    if ('close' in img) (img as ImageBitmap).close();

    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', qualidade));
    if (!blob) return file;
    if (escala === 1 && blob.size > file.size * 0.9) return file;
    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export const fmtTamanho = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`;

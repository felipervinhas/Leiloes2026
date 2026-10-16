// Leitura da ficha do animal do Herd Book Collares (sistema.herdbook.org.br, sistema Origen),
// colada pelo usuário. Como a ABCCC, o site não permite consulta automática (robots.txt
// "Disallow: /"), então quem busca é a pessoa e aqui só lemos o texto copiado.
//
// Os dados vêm como "Rótulo: valor" ("Registro: 210045", "Tatuagem: 4313TE"); o pedigree
// vem em caixas "NOME | LIVRO | REGISTRO | PELAGEM".
import type { FichaAbccc } from './fichaAbccc';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const ROTULOS: Record<string, string> = {
  'RACA': 'raca', 'REGISTRO': 'registro', 'LIVRO': 'livro', 'SEXO': 'sexo', 'TATUAGEM': 'tatuagem',
  'NASCIMENTO': 'nascimento', 'PELAGEM': 'pelagem', 'SITUACAO': 'situacao', 'CRIADOR(A)': 'criador',
  'ESTABELECIMENTO DO(A) CRIADOR(A)': 'estabelecimento', 'PROPRIETARIO': 'proprietario', 'GENOMICA': 'genomica',
};
// menu, botões e rodapé da página, que vêm junto no Ctrl+A
const NAO_E_NOME = /^(BOVINOS|EQUINOS|AFIXO|CRIADORES|CENTRAIS|SUMARIO ONLINE|INICIO|ANIMAL|PEDIGREE|ORIGEN|VISUALIZAR .*|QTD\. FILHOS.*|INICIO ANIMAL)$/;

export interface FichaHerdbook extends FichaAbccc {
  raca: string | null;
  livro: string | null;
}

/** Lê a ficha colada. Devolve null quando o texto não parece uma ficha do Herd Book. */
export function lerFichaHerdbook(texto: string): FichaHerdbook | null {
  if (!texto?.trim()) return null;
  const linhas = texto.split(/\r?\n|\t/).map(l => l.trim()).filter(Boolean);
  // a ficha da ARCO (ovinos) também tem "Registro:" e "Tatuagem:" — fica com o leitor dela
  if (linhas.some(l => /ARVORE DE 5/.test(norm(l)) || norm(l) === 'DADOS DO PRODUTO')) return null;
  const v: Record<string, string | null> = {};
  let iPrimeiroRotulo = -1;

  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^([^:]{2,40}):\s*(.*)$/);
    if (!m) continue;
    const chave = ROTULOS[norm(m[1])];
    if (!chave || chave in v) continue;
    if (iPrimeiroRotulo < 0) iPrimeiroRotulo = i;
    let valor = m[2].trim();
    // "Registro:" sozinho na linha e o valor na seguinte
    if (!valor && linhas[i + 1] && !/^[^:]{2,40}:/.test(linhas[i + 1])) valor = linhas[++i].trim();
    v[chave] = !valor || /^[—–-]+$/.test(valor) ? null : valor;
  }
  // precisa ao menos de registro ou tatuagem e de mais um dado da ficha
  if (!(v.registro || v.tatuagem) || Object.keys(v).length < 3) return null;

  let nome: string | null = null;
  for (let i = iPrimeiroRotulo - 1; i >= 0; i--) {
    const n = norm(linhas[i]);
    if (NAO_E_NOME.test(n) || /NOME OU APELIDO/.test(n)) continue;
    nome = linhas[i]; break;
  }

  const sexo = norm(v.sexo || '');
  const data = v.nascimento?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  // "ABN AGROPECUÁRIA (35)": o número é o código do proprietário no Herd Book
  const proprietario = v.proprietario?.replace(/\s*\(\d+\)\s*$/, '') || null;

  return {
    nome, sbb: v.registro?.replace(/\D/g, '') || null, rp: v.tatuagem?.toUpperCase() || null,
    sexo: sexo.startsWith('MACHO') ? 'M' : sexo.startsWith('FEMEA') ? 'F' : null,
    castrado: null,
    pelagem: v.pelagem ? v.pelagem.toUpperCase() : null,
    nascimento: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    altura: null, torax: null, canela: null,
    // pai e mãe: falta ver em que ordem as caixas do pedigree saem ao copiar
    pai: { sbb: null, nome: null, rp: null, pelagem: null },
    mae: { sbb: null, nome: null, rp: null, pelagem: null },
    criador: v.criador || null, cidadeCriador: v.estabelecimento || null,
    proprietario, raca: v.raca || null, livro: v.livro || null,
  };
}

/** Livro e criador numa linha para a observação do lote. */
export function observacaoHerdbook(f: FichaHerdbook): string | null {
  const partes = [
    f.livro && `Livro ${f.livro}`,
    f.criador && `Criador: ${f.criador}${f.cidadeCriador ? ` (${f.cidadeCriador})` : ''}`,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

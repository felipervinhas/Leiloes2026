// Leitura da "Árvore de 5ª Geração" da ARCO (sistema.arcoovinos.com.br), colada pelo usuário.
// Como nas outras associações, a consulta tem reCAPTCHA: quem busca é a pessoa e aqui só lemos
// o texto copiado.
//
// Os dados vêm como "Rótulo: valor" ("Tatuagem: 460", "Registro: O 259788"); a árvore traz o
// rótulo numa linha e o animal na seguinte ("Pai" / "O253048 - JEP TE 1027").
import type { FichaAbccc } from './fichaAbccc';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const ROTULOS: Record<string, string> = {
  'RACA': 'raca', 'NOME': 'nome', 'TATUAGEM': 'tatuagem', 'REGISTRO': 'registro', 'NASCIMENTO': 'nascimento',
  'SERVICO': 'servico', 'REBANHO': 'rebanho', 'SEXO': 'sexo', 'SITUACAO': 'situacao', 'STATUS': 'status',
  'PARTO': 'parto', 'CLASSE': 'classe', 'GENOTIPAGEM': 'genotipagem',
};

export interface FichaArco extends FichaAbccc {
  raca: string | null;
  classe: string | null;
  parto: string | null;
  servico: string | null;
}

/** "O253048 - JEP TE 1027" → registro e nome. */
function animalDaArvore(linha?: string) {
  const m = linha?.match(/^([A-Z]{0,4}\s?\d+)\s*-\s*(.+)$/i);
  return m ? { sbb: m[1].replace(/\s+/g, '').toUpperCase(), nome: m[2].trim() } : { sbb: null, nome: null };
}

/** Lê a ficha colada. Devolve null quando o texto não parece uma ficha da ARCO. */
export function lerFichaArco(texto: string): FichaArco | null {
  if (!texto?.trim()) return null;
  const linhas = texto.split(/\r?\n|\t/).map(l => l.trim()).filter(Boolean);
  // a árvore e o "Dados do Produto" são o que distingue a ficha da ARCO das outras
  if (!linhas.some(l => /ARVORE DE 5/.test(norm(l))) && !linhas.some(l => norm(l) === 'DADOS DO PRODUTO')) return null;

  const v: Record<string, string | null> = {};
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^([^:]{2,30}):\s*(.*)$/);
    if (!m) continue;
    const chave = ROTULOS[norm(m[1])];
    if (!chave || chave in v) continue;
    let valor = m[2].trim();
    if (!valor && linhas[i + 1] && !/^[^:]{2,30}:/.test(linhas[i + 1])) valor = linhas[++i].trim();
    v[chave] = !valor || /^[—–-]+$/.test(valor) ? null : valor;
  }
  if (!(v.registro || v.tatuagem)) return null;

  // pai e mãe: o rótulo sozinho na linha ("Pai", "Mãe") e o animal na seguinte
  const iPai = linhas.findIndex(l => norm(l) === 'PAI');
  const iMae = linhas.findIndex(l => norm(l) === 'MAE');
  const pai = animalDaArvore(iPai >= 0 ? linhas[iPai + 1] : undefined);
  const mae = animalDaArvore(iMae >= 0 ? linhas[iMae + 1] : undefined);

  const sexo = norm(v.sexo || '');
  const data = v.nascimento?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return {
    nome: v.nome || null, sbb: v.registro?.replace(/\s+/g, '').toUpperCase() || null, rp: v.tatuagem || null,
    sexo: sexo.startsWith('MACHO') ? 'M' : sexo.startsWith('FEMEA') ? 'F' : null,
    castrado: null, pelagem: null,
    nascimento: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    altura: null, torax: null, canela: null,
    pai: { ...pai, rp: null, pelagem: null }, mae: { ...mae, rp: null, pelagem: null },
    criador: null, cidadeCriador: null, proprietario: null,
    raca: v.raca || null, classe: v.classe || null, parto: v.parto || null, servico: v.servico || null,
  };
}

/** Classe, parto e serviço numa linha para a observação do lote. */
export function observacaoArco(f: FichaArco): string | null {
  const partes = [
    f.classe && `Classe ${f.classe}`, f.parto && `Parto ${f.parto.toLowerCase()}`, f.servico && `Serviço: ${f.servico.toLowerCase()}`,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

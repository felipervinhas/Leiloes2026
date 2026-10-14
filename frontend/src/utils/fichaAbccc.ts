// Leitura da ficha do animal da Pesquisa Genealógica da ABCCC (cavalocrioulo.org.br/pesquisas),
// colada pelo usuário (Ctrl+A, Ctrl+C na página da ficha). O site não permite consulta
// automática (reCAPTCHA + robots.txt), então quem busca é a pessoa e aqui só lemos o texto.
//
// A ficha copiada vem com um rótulo por linha seguido do valor ("SBB PAI" / "B074968"),
// às vezes na mesma linha ou separados por tab, conforme o navegador.

export interface ParenteFicha { sbb: string | null; nome: string | null; rp: string | null; pelagem: string | null; }

export interface FichaAbccc {
  nome: string | null;
  sbb: string | null;
  rp: string | null;
  sexo: 'M' | 'F' | null;
  castrado: boolean | null;
  pelagem: string | null;
  nascimento: string | null;      // 'YYYY-MM-DD'
  altura: string | null;
  torax: string | null;
  canela: string | null;
  pai: ParenteFicha;
  mae: ParenteFicha;
  criador: string | null;
  cidadeCriador: string | null;
  proprietario: string | null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const SECOES = ['DADOS GENERICOS', 'DADOS DO PAI', 'DADOS DA MAE', 'DADOS DO CRIADOR', 'DADOS DO PROPRIETARIO'] as const;
type Secao = typeof SECOES[number] | 'CABECALHO';

// todos os rótulos da ficha — servem para não tomar um rótulo vazio como valor do anterior
const ROTULOS = [
  'STATUS', 'SITUACAO', 'CONFIRMACAO', 'SEXO', 'NASCIMENTO', 'SBB ALTERNATIVO', 'ANIMAL COM RESTRICAO', 'PELAGEM',
  'REGISTRO DE MERITOS', 'RES. DOMINIO', 'ULT. TRANSFERENCIA', 'CASTRA', 'DATA DA MORTE', 'ALTURA (M)', 'TORAX (M)',
  'CANELA (M)', 'DNA TIPADO', 'N.M.G.C.', 'SBB PAI', 'NOME PAI', 'RP PAI', 'SBB MAE', 'NOME MAE', 'RP MAE',
  'CODIGO DO CRIADOR', 'NOME DO CRIADOR', 'ESTABELECIMENTO', 'CIDADE DO ESTABELECIMENTO', 'CIDADE ESTABELECIMENTO',
  'CODIGO DO PROPRIETARIO', 'NOME DO PROPRIETARIO',
].sort((a, b) => b.length - a.length); // o mais longo primeiro: "SBB PAI" antes de "SBB"

const vazio = (v: string | null | undefined) => !v || /^[—–\-.]+$/.test(v.trim()) ? null : v.trim();

/** Separa a ficha em seções e, em cada uma, os pares rótulo → valor. */
function lerPares(texto: string) {
  const linhas = texto.split(/\r?\n|\t/).map(l => l.trim()).filter(Boolean);
  const secoes = new Map<Secao, { linhas: string[]; pares: Map<string, string | null> }>();
  let atual: Secao = 'CABECALHO';
  secoes.set(atual, { linhas: [], pares: new Map() });

  for (let i = 0; i < linhas.length; i++) {
    const n = norm(linhas[i]);
    const secao = SECOES.find(s => n === s);
    if (secao) { atual = secao; secoes.set(atual, { linhas: [], pares: new Map() }); continue; }
    const s = secoes.get(atual)!;
    s.linhas.push(linhas[i]);
    const rotulo = ROTULOS.find(r => n === r || n.startsWith(`${r} `));
    if (!rotulo || s.pares.has(rotulo)) continue;
    if (n === rotulo) {
      // valor na linha seguinte, a menos que ela já seja outro rótulo ou outra seção (valor em branco)
      const prox = linhas[i + 1];
      const np = prox ? norm(prox) : '';
      const proxEhRotulo = !prox || SECOES.some(x => np === x) || ROTULOS.some(r => np === r);
      s.pares.set(rotulo, proxEhRotulo ? null : vazio(prox));
      if (!proxEhRotulo) i++;
    } else {
      // "SBB PAI B074968" na mesma linha: tira as palavras do rótulo
      const palavras = rotulo.split(' ').length;
      s.pares.set(rotulo, vazio(linhas[i].split(/\s+/).slice(palavras).join(' ')));
    }
  }
  return secoes;
}

const dataIso = (v: string | null) => {
  const m = v?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
/** "Colorada / Bragada / Rabicana / Salina" → "COLORADA BRAGADA RABICANA SALINA", como já é gravado nos lotes. */
const pelagemLote = (v: string | null) => v ? v.split('/').map(p => p.trim()).filter(Boolean).join(' ').toUpperCase() : null;

/** Lê a ficha colada. Devolve null quando o texto não parece uma ficha da ABCCC. */
export function lerFichaAbccc(texto: string): FichaAbccc | null {
  if (!texto?.trim()) return null;
  const secoes = lerPares(texto);
  const g = secoes.get('DADOS GENERICOS')?.pares;
  const pai = secoes.get('DADOS DO PAI')?.pares;
  const mae = secoes.get('DADOS DA MAE')?.pares;
  const cri = secoes.get('DADOS DO CRIADOR')?.pares;
  const pro = secoes.get('DADOS DO PROPRIETARIO')?.pares;

  // cabeçalho: "FIDALGO DE SÃO PEDRO" e logo abaixo "SBB B396148 · RP 1513"
  const cab = secoes.get('CABECALHO')!.linhas;
  let nome: string | null = null, sbb: string | null = null, rp: string | null = null;
  const iSbb = cab.findIndex(l => /\bSBB\s+[A-Z]{0,3}\d+/i.test(l));
  if (iSbb >= 0) {
    sbb = cab[iSbb].match(/\bSBB\s+([A-Z]{0,3}\d+)/i)?.[1]?.toUpperCase() ?? null;
    rp = cab[iSbb].match(/\bRP\s+([\w-]+)/i)?.[1] ?? null;
    const ignorar = /^(COMO USAR|.*NOVA BUSCA|CAVALO|CRIOULO|CAVALO CRIOULO|GENEALOGIA ABCCC)$/;
    for (let i = iSbb - 1; i >= 0; i--) { if (!ignorar.test(norm(cab[i]))) { nome = cab[i].trim(); break; } }
    // o título da aba às vezes vem junto: "FIDALGO DE SÃO PEDRO — B396148"
    if (nome) nome = nome.replace(/\s+[—–-]\s+[A-Z]{0,3}\d+\s*$/, '').trim() || null;
  }

  if (!sbb && !g && !pai && !mae) return null;

  const sexoTxt = norm(g?.get('SEXO') || cab.find(l => /^(MACHO|FEMEA)$/.test(norm(l))) || '');
  const castra = norm(g?.get('CASTRA') || '');
  const parente = (p?: Map<string, string | null>, lado = 'PAI'): ParenteFicha => ({
    sbb: p?.get(`SBB ${lado}`)?.toUpperCase() ?? null, nome: p?.get(`NOME ${lado}`) ?? null,
    rp: p?.get(`RP ${lado}`) ?? null, pelagem: pelagemLote(p?.get('PELAGEM') ?? null),
  });
  const cidade = cri?.get('CIDADE DO ESTABELECIMENTO') ?? cri?.get('CIDADE ESTABELECIMENTO') ?? null;

  return {
    nome, sbb, rp,
    sexo: sexoTxt.startsWith('MACHO') ? 'M' : sexoTxt.startsWith('FEMEA') ? 'F' : null,
    castrado: castra ? castra === 'SIM' : null,
    pelagem: pelagemLote(g?.get('PELAGEM') ?? null),
    nascimento: dataIso(g?.get('NASCIMENTO') ?? cab.map(l => l.match(/NASC\.?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]).find(Boolean) ?? null),
    altura: g?.get('ALTURA (M)') ?? null, torax: g?.get('TORAX (M)') ?? null, canela: g?.get('CANELA (M)') ?? null,
    pai: parente(pai, 'PAI'), mae: parente(mae, 'MAE'),
    criador: cri?.get('NOME DO CRIADOR') ?? null, cidadeCriador: cidade,
    proprietario: pro?.get('NOME DO PROPRIETARIO') ?? null,
  };
}

/** "BT DELANTERO X ZARA DE SÃO PEDRO" — o formato da Filiação nos lotes. */
export function filiacaoDaFicha(f: FichaAbccc): string | null {
  if (!f.pai.nome && !f.mae.nome) return null;
  return `${(f.pai.nome || '?').toUpperCase()} X ${(f.mae.nome || '?').toUpperCase()}`;
}

/** Medidas e criador numa linha para a observação do lote. */
export function observacaoDaFicha(f: FichaAbccc): string | null {
  const m = (v: string | null) => v ? `${v.replace('.', ',')} m` : null;
  const partes = [
    f.altura && `Altura ${m(f.altura)}`, f.torax && `Tórax ${m(f.torax)}`, f.canela && `Canela ${m(f.canela)}`,
    f.castrado && 'Castrado',
    f.criador && `Criador: ${f.criador}${f.cidadeCriador ? ` (${f.cidadeCriador})` : ''}`,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

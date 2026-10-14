import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Input, Table, Alert, Typography, Space, Button, message } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { lerFichaAbccc, filiacaoDaFicha, observacaoDaFicha, FichaAbccc } from '../utils/fichaAbccc';
import { lerFichaHerdbook, observacaoHerdbook, FichaHerdbook } from '../utils/fichaHerdbook';
import { lerFichaArco, observacaoArco, FichaArco } from '../utils/fichaArco';

const { Text } = Typography;

/** Associação de registro genealógico da raça do lote. */
export type Associacao = 'ABCCC' | 'HERDBOOK' | 'ARCO';

export const ASSOCIACOES: Record<Associacao, {
  nome: string; url: string; rotuloSbb: string; rotuloRp: string;
  ler: (t: string) => FichaAbccc | null; observacao: (f: any) => string | null;
}> = {
  ABCCC: {
    nome: 'ABCCC', url: 'https://www.cavalocrioulo.org.br/pesquisas/', rotuloSbb: 'SBB', rotuloRp: 'RP',
    ler: lerFichaAbccc, observacao: observacaoDaFicha,
  },
  HERDBOOK: {
    nome: 'Herd Book', url: 'https://sistema.herdbook.org.br/publico/consulta-animal/', rotuloSbb: 'Registro', rotuloRp: 'Tatuagem',
    ler: lerFichaHerdbook, observacao: (f: FichaHerdbook) => observacaoHerdbook(f),
  },
  ARCO: {
    nome: 'ARCO', url: 'https://sistema.arcoovinos.com.br/genealogia/criador/consulta_rebanho.aspx', rotuloSbb: 'Registro', rotuloRp: 'Tatuagem',
    ler: lerFichaArco, observacao: (f: FichaArco) => observacaoArco(f),
  },
};

/** Abre a pesquisa da associação numa aba nova, com o registro já copiado para colar na busca. */
export async function abrirPesquisaRegistro(associacao: Associacao, codigo?: string | null) {
  const a = ASSOCIACOES[associacao];
  const c = codigo?.trim().toUpperCase();
  if (c) {
    try { await navigator.clipboard.writeText(c); message.info(`${c} copiado — cole na busca do ${a.nome}`); } catch { /* sem permissão: só abre */ }
  }
  window.open(a.url, '_blank', 'noopener');
}

interface Campo { campo: string; rotulo: string; atual: string; novo: string; valor: any; }

const txt = (v: any) => v == null || v === '' ? '' : dayjs.isDayjs(v) ? v.format('DD/MM/YYYY') : String(v).trim();
const CATEGORIA: Record<string, string> = { M: 'Macho', F: 'Fêmea', N: 'Neutro' };

/**
 * Colar a ficha do animal copiada do site da associação (ABCCC para crioulo, Herd Book para
 * bovinos, ARCO para ovinos) e escolher o que vai para o lote. Só preenche o formulário — o usuário confere e
 * salva o lote normalmente.
 */
export default function FichaRegistroModal({ open, associacao, valoresAtuais, onAplicar, onFechar }: {
  open: boolean; associacao: Associacao; valoresAtuais: Record<string, any>;
  onAplicar: (valores: Record<string, any>) => void; onFechar: () => void;
}) {
  const a = ASSOCIACOES[associacao];
  const [texto, setTexto] = useState('');
  const [marcados, setMarcados] = useState<string[]>([]);

  useEffect(() => { if (open) { setTexto(''); setMarcados([]); } }, [open]);

  const ficha = useMemo(() => a.ler(texto), [texto, a]);
  // ficha colada da outra associação (ex.: ABCCC num lote de bovino)
  const outra = useMemo(() => {
    if (ficha || !texto.trim()) return null;
    return (Object.keys(ASSOCIACOES) as Associacao[]).find(k => k !== associacao && ASSOCIACOES[k].ler(texto)) || null;
  }, [ficha, texto, associacao]);

  const campos: Campo[] = useMemo(() => {
    if (!ficha) return [];
    const obsFicha = a.observacao(ficha);
    const obsAtual = txt(valoresAtuais.obslot);
    const filiacao = filiacaoDaFicha(ficha);
    const lista: (Campo | null)[] = [
      ficha.nome ? { campo: 'deslot', rotulo: 'Descrição', atual: txt(valoresAtuais.deslot), novo: ficha.nome, valor: ficha.nome } : null,
      ficha.sbb ? { campo: 'sbbxxx', rotulo: a.rotuloSbb, atual: txt(valoresAtuais.sbbxxx), novo: ficha.sbb, valor: ficha.sbb } : null,
      ficha.rp ? { campo: 'rpxxx', rotulo: a.rotuloRp, atual: txt(valoresAtuais.rpxxx), novo: ficha.rp, valor: ficha.rp } : null,
      ficha.sexo ? { campo: 'catego', rotulo: 'Categoria', atual: CATEGORIA[valoresAtuais.catego] || txt(valoresAtuais.catego), novo: CATEGORIA[ficha.sexo], valor: ficha.sexo } : null,
      ficha.nascimento ? { campo: 'datnas', rotulo: 'Data Nasc.', atual: txt(valoresAtuais.datnas), novo: dayjs(ficha.nascimento).format('DD/MM/YYYY'), valor: dayjs(ficha.nascimento) } : null,
      ficha.pelagem ? { campo: 'pelage', rotulo: 'Pelagem', atual: txt(valoresAtuais.pelage), novo: ficha.pelagem, valor: ficha.pelagem } : null,
      filiacao ? { campo: 'filiacao', rotulo: 'Filiação', atual: txt(valoresAtuais.filiacao), novo: filiacao, valor: filiacao } : null,
      // a observação é acrescentada no fim, nunca substitui o que já foi escrito
      obsFicha && !obsAtual.includes(obsFicha) ? { campo: 'obslot', rotulo: 'Observação (acrescentar)', atual: obsAtual, novo: obsFicha,
        valor: obsAtual ? `${obsAtual}\n${obsFicha}` : obsFicha } : null,
    ];
    return lista.filter((c): c is Campo => !!c && c.novo !== c.atual);
  }, [ficha, valoresAtuais, a]);

  // marca de saída o que está vazio no lote (e o sexo, que é o do registro); o resto o usuário decide
  useEffect(() => {
    setMarcados(campos.filter(c => !c.atual || c.campo === 'catego').map(c => c.campo));
  }, [campos]);

  const sbbDiferente = !!(ficha?.sbb && valoresAtuais.sbbxxx && txt(valoresAtuais.sbbxxx).toUpperCase() !== ficha.sbb.toUpperCase());

  const aplicar = () => {
    const valores: Record<string, any> = {};
    for (const c of campos) if (marcados.includes(c.campo)) valores[c.campo] = c.valor;
    onAplicar(valores);
  };

  const codigoBusca = valoresAtuais.sbbxxx || valoresAtuais.rpxxx;

  return (
    <Modal open={open} onCancel={onFechar} width={820} title={`Importar ficha do ${a.nome}`}
      okText="Preencher o lote" okButtonProps={{ disabled: !marcados.length }} onOk={aplicar} cancelText="Cancelar">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">
          No site do {a.nome}, abra a ficha do animal, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole abaixo.
          {' '}<Button type="link" size="small" icon={<ExportOutlined />} style={{ padding: 0 }}
            onClick={() => abrirPesquisaRegistro(associacao, codigoBusca)}>Abrir a pesquisa</Button>
        </Text>
        <Input.TextArea rows={5} value={texto} onChange={e => setTexto(e.target.value)} autoFocus
          placeholder={`Cole aqui a ficha do animal copiada do site do ${a.nome}`} />

        {texto.trim() && !ficha && (outra ? (
          <Alert type="warning" showIcon message={`Esta ficha é do ${ASSOCIACOES[outra].nome}, mas a raça do lote é de outra associação`}
            description="Confira a raça escolhida no lote." />
        ) : (
          <Alert type="warning" showIcon message={`Não reconheci uma ficha do ${a.nome} neste texto`}
            description="Copie a página inteira da ficha do animal, não a lista de resultados da busca." />
        ))}
        {ficha && sbbDiferente && (
          <Alert type="error" showIcon message={`A ficha é do ${a.rotuloSbb} ${ficha.sbb}, mas o lote está com ${txt(valoresAtuais.sbbxxx)}`}
            description="Confira se copiou a ficha do animal certo antes de preencher." />
        )}
        {ficha && (campos.length ? (
          <Table rowKey="campo" size="small" pagination={false} dataSource={campos}
            rowSelection={{ selectedRowKeys: marcados, onChange: ks => setMarcados(ks as string[]) }}
            columns={[
              { title: 'Campo', dataIndex: 'rotulo', width: 170 },
              { title: 'No lote hoje', dataIndex: 'atual', render: (v: string) => v ? <Text type="secondary">{v}</Text> : <Text type="secondary" italic>vazio</Text> },
              { title: 'Da ficha', dataIndex: 'novo', render: (v: string) => <Text strong>{v}</Text> },
            ]} />
        ) : <Alert type="success" showIcon message="O lote já está igual à ficha" />)}
        {ficha && (ficha.pai.nome || ficha.mae.nome || ficha.proprietario) && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(ficha.pai.nome || ficha.mae.nome) && <>Pai: {ficha.pai.nome || '—'}{ficha.pai.sbb ? ` (${ficha.pai.sbb})` : ''} · Mãe: {ficha.mae.nome || '—'}{ficha.mae.sbb ? ` (${ficha.mae.sbb})` : ''}</>}
            {ficha.proprietario ? ` · Proprietário no ${a.nome}: ${ficha.proprietario}` : ''}
          </Text>
        )}
      </Space>
    </Modal>
  );
}

import { useState } from 'react';
import { Button, ColorPicker, Empty, Form, Input, InputNumber, Segmented, Select, Space, Switch, Tooltip } from 'antd';
import {
  DeleteOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined,
  VerticalAlignTopOutlined, VerticalAlignMiddleOutlined, VerticalAlignBottomOutlined,
  ArrowUpOutlined, ArrowDownOutlined, EditOutlined,
} from '@ant-design/icons';
import { CampoLayout, ColunaTabela, FONTES_BASE } from '../../relatorios/tipoLayout';
import { CampoDisponivel } from '../../relatorios/promissoriaCampos';

interface Props {
  campo: CampoLayout | null;
  camposDisponiveis: CampoDisponivel[];
  onChange: (patch: Partial<CampoLayout>) => void;
  onRemover: () => void;
  onEnviarParaTras: () => void;
  onTrazerParaFrente: () => void;
  onEditarCartao?: () => void;
}

export default function PainelPropriedades({
  campo, camposDisponiveis, onChange, onRemover, onEnviarParaTras, onTrazerParaFrente, onEditarCartao,
}: Props) {
  const [campoParaInserir, setCampoParaInserir] = useState<string | undefined>();

  if (!campo) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Selecione um campo no canvas" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const grupos = Array.from(new Set(camposDisponiveis.map(c => c.grupo)));

  const label = campo.tipo === 'campo'
    ? camposDisponiveis.find(c => c.key === campo.key)?.label
    : campo.tipo === 'texto_livre' ? 'Texto livre'
    : campo.tipo === 'bloco:parcelas' ? 'Tabela de parcelas'
    : campo.tipo === 'bloco:tabela-lotes' ? 'Tabela de lotes'
    : campo.tipo === 'bloco:compradores' ? 'Bloco de compradores'
    : campo.tipo === 'bloco:tabela-propriedades' ? 'Tabela de propriedades'
    : campo.tipo === 'bloco:tabela-lotes-fatura' ? 'Tabela de lotes'
    : campo.tipo === 'logo' ? 'Logotipo'
    : 'Retângulo';

  const ehTexto = campo.tipo === 'campo' || campo.tipo === 'texto_livre';
  const ehBloco = campo.tipo === 'bloco:parcelas' || campo.tipo === 'bloco:tabela-lotes'
    || campo.tipo === 'bloco:compradores' || campo.tipo === 'bloco:tabela-propriedades'
    || campo.tipo === 'bloco:tabela-lotes-fatura';
  const ehVisual = !ehBloco; // blocos não aceitam opacidade/rotação (conteúdo dinâmico complexo)

  const moverColuna = (idx: number, delta: number) => {
    const colunas = [...(campo.colunas || [])];
    const alvo = idx + delta;
    if (alvo < 0 || alvo >= colunas.length) return;
    [colunas[idx], colunas[alvo]] = [colunas[alvo], colunas[idx]];
    onChange({ colunas });
  };

  const atualizarColuna = (idx: number, patch: Partial<ColunaTabela>) => {
    const colunas = [...(campo.colunas || [])];
    colunas[idx] = { ...colunas[idx], ...patch };
    onChange({ colunas });
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <Space size={4}>
          <Tooltip title="Enviar para trás">
            <Button size="small" icon={<ArrowDownOutlined />} onClick={onEnviarParaTras} />
          </Tooltip>
          <Tooltip title="Trazer para frente">
            <Button size="small" icon={<ArrowUpOutlined />} onClick={onTrazerParaFrente} />
          </Tooltip>
        </Space>
      </div>

      {campo.tipo === 'texto_livre' && (
        <>
          <Form.Item label="Texto" style={{ marginBottom: 4 }}>
            <Input.TextArea
              rows={4}
              value={campo.textoFixo}
              onChange={e => onChange({ textoFixo: e.target.value })}
              placeholder="Ex.: Comprador: {{comp.nomexx}}"
            />
          </Form.Item>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            Use <code>{'{{grupo.campo}}'}</code> para inserir dados dinâmicos no texto.
          </div>
          <Form.Item label="Inserir campo no texto" style={{ marginBottom: 12 }}>
            <Select
              placeholder="Escolher campo…"
              value={campoParaInserir}
              showSearch
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={grupos.map(g => ({
                label: g,
                options: camposDisponiveis.filter(c => c.grupo === g).map(c => ({ value: c.key, label: c.label })),
              }))}
              onChange={key => {
                onChange({ textoFixo: `${campo.textoFixo || ''}{{${key}}}` });
                setCampoParaInserir(undefined);
              }}
            />
          </Form.Item>
        </>
      )}

      {campo.tipo === 'logo' && (
        <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
          Usa o logotipo cadastrado nas configurações da empresa.
        </div>
      )}

      {(campo.tipo === 'bloco:tabela-lotes' || campo.tipo === 'bloco:tabela-propriedades' || campo.tipo === 'bloco:tabela-lotes-fatura') && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            Marque as colunas visíveis e use as setas para reordenar.
          </div>
          {(campo.colunas || []).map((col, idx) => (
            <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Switch size="small" checked={col.visivel} onChange={visivel => atualizarColuna(idx, { visivel })} />
              <span style={{ flex: 1, fontSize: 12 }}>{col.label}</span>
              <InputNumber
                size="small"
                min={5}
                max={100}
                value={col.largura}
                onChange={largura => atualizarColuna(idx, { largura: largura ?? col.largura })}
                style={{ width: 60 }}
              />
              <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moverColuna(idx, -1)} disabled={idx === 0} />
              <Button size="small" icon={<ArrowDownOutlined />} onClick={() => moverColuna(idx, 1)} disabled={idx === (campo.colunas || []).length - 1} />
            </div>
          ))}
        </>
      )}

      {campo.tipo === 'bloco:compradores' && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            Um cartão é gerado para cada comprador da venda, empilhados automaticamente.
          </div>
          <Form.Item label="Altura do cartão (mm)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={10} max={150}
              value={campo.alturaCartao ?? 30}
              onChange={v => onChange({ alturaCartao: v ?? 30 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Espaço entre cartões (mm)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={0} max={30}
              value={campo.espacamentoCartao ?? 4}
              onChange={v => onChange({ espacamentoCartao: v ?? 4 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Button type="primary" icon={<EditOutlined />} onClick={onEditarCartao} block style={{ marginBottom: 12 }}>
            Editar cartão
          </Button>
        </>
      )}

      {ehTexto && (
        <>
          <Form.Item label="Fonte" style={{ marginBottom: 8 }}>
            <Select
              value={campo.fontFamily}
              onChange={fontFamily => onChange({ fontFamily })}
              options={FONTES_BASE}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Estilo" style={{ marginBottom: 12 }}>
            <Space.Compact>
              <Button
                icon={<BoldOutlined />}
                type={campo.bold ? 'primary' : 'default'}
                onClick={() => onChange({ bold: !campo.bold })}
              />
              <Button
                icon={<ItalicOutlined />}
                type={campo.italic ? 'primary' : 'default'}
                onClick={() => onChange({ italic: !campo.italic })}
              />
              <Button
                icon={<UnderlineOutlined />}
                type={campo.underline ? 'primary' : 'default'}
                onClick={() => onChange({ underline: !campo.underline })}
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item label="Tamanho (pt)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={4}
              max={72}
              value={campo.fontSize}
              onChange={fontSize => onChange({ fontSize: fontSize ?? campo.fontSize })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Cor do texto" style={{ marginBottom: 12 }}>
            <ColorPicker
              value={campo.color}
              onChange={c => onChange({ color: c.toHexString() })}
              showText
            />
          </Form.Item>
          <Form.Item label="Alinhamento horizontal" style={{ marginBottom: 12 }}>
            <Segmented
              value={campo.align}
              onChange={align => onChange({ align: align as CampoLayout['align'] })}
              options={[
                { label: 'Esquerda', value: 'left' },
                { label: 'Centro', value: 'center' },
                { label: 'Direita', value: 'right' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Alinhamento vertical" style={{ marginBottom: 12 }}>
            <Segmented
              value={campo.verticalAlign || 'top'}
              onChange={verticalAlign => onChange({ verticalAlign: verticalAlign as CampoLayout['verticalAlign'] })}
              options={[
                { label: <VerticalAlignTopOutlined />, value: 'top' },
                { label: <VerticalAlignMiddleOutlined />, value: 'middle' },
                { label: <VerticalAlignBottomOutlined />, value: 'bottom' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Fundo do texto" style={{ marginBottom: 12 }}>
            <Space>
              <Switch
                checked={!!campo.backgroundColor}
                onChange={ativo => onChange({ backgroundColor: ativo ? (campo.backgroundColor || '#000000') : undefined })}
              />
              {campo.backgroundColor && (
                <ColorPicker
                  value={campo.backgroundColor}
                  onChange={c => onChange({ backgroundColor: c.toHexString() })}
                  showText
                />
              )}
            </Space>
          </Form.Item>
        </>
      )}

      {campo.tipo === 'retangulo' && (
        <>
          <Form.Item label="Preenchimento" style={{ marginBottom: 12 }}>
            <Space>
              <Switch
                checked={!!campo.backgroundColor}
                onChange={ativo => onChange({ backgroundColor: ativo ? (campo.backgroundColor || '#ffffff') : undefined })}
              />
              {campo.backgroundColor && (
                <ColorPicker
                  value={campo.backgroundColor}
                  onChange={c => onChange({ backgroundColor: c.toHexString() })}
                  showText
                />
              )}
            </Space>
          </Form.Item>
          <Form.Item label="Cor da borda" style={{ marginBottom: 12 }}>
            <ColorPicker
              value={campo.borderColor || '#000000'}
              onChange={c => onChange({ borderColor: c.toHexString() })}
              showText
            />
          </Form.Item>
          <Form.Item label="Espessura da borda (pt)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={0}
              max={20}
              value={campo.borderWidth ?? 1}
              onChange={borderWidth => onChange({ borderWidth: borderWidth ?? 0 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Raio da borda (pt)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={0}
              max={40}
              value={campo.borderRadius ?? 0}
              onChange={borderRadius => onChange({ borderRadius: borderRadius ?? 0 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}

      {ehVisual && (
        <>
          <Form.Item label="Opacidade (%)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={0}
              max={100}
              value={Math.round((campo.opacity ?? 1) * 100)}
              onChange={v => onChange({ opacity: (v ?? 100) / 100 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Rotação (graus)" style={{ marginBottom: 12 }}>
            <InputNumber
              min={-180}
              max={180}
              value={campo.rotacao ?? 0}
              onChange={v => onChange({ rotacao: v ?? 0 })}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}

      <Form.Item label="Posição (mm)" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <InputNumber addonBefore="X" value={Math.round(campo.x)} onChange={x => onChange({ x: x ?? campo.x })} />
          <InputNumber addonBefore="Y" value={Math.round(campo.y)} onChange={y => onChange({ y: y ?? campo.y })} />
        </div>
      </Form.Item>
      <Form.Item label="Tamanho (mm)" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <InputNumber addonBefore="L" value={Math.round(campo.largura)} onChange={largura => onChange({ largura: largura ?? campo.largura })} />
          <InputNumber addonBefore="A" value={Math.round(campo.altura)} onChange={altura => onChange({ altura: altura ?? campo.altura })} />
        </div>
      </Form.Item>

      <Button danger icon={<DeleteOutlined />} onClick={onRemover} block>
        Remover campo
      </Button>
    </div>
  );
}

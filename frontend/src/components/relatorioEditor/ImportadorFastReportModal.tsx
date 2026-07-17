import { useState } from 'react';
import { Modal, Input, Button, Upload, Alert, List, Space, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { importarFastReport, AvisoImportacao } from '../../relatorios/importadorFastReport';
import { CampoDisponivel } from '../../relatorios/promissoriaCampos';
import { CampoLayout } from '../../relatorios/tipoLayout';

const { Dragger } = Upload;
const { Text } = Typography;

interface Props {
  open: boolean;
  camposDisponiveis: CampoDisponivel[];
  larguraMM: number;
  alturaMM: number;
  suportaBlocoParcelas?: boolean;
  suportaTabelaPropriedades?: boolean;
  mapaCampos?: Record<string, string>;
  mapaColunasTabela?: Record<string, string>;
  onClose: () => void;
  onImportar: (layout: CampoLayout[]) => void;
}

export default function ImportadorFastReportModal({
  open, camposDisponiveis, larguraMM, alturaMM, suportaBlocoParcelas,
  suportaTabelaPropriedades, mapaCampos, mapaColunasTabela, onClose, onImportar,
}: Props) {
  const [xml, setXml] = useState('');
  const [avisos, setAvisos] = useState<AvisoImportacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lerArquivo: UploadProps['beforeUpload'] = file => {
    const reader = new FileReader();
    reader.onload = () => setXml(String(reader.result || ''));
    reader.readAsText(file, 'utf-8');
    return false;
  };

  const fechar = () => {
    setXml('');
    setAvisos(null);
    setErro(null);
    onClose();
  };

  const importar = () => {
    setErro(null);
    if (!xml.trim()) { setErro('Cole o conteúdo do arquivo .fr3 ou selecione um arquivo.'); return; }
    try {
      const resultado = importarFastReport(xml, camposDisponiveis, {
        larguraEsperadaMM: larguraMM, alturaEsperadaMM: alturaMM, suportaBlocoParcelas,
        suportaTabelaPropriedades, mapaCampos, mapaColunasTabela,
      });
      onImportar(resultado.layout);
      setAvisos(resultado.avisos);
      if (resultado.avisos.length === 0) fechar();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível interpretar este arquivo.');
    }
  };

  return (
    <Modal title="Importar relatório FastReport (.fr3)" open={open} onCancel={fechar} footer={null} width={640}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Text type="secondary">
          Importa um relatório exportado do editor Delphi (.fr3) como ponto de partida. Campos reconhecidos são
          vinculados automaticamente; os demais entram como texto de espaço reservado (ex. "[NOMCOM]") para você
          ajustar manualmente na paleta.
        </Text>
        <Dragger accept=".fr3,.xml" multiple={false} showUploadList={false} beforeUpload={lerArquivo}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Clique ou arraste o arquivo .fr3 aqui</p>
        </Dragger>
        <Input.TextArea
          value={xml}
          onChange={e => setXml(e.target.value)}
          placeholder="…ou cole aqui o conteúdo XML do .fr3"
          rows={8}
        />
        {erro && <Alert type="error" showIcon message={erro} />}
        {avisos && avisos.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`Layout importado com ${avisos.length} observação${avisos.length !== 1 ? 'ões' : ''}`}
            description={
              <List
                size="small"
                dataSource={avisos}
                renderItem={a => <List.Item style={{ padding: '4px 0', border: 'none' }}>{a.mensagem}</List.Item>}
              />
            }
          />
        )}
        <Space style={{ justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
          <Button onClick={fechar}>Fechar</Button>
          <Button type="primary" onClick={importar}>Importar</Button>
        </Space>
      </Space>
    </Modal>
  );
}

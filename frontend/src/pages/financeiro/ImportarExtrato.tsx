import React, { useEffect, useState } from 'react';
import { Upload, Typography, message, Result, Descriptions, Button, Table, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { fmtDataUTC } from '../../utils/data';
import { ModalConta, nomeBanco, ContaForm } from './ContasBancarias';
import { fmtValor } from './Lancamentos';

const { Title, Text } = Typography;

interface Resumo {
  idImportacao: number; descricaoConta: string | null; dtInicio: string | null; dtFim: string | null;
  saldoFinal: number | null; total: number; novos: number; jaImportados: number;
  comDocumento: number; clientesIdentificados: number;
}

export default function ImportarExtrato() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [contaNova, setContaNova] = useState<Partial<ContaForm> | null>(null);
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  const carregarHistorico = () => api.get('/conciliacao/importacoes').then(r => setHistorico(r.data)).catch(() => {});
  useEffect(() => { carregarHistorico(); }, []);

  const enviar = async (arquivo: File) => {
    // o resultado anterior só sai quando a nova importação dá certo — um reenvio recusado não apaga o que já foi mostrado
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', arquivo);
      const r = await api.post('/conciliacao/importar', fd);
      setResumo(r.data);
      carregarHistorico();
    } catch (e: any) {
      const status = e.response?.status;
      const dados = e.response?.data?.dados;
      if (status === 422 && dados?.acctid) {
        // extrato de conta ainda não cadastrada: abre o cadastro já preenchido e reenvia depois
        setArquivoPendente(arquivo);
        setContaNova({ banco: dados.banco || '', acctid: dados.acctid, descricao: `${nomeBanco(dados.banco)} — ${dados.acctid}` });
        message.info('A conta deste extrato ainda não está cadastrada. Confira os dados e salve.');
      } else {
        message.error(e.response?.data?.error || 'Erro ao importar o extrato');
      }
    } finally { setEnviando(false); }
  };

  return (
    <>
      <Title level={4}>Importar extrato</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Baixe o extrato no internet banking no formato OFX e envie aqui. Lançamentos que já foram
        importados antes são ignorados, então pode enviar períodos que se sobrepõem.
      </Text>

      <Upload.Dragger accept=".ofx,.OFX" multiple={false} showUploadList={false} disabled={enviando}
        beforeUpload={file => { enviar(file); return false; }}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">{enviando ? 'Importando...' : 'Clique ou arraste o arquivo OFX aqui'}</p>
        <p className="ant-upload-hint">Um arquivo por vez, de uma conta cadastrada</p>
      </Upload.Dragger>

      {resumo && (
        <Result status="success" style={{ paddingBottom: 0 }}
          title={`${resumo.novos} lançamento${resumo.novos !== 1 ? 's' : ''} novo${resumo.novos !== 1 ? 's' : ''} importado${resumo.novos !== 1 ? 's' : ''}`}
          subTitle={resumo.descricaoConta || undefined}
          extra={<Button type="primary" onClick={() => navigate(`/${banco}/financeiro/lancamentos`)}>Ver lançamentos</Button>}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Período">{fmtDataUTC(resumo.dtInicio)} a {fmtDataUTC(resumo.dtFim)}</Descriptions.Item>
            <Descriptions.Item label="Saldo final">{resumo.saldoFinal != null ? fmtValor(resumo.saldoFinal) : '—'}</Descriptions.Item>
            <Descriptions.Item label="No arquivo">{resumo.total}</Descriptions.Item>
            <Descriptions.Item label="Já importados antes">{resumo.jaImportados}</Descriptions.Item>
            <Descriptions.Item label="Com CPF/CNPJ">{resumo.comDocumento} de {resumo.novos}</Descriptions.Item>
            <Descriptions.Item label="Cliente identificado">{resumo.clientesIdentificados} de {resumo.novos}</Descriptions.Item>
          </Descriptions>
        </Result>
      )}

      {historico.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 28 }}>Importações anteriores</Title>
          <Table rowKey="id" size="small" dataSource={historico} pagination={{ pageSize: 10 }}
            columns={[
              { title: 'Data', dataIndex: 'data', render: (v: string) => new Date(v).toLocaleString('pt-BR') },
              { title: 'Conta', dataIndex: 'descricaoConta' },
              { title: 'Período', render: (_: any, r: any) => `${fmtDataUTC(r.dtInicio)} a ${fmtDataUTC(r.dtFim)}` },
              { title: 'Arquivo', dataIndex: 'arquivo', ellipsis: true },
              { title: 'Novos', dataIndex: 'qtdNovos', align: 'right' as const,
                render: (v: number, r: any) => <Space size={4}>{v}<Text type="secondary">de {r.qtdLancamentos}</Text></Space> },
              { title: 'Por', dataIndex: 'nomeUsuario' },
            ]} />
        </>
      )}

      <ModalConta aberto={!!contaNova} inicial={contaNova} onFechar={() => { setContaNova(null); setArquivoPendente(null); }}
        onSalvo={() => {
          setContaNova(null);
          if (arquivoPendente) { const f = arquivoPendente; setArquivoPendente(null); enviar(f); }
        }} />
    </>
  );
}

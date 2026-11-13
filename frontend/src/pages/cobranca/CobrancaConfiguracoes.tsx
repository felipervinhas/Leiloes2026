import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Typography, Space, Button, InputNumber, Input, Table, Modal, Form, Switch, Radio, Popconfirm, Tag, Alert, Descriptions, Spin, Collapse, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, CopyOutlined, WhatsAppOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { useConfig } from '../../context/ConfigContext';
import { Cabecalho, DESTINOS, nomeDestino, SeletorCliente } from './comum';

const { Text, Paragraph } = Typography;

export default function CobrancaConfiguracoes() {
  const status = useOutletContext<{ taxaPadrao: number }>();
  const [taxa, setTaxa] = useState<number | null>(status.taxaPadrao);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [editar, setEditar] = useState<any | null>(null);
  const [painel, setPainel] = useState<any | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setVendedores((await api.get('/cobranca/vendedores')).data); }
    catch { message.error('Erro ao carregar os vendedores'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarTaxa = async () => {
    try { await api.put('/cobranca/config/taxa', { taxa }); status.taxaPadrao = Number(taxa); message.success('Taxa padrão salva'); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
  };
  const excluir = async (id: number) => {
    try { await api.delete(`/cobranca/vendedores/${id}`); carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro'); }
  };

  return (
    <>
      <Cabecalho titulo="Configurações" sub="Taxa do serviço, regras por vendedor e o link do painel do cliente." />
      <div className="cb-card">
        <h3 className="cb-card-titulo">Taxa padrão da empresa</h3>
        <Space>
          <InputNumber min={0} max={100} precision={2} decimalSeparator="," suffix="%" value={taxa} onChange={v => setTaxa(v)} style={{ width: 140 }} />
          <Button type="primary" onClick={salvarTaxa} disabled={taxa == null}>Salvar</Button>
        </Space>
        <div><Text type="secondary">Vale para os lotes sem taxa própria e de vendedores sem taxa própria. Taxa de cada parcela recebida.</Text></div>
      </div>
      <div className="cb-card">
        <h3 className="cb-card-titulo">Vendedores <Button icon={<PlusOutlined />} onClick={() => setEditar({})}>Adicionar vendedor</Button></h3>
        <Text type="secondary">Taxa e destino próprios do vendedor, se os lotes novos dele já entram na cobrança, e o link do painel do cliente.</Text>
        <Table size="small" rowKey="idCliente" loading={carregando} dataSource={vendedores} pagination={false} style={{ marginTop: 8 }}
          locale={{ emptyText: 'Nenhum vendedor configurado — os lotes usam a taxa padrão' }}
          columns={[
            { title: 'Vendedor', dataIndex: 'nome' },
            { title: 'Lotes novos já entram', dataIndex: 'padrao', width: 160, render: (v: boolean) => (v ? <Tag color="green">Sim</Tag> : <Tag>Não</Tag>) },
            { title: 'Dinheiro vai para', dataIndex: 'destino', width: 160, render: nomeDestino },
            { title: 'Taxa', dataIndex: 'taxa', width: 110, render: (v: number | null) => (v != null ? `${v}%` : <Text type="secondary">padrão ({status.taxaPadrao}%)</Text>) },
            { title: 'Lotes em cobrança', dataIndex: 'lotes', width: 130, align: 'right' as const },
            { title: 'Painel do cliente', width: 190, render: (_: any, v: any) => (
              <Button size="small" icon={<LinkOutlined />} type={v.portal ? 'default' : 'dashed'} onClick={() => setPainel(v)}>
                {v.portal ? 'Liberado · link' : 'Enviar link'}
              </Button>
            ) },
            { title: '', width: 80, render: (_: any, v: any) => (
              <Space size={2}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditar(v)} />
                <Popconfirm title="Remover a configuração deste vendedor?" description="Os lotes já marcados continuam na cobrança. O acesso ao painel do cliente é bloqueado." onConfirm={() => excluir(v.idCliente)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ) },
          ]} />
      </div>
      {editar && <ModalVendedor v={editar} taxaPadrao={status.taxaPadrao} onClose={ok => { setEditar(null); if (ok) carregar(); }} />}
      {painel && <ModalPainel idCliente={painel.idCliente} onClose={() => { setPainel(null); carregar(); }} />}
    </>
  );
}

function ModalVendedor({ v, taxaPadrao, onClose }: { v: any; taxaPadrao: number; onClose: (ok: boolean) => void }) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [cliente, setCliente] = useState<{ id?: number; nome?: string }>({ id: v.idCliente, nome: v.nome });
  const salvar = async () => {
    const x = await form.validateFields();
    if (!cliente.id) return message.warning('Escolha o vendedor');
    setSalvando(true);
    try {
      await api.put(`/cobranca/vendedores/${cliente.id}`, { padrao: x.padrao, destino: x.destino, taxa: x.taxaPropria ? x.taxa : null });
      onClose(true);
    } catch (e: any) { message.error(e.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };
  return (
    <Modal open title={v.idCliente ? `Vendedor — ${v.nome}` : 'Adicionar vendedor'} onCancel={() => onClose(false)} onOk={salvar} confirmLoading={salvando} destroyOnHidden>
      {!v.idCliente && <div style={{ marginBottom: 12 }}><SeletorCliente placeholder="Vendedor" value={cliente.id} rotulo={cliente.nome} style={{ width: '100%' }}
        onChange={(id, nome) => setCliente({ id, nome })} /></div>}
      <Form form={form} layout="vertical" preserve={false} initialValues={{
        padrao: v.padrao ?? true, destino: v.destino || 'VENDEDOR', taxaPropria: v.taxa != null, taxa: v.taxa ?? taxaPadrao,
      }}>
        <Form.Item name="padrao" label="Lotes novos deste vendedor já entram na cobrança" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="destino" label="Para onde vai o dinheiro (padrão dos lotes dele)"><Radio.Group options={DESTINOS} /></Form.Item>
        <Form.Item name="taxaPropria" label="Taxa própria" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.taxaPropria !== b.taxaPropria}>
          {({ getFieldValue }) => getFieldValue('taxaPropria') && (
            <Form.Item name="taxa" label="Taxa (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} precision={2} decimalSeparator="," suffix="%" style={{ width: 140 }} />
            </Form.Item>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** Celular do cadastro → número para o wa.me (55 + DDD + número). */
const numeroWhatsapp = (cel?: string | null) => {
  const d = String(cel || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
};

/**
 * Acesso do cliente ao painel: link exclusivo (o jeito principal — o cliente só confirma os 4
 * primeiros dígitos do CPF/CNPJ) e, opcional, a senha do app/site. O link só é mostrado logo
 * depois de gerado: o banco guarda o hash. Gerar outro invalida o anterior.
 */
function ModalPainel({ idCliente, onClose }: { idCliente: number; onClose: () => void }) {
  const { banco } = useBanco();
  const config = useConfig();
  const [st, setSt] = useState<any>(null);
  const [link, setLink] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [senha, setSenha] = useState('');

  const carregar = useCallback(async () => {
    try { setSt((await api.get(`/cobranca/vendedores/${idCliente}/acesso`)).data); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro ao carregar'); }
  }, [idCliente]);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (fn: () => Promise<any>, ok?: string) => {
    setOcupado(true);
    try { await fn(); if (ok) message.success(ok); await carregar(); }
    catch (e: any) { message.error(e.response?.data?.error || 'Erro'); }
    finally { setOcupado(false); }
  };
  const gerar = () => acao(async () => {
    const r = await api.post(`/cobranca/vendedores/${idCliente}/link`);
    setLink(`${window.location.origin}/${banco}/cliente/acesso/${r.data.token}`);
  });
  const revogar = () => acao(async () => { await api.delete(`/cobranca/vendedores/${idCliente}/link`); setLink(null); }, 'Link revogado');
  const bloquear = () => acao(async () => {
    await api.delete(`/cobranca/vendedores/${idCliente}/link`);
    await api.put(`/cobranca/vendedores/${idCliente}/acesso`, { liberado: false });
    setLink(null);
  }, 'Acesso ao painel bloqueado');
  const salvarSenha = () => acao(async () => {
    await api.put(`/cobranca/vendedores/${idCliente}/acesso`, { liberado: true, senha });
    setSenha('');
  }, 'Senha salva e painel liberado');

  const zap = numeroWhatsapp(st?.celular);
  const mensagem = link && st ? `Olá! A ${config.empresa || 'leiloeira'} agora faz a cobrança das parcelas dos seus animais. `
    + `Acompanhe tudo por este link, que é só seu: ${link}\n\nNo primeiro acesso, confirme os 4 primeiros dígitos do seu CPF/CNPJ.` : '';
  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensagem); message.success('Mensagem com o link copiada'); }
    catch { message.info('Selecione e copie o link abaixo'); }
  };

  return (
    <Modal open width={620} title={st ? `Painel do cliente — ${st.nome}` : 'Painel do cliente'} onCancel={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
      {!st ? <Spin /> : (
        <>
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Acesso">{st.liberado ? <Tag color="green">Liberado</Tag> : <Tag>Bloqueado</Tag>}</Descriptions.Item>
            <Descriptions.Item label="Link">
              {!st.link ? <Text type="secondary">nenhum link ativo</Text>
                : st.link.bloqueado ? <Tag color="red">bloqueado por tentativas erradas</Tag>
                : <>ativo desde {new Date(st.link.criado).toLocaleDateString('pt-BR')}
                    {st.link.ultimoAcesso ? <Text type="secondary"> · último acesso {new Date(st.link.ultimoAcesso).toLocaleString('pt-BR')}</Text> : <Text type="secondary"> · ainda não usado</Text>}</>}
            </Descriptions.Item>
            <Descriptions.Item label="Celular">{st.celular || <Text type="secondary">sem celular no cadastro</Text>}</Descriptions.Item>
          </Descriptions>

          {link ? (
            <Alert type="success" showIcon style={{ marginBottom: 16 }} message="Link gerado — envie agora"
              description={<>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>Por segurança, o link só aparece agora. Se perder, gere outro (o anterior deixa de funcionar).</Paragraph>
                <Input.TextArea readOnly value={link} autoSize style={{ marginBottom: 8 }} onFocus={e => e.target.select()} />
                <Space wrap>
                  {zap && <Button type="primary" icon={<WhatsAppOutlined />} href={`https://wa.me/${zap}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
                    style={{ background: '#25D366', borderColor: '#25D366' }}>Enviar no WhatsApp</Button>}
                  <Button icon={<CopyOutlined />} onClick={copiar}>Copiar mensagem</Button>
                </Space>
              </>} />
          ) : (
            <Space wrap style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<LinkOutlined />} loading={ocupado} onClick={gerar}>
                {st.link ? 'Gerar novo link' : 'Gerar link e liberar'}
              </Button>
              {st.link && <Popconfirm title="Revogar o link?" description="O cliente perde o acesso por este link (e quem já entrou por ele sai)." onConfirm={revogar}>
                <Button danger disabled={ocupado}>Revogar link</Button>
              </Popconfirm>}
              {st.liberado && <Popconfirm title="Bloquear o acesso ao painel?" description="Vale para o link e para a senha." onConfirm={bloquear}>
                <Button disabled={ocupado}>Bloquear acesso</Button>
              </Popconfirm>}
            </Space>
          )}
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            O cliente abre o link no celular e confirma os 4 primeiros dígitos do CPF/CNPJ — sem senha. O aparelho fica lembrado por 30 dias.
            {st.link && !link ? ' Gerar um novo link invalida o anterior.' : ''}
          </Paragraph>

          <Collapse size="small" ghost items={[{
            key: 'senha', label: 'Entrar com senha (opcional)',
            children: (
              <>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Alternativa ao link: CPF/CNPJ ou e-mail + senha. É a mesma senha do aplicativo e do site — trocar aqui troca lá também.
                  {st.temSenha ? ' Este cliente já tem senha.' : ' Este cliente ainda não tem senha.'}
                </Paragraph>
                <Space.Compact style={{ width: '100%' }}>
                  <Input.Password placeholder="Nova senha (mínimo 6 caracteres)" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" />
                  <Button disabled={senha.length < 6 || ocupado} onClick={salvarSenha}>Salvar senha</Button>
                </Space.Compact>
              </>
            ),
          }]} />
        </>
      )}
    </Modal>
  );
}

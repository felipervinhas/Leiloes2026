import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Empty, Input, Modal, Radio, Row, Select, Space,
  Spin, Steps, Table, Tag, Typography, message,
} from 'antd';
import { CalculatorOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import { useBuscaLeiloes } from '../../hooks/useBuscaLeiloes';
import { useBuscaClientes } from '../../hooks/useBuscaClientes';
import { CATEGORIA, erroApi, fmtReais, Fonte, Mapeamento, MapeamentoVar, TemplateResumo } from './tipos';

const { Text, Paragraph } = Typography;

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const TIPOS_PUBLICO = [
  { value: 'todos', label: 'Todos os clientes ativos' },
  { value: 'compradores', label: 'Compradores' },
  { value: 'lances', label: 'Quem deu lance' },
  { value: 'parcelas', label: 'Parcelas a vencer' },
  { value: 'selecionados', label: 'Clientes escolhidos' },
];

interface Publico {
  tipo: string;
  idsLeiloes: { value: number; label: string }[];
  desde: Dayjs | null;
  vencimento: [Dayjs, Dayjs] | null;
  clientes: { value: number; label: string }[];
  ufs: string[];
  excluirBloqueados: boolean;
}

function CampoVariavel({ nome, valor, fontes, onChange }: {
  nome: string; valor?: MapeamentoVar; fontes: Fonte[]; onChange: (v: MapeamentoVar) => void;
}) {
  return (
    <Row gutter={8} style={{ marginBottom: 8 }} align="middle">
      <Col flex="70px"><Tag color="green">{`{{${nome}}}`}</Tag></Col>
      <Col flex="260px">
        <Select style={{ width: '100%' }} placeholder="Preencher com..." value={valor?.fonte}
          options={fontes.map(f => ({ value: f.value, label: f.label }))}
          onChange={f => onChange({ fonte: f, valor: valor?.valor })} />
      </Col>
      {valor?.fonte === 'fixo' && (
        <Col flex="auto">
          <Input placeholder="Texto" value={valor.valor} onChange={e => onChange({ fonte: 'fixo', valor: e.target.value })} />
        </Col>
      )}
    </Row>
  );
}

export default function NovaCampanha({ onClose, aoCriar }: { onClose: () => void; aoCriar: (id: number) => void }) {
  const [passo, setPasso] = useState(0);
  const [templates, setTemplates] = useState<TemplateResumo[]>([]);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [carregandoTpl, setCarregandoTpl] = useState(false);

  const [nome, setNome] = useState('');
  const [tplChave, setTplChave] = useState<string | undefined>();
  const [leilao, setLeilao] = useState<{ value: number; label: string } | undefined>();
  const [mapa, setMapa] = useState<Mapeamento>({});
  const [publico, setPublico] = useState<Publico>({
    tipo: 'compradores', idsLeiloes: [], desde: null, vencimento: null, clientes: [], ufs: [], excluirBloqueados: false,
  });
  const [previa, setPrevia] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);
  const [telTeste, setTelTeste] = useState('');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [quando, setQuando] = useState<'agora' | 'agendar' | 'depois'>('agora');
  const [agendarPara, setAgendarPara] = useState<Dayjs | null>(null);
  const [salvando, setSalvando] = useState(false);

  const buscaLeilao = useBuscaLeiloes();
  const buscaLeiloesPublico = useBuscaLeiloes();
  const buscaClientes = useBuscaClientes();

  const carregarTemplates = async (atualizar = false) => {
    setCarregandoTpl(true);
    try {
      const r = await api.get('/whatsapp/templates', { params: atualizar ? { atualizar: 1 } : {} });
      setTemplates(r.data.templates); setFontes(r.data.fontes);
    } catch (e) { message.error(erroApi(e, 'Erro ao carregar templates')); }
    finally { setCarregandoTpl(false); }
  };
  useEffect(() => { carregarTemplates(); }, []);

  const tpl = useMemo(() => templates.find(t => `${t.nome}|${t.idioma}` === tplChave), [templates, tplChave]);
  const aprovados = templates.filter(t => t.status === 'APPROVED');

  const fontesDisponiveis = fontes.filter(f =>
    (f.exige !== 'leilao' || !!leilao) && (f.exige !== 'parcelas' || publico.tipo === 'parcelas'));

  const setVar = (secao: 'header' | 'body' | 'botoes', v: string, val: MapeamentoVar) =>
    setMapa(m => ({ ...m, [secao]: { ...(m[secao] || {}), [v]: val } }));

  const escolherTemplate = (chave: string) => {
    setTplChave(chave);
    setPrevia(null);
    const t = templates.find(x => `${x.nome}|${x.idioma}` === chave);
    // sugere "primeiro nome" para a primeira variável do texto — quase sempre é a saudação
    const body: Record<string, MapeamentoVar> = {};
    if (t?.bodyVariaveis[0]) body[t.bodyVariaveis[0]] = { fonte: 'primeiro_nome' };
    setMapa({ body });
  };

  const corpoRequisicao = () => ({
    nome: nome.trim(),
    templateNome: tpl?.nome,
    templateIdioma: tpl?.idioma,
    mapeamento: mapa,
    idLeilao: leilao?.value || null,
    publico: {
      tipo: publico.tipo,
      idsLeiloes: publico.idsLeiloes.map(l => l.value),
      desde: publico.desde?.format('YYYY-MM-DD'),
      vencimentoDe: publico.vencimento?.[0]?.format('YYYY-MM-DD'),
      vencimentoAte: publico.vencimento?.[1]?.format('YYYY-MM-DD'),
      idsClientes: publico.clientes.map(c => c.value),
      ufs: publico.ufs,
      excluirBloqueados: publico.excluirBloqueados,
    },
  });

  const calcular = async () => {
    setCalculando(true);
    try { setPrevia((await api.post('/whatsapp/campanhas/previa', corpoRequisicao())).data); }
    catch (e) { setPrevia(null); message.error(erroApi(e, 'Erro ao calcular o público')); }
    finally { setCalculando(false); }
  };

  const enviarTeste = async () => {
    setEnviandoTeste(true);
    try {
      const r = await api.post('/whatsapp/campanhas/teste', { ...corpoRequisicao(), telefone: telTeste });
      Modal.success({ title: `Teste enviado para ${r.data.numero}`, content: <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{r.data.texto}</Paragraph> });
    } catch (e) { message.error(erroApi(e, 'Erro no envio de teste')); }
    finally { setEnviandoTeste(false); }
  };

  const criar = async () => {
    setSalvando(true);
    try {
      const r = await api.post('/whatsapp/campanhas', {
        ...corpoRequisicao(),
        iniciar: quando === 'agora',
        agendadaPara: quando === 'agendar' ? agendarPara?.toISOString() : null,
      });
      message.success(quando === 'agora' ? 'Campanha criada — envio iniciado' : 'Campanha criada');
      aoCriar(r.data.id);
    } catch (e) { message.error(erroApi(e, 'Erro ao criar a campanha')); }
    finally { setSalvando(false); }
  };

  const podeAvancar0 = !!nome.trim() && !!tpl;
  const podeAvancar1 = !!previa && previa.total > 0 && !previa.erros?.length;

  // ── passo 1: mensagem ──
  const passoMensagem = (
    <Row gutter={16}>
      <Col xs={24} md={13}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Nome da campanha</Text>
            <Input value={nome} onChange={e => setNome(e.target.value)} maxLength={150} placeholder="Ex.: Convite Remate Primavera 2026" />
          </div>
          <div>
            <Text strong>Template aprovado na Meta</Text>
            <Space.Compact style={{ width: '100%' }}>
              <Select style={{ width: '100%' }} showSearch value={tplChave} onChange={escolherTemplate} loading={carregandoTpl}
                placeholder="Escolha o template" optionFilterProp="label"
                notFoundContent={carregandoTpl ? <Spin size="small" /> : 'Nenhum template aprovado'}
                options={aprovados.map(t => ({
                  value: `${t.nome}|${t.idioma}`,
                  label: `${t.nome} (${t.idioma}) · ${CATEGORIA[t.categoria] || t.categoria}`,
                }))} />
              <Button icon={<ReloadOutlined />} onClick={() => carregarTemplates(true)} title="Recarregar da Meta" />
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Templates são criados e aprovados no WhatsApp Manager da Meta. Os não aprovados não aparecem aqui.
            </Text>
          </div>
          <div>
            <Text strong>Leilão da campanha</Text> <Text type="secondary">(opcional — libera as variáveis do leilão)</Text>
            <Select style={{ width: '100%' }} showSearch allowClear labelInValue filterOption={false}
              value={leilao} onChange={v => setLeilao(v as any)} onSearch={buscaLeilao.buscar}
              options={buscaLeilao.opcoes} loading={buscaLeilao.carregando} placeholder="Digite para buscar o leilão"
              notFoundContent={buscaLeilao.carregando ? <Spin size="small" /> : 'Digite 2+ letras'} />
          </div>

          {tpl && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              {tpl.headerFormato === 'TEXT' && tpl.headerVariaveis.length > 0 && (
                <>
                  <Text strong>Cabeçalho</Text>
                  {tpl.headerVariaveis.map(v => (
                    <CampoVariavel key={v} nome={v} fontes={fontesDisponiveis} valor={mapa.header?.[v]} onChange={x => setVar('header', v, x)} />
                  ))}
                </>
              )}
              {tpl.headerFormato && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tpl.headerFormato) && (
                <div>
                  <Text strong>Link público do {tpl.headerFormato === 'IMAGE' ? 'imagem' : tpl.headerFormato === 'VIDEO' ? 'vídeo' : 'PDF'} do cabeçalho</Text>
                  <Input placeholder="https://..." value={mapa.headerMidiaUrl}
                    onChange={e => setMapa(m => ({ ...m, headerMidiaUrl: e.target.value }))} />
                </div>
              )}
              {tpl.bodyVariaveis.length > 0 && <Text strong>Variáveis do texto</Text>}
              {tpl.bodyVariaveis.map(v => (
                <CampoVariavel key={v} nome={v} fontes={fontesDisponiveis} valor={mapa.body?.[v]} onChange={x => setVar('body', v, x)} />
              ))}
              {tpl.botoes.filter(b => b.variavel).map(b => (
                <div key={b.indice}>
                  <Text strong>Botão "{b.texto}"</Text> <Text type="secondary">{b.url}</Text>
                  <CampoVariavel nome="1" fontes={fontesDisponiveis} valor={mapa.botoes?.[String(b.indice)]}
                    onChange={x => setVar('botoes', String(b.indice), x)} />
                </div>
              ))}
            </>
          )}
        </Space>
      </Col>
      <Col xs={24} md={11}>
        <Card size="small" title="Template" style={{ background: '#f6fff8' }}>
          {tpl ? (
            <>
              <Space style={{ marginBottom: 8 }}>
                <Tag color={tpl.categoria === 'MARKETING' ? 'orange' : 'blue'}>{CATEGORIA[tpl.categoria] || tpl.categoria}</Tag>
                <Tag>{tpl.idioma}</Tag>
              </Space>
              {tpl.headerTexto && <Paragraph strong>{tpl.headerTexto}</Paragraph>}
              {tpl.headerFormato && tpl.headerFormato !== 'TEXT' && <Paragraph type="secondary">[{tpl.headerFormato}]</Paragraph>}
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{tpl.bodyTexto}</Paragraph>
              {tpl.footerTexto && <Paragraph type="secondary" style={{ fontSize: 12 }}>{tpl.footerTexto}</Paragraph>}
              {tpl.botoes.map(b => <Tag key={b.indice} style={{ marginBottom: 4 }}>{b.texto}</Tag>)}
              {tpl.categoria === 'MARKETING' && (
                <Alert style={{ marginTop: 8 }} type="info" showIcon
                  message="Marketing é a categoria mais cara. Avisos de parcela e arremate devem usar templates de Utilidade." />
              )}
            </>
          ) : <Empty description="Escolha um template" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        </Card>
      </Col>
    </Row>
  );

  // ── passo 2: público ──
  const setP = (p: Partial<Publico>) => { setPublico(x => ({ ...x, ...p })); setPrevia(null); };
  const passoPublico = (
    <Row gutter={16}>
      <Col xs={24} md={10}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>Quem vai receber</Text>
          <Radio.Group value={publico.tipo} onChange={e => setP({ tipo: e.target.value })}>
            <Space direction="vertical">
              {TIPOS_PUBLICO.map(t => <Radio key={t.value} value={t.value}>{t.label}</Radio>)}
            </Space>
          </Radio.Group>

          {['compradores', 'lances', 'parcelas'].includes(publico.tipo) && (
            <div>
              <Text>{publico.tipo === 'parcelas' ? 'Só parcelas destes leilões (opcional)' : 'Dos leilões'}</Text>
              <Select mode="multiple" labelInValue style={{ width: '100%' }} filterOption={false}
                value={publico.idsLeiloes} onChange={v => setP({ idsLeiloes: v as any })}
                onSearch={buscaLeiloesPublico.buscar} options={buscaLeiloesPublico.opcoes}
                loading={buscaLeiloesPublico.carregando} placeholder="Digite para buscar"
                notFoundContent={buscaLeiloesPublico.carregando ? <Spin size="small" /> : 'Digite 2+ letras'} />
            </div>
          )}
          {['compradores', 'lances'].includes(publico.tipo) && (
            <div>
              <Text>{publico.idsLeiloes.length ? 'e/ou a partir de' : 'Ou: a partir de'}</Text>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={publico.desde} onChange={d => setP({ desde: d })} />
            </div>
          )}
          {publico.tipo === 'parcelas' && (
            <div>
              <Text>Vencimento entre</Text>
              <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={publico.vencimento as any}
                onChange={d => setP({ vencimento: d as any })}
                presets={[
                  { label: 'Próximos 7 dias', value: [dayjs(), dayjs().add(7, 'day')] },
                  { label: 'Próximos 15 dias', value: [dayjs(), dayjs().add(15, 'day')] },
                  { label: 'Este mês', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                ]} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                O sistema não sabe quais parcelas já foram pagas — todas do período entram.
              </Text>
            </div>
          )}
          {publico.tipo === 'selecionados' && (
            <div>
              <Text>Clientes</Text>
              <Select mode="multiple" labelInValue style={{ width: '100%' }} filterOption={false}
                value={publico.clientes} onChange={v => setP({ clientes: v as any })}
                onSearch={buscaClientes.buscar} options={buscaClientes.opcoes} loading={buscaClientes.carregando}
                placeholder="Digite para buscar" notFoundContent={buscaClientes.carregando ? <Spin size="small" /> : 'Digite 2+ letras'} />
            </div>
          )}
          <div>
            <Text>Só destes estados (opcional)</Text>
            <Select mode="multiple" style={{ width: '100%' }} value={publico.ufs} onChange={v => setP({ ufs: v })}
              options={UFS.map(u => ({ value: u, label: u }))} placeholder="Todos" />
          </div>
          <Checkbox checked={publico.excluirBloqueados} onChange={e => setP({ excluirBloqueados: e.target.checked })}>
            Excluir clientes bloqueados
          </Checkbox>
          <Button type="primary" icon={<CalculatorOutlined />} onClick={calcular} loading={calculando} block>Calcular público</Button>
        </Space>
      </Col>
      <Col xs={24} md={14}>
        {!previa ? <Empty description="Defina o público e clique em Calcular" /> : (
          <>
            {previa.erros?.length > 0 && (
              <Alert type="error" showIcon style={{ marginBottom: 8 }} message="Ajuste a mensagem antes de continuar"
                description={<ul style={{ margin: 0, paddingLeft: 18 }}>{previa.erros.map((e: string) => <li key={e}>{e}</li>)}</ul>} />
            )}
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Vão receber"><Text strong>{previa.total}</Text></Descriptions.Item>
              <Descriptions.Item label="Custo estimado"><Text strong>{fmtReais(previa.custoEstimado)}</Text></Descriptions.Item>
              <Descriptions.Item label="Sem celular válido">{previa.semCelularValido}</Descriptions.Item>
              <Descriptions.Item label="Descadastrados">{previa.descadastrados}</Descriptions.Item>
              <Descriptions.Item label="Celular repetido">{previa.duplicados}</Descriptions.Item>
              <Descriptions.Item label="Limite diário">
                {previa.limiteDiario}{previa.diasEstimados > 1 && <Text type="warning"> — vai levar ~{previa.diasEstimados} dias</Text>}
              </Descriptions.Item>
            </Descriptions>
            <Table style={{ marginTop: 8 }} size="small" rowKey="idCliente" dataSource={previa.amostra} pagination={false}
              scroll={{ y: 260 }} title={() => <Text type="secondary">Amostra (primeiros 20)</Text>}
              expandable={previa.amostra?.[0]?.texto ? {
                expandedRowRender: (r: any) => <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.texto}</Paragraph>,
              } : undefined}
              columns={[
                { title: 'Nome', dataIndex: 'nome', ellipsis: true },
                { title: 'Telefone', dataIndex: 'telefone', width: 165 },
                { title: 'UF', dataIndex: 'uf', width: 50 },
              ]} />
          </>
        )}
      </Col>
    </Row>
  );

  // ── passo 3: enviar ──
  const passoEnviar = (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Card size="small" title="1. Envie um teste para você">
          <Paragraph type="secondary">Usa dados de exemplo no lugar das informações do cliente.</Paragraph>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="DDD + celular" value={telTeste} onChange={e => setTelTeste(e.target.value)} />
            <Button icon={<SendOutlined />} onClick={enviarTeste} loading={enviandoTeste} disabled={!telTeste}>Enviar teste</Button>
          </Space.Compact>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title="2. Quando enviar">
          <Radio.Group value={quando} onChange={e => setQuando(e.target.value)}>
            <Space direction="vertical">
              <Radio value="agora">Começar agora</Radio>
              <Radio value="agendar">Agendar</Radio>
              {quando === 'agendar' && (
                <DatePicker showTime format="DD/MM/YYYY HH:mm" value={agendarPara} onChange={setAgendarPara}
                  disabledDate={d => d.isBefore(dayjs().startOf('day'))} />
              )}
              <Radio value="depois">Só salvar (inicio depois)</Radio>
            </Space>
          </Radio.Group>
          {previa && (
            <Alert style={{ marginTop: 12 }} type="warning" showIcon
              message={`${previa.total} mensagens · custo estimado ${fmtReais(previa.custoEstimado)}`}
              description="A Meta cobra por mensagem entregue. Depois de enviadas, as mensagens não podem ser desfeitas." />
          )}
        </Card>
      </Col>
    </Row>
  );

  const rodape = (
    <Space>
      {passo > 0 && <Button onClick={() => setPasso(p => p - 1)}>Voltar</Button>}
      {passo === 0 && <Button type="primary" disabled={!podeAvancar0} onClick={() => setPasso(1)}>Próximo: público</Button>}
      {passo === 1 && <Button type="primary" disabled={!podeAvancar1} onClick={() => setPasso(2)}>Próximo: enviar</Button>}
      {passo === 2 && (
        <Button type="primary" icon={<SendOutlined />} loading={salvando} onClick={criar}
          disabled={quando === 'agendar' && !agendarPara}>
          {quando === 'agora' ? 'Criar e enviar' : 'Criar campanha'}
        </Button>
      )}
    </Space>
  );

  return (
    <Modal open title="Nova campanha de WhatsApp" width={1100} onCancel={onClose} footer={rodape} maskClosable={false}>
      <Steps current={passo} size="small" style={{ marginBottom: 16 }}
        items={[{ title: 'Mensagem' }, { title: 'Público' }, { title: 'Enviar' }]} />
      <div style={{ display: passo === 0 ? 'block' : 'none' }}>{passoMensagem}</div>
      <div style={{ display: passo === 1 ? 'block' : 'none' }}>{passoPublico}</div>
      <div style={{ display: passo === 2 ? 'block' : 'none' }}>{passoEnviar}</div>
    </Modal>
  );
}

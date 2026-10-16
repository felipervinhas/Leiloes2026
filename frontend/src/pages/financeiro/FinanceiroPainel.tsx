import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, Empty, Button, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useBanco } from '../../context/BancoContext';
import { fmtDataUTC } from '../../utils/data';
import { fmtValor } from './Lancamentos';
import { nomeBanco } from './ContasBancarias';

const { Title, Text } = Typography;

export default function FinanceiroPainel() {
  const { banco } = useBanco();
  const navigate = useNavigate();
  const [contas, setContas] = useState<any[] | null>(null);

  useEffect(() => {
    api.get('/conciliacao/resumo').then(r => setContas(r.data))
      .catch(() => { setContas([]); message.error('Erro ao carregar o painel'); });
  }, []);

  if (!contas) return <Spin />;

  return (
    <>
      <Title level={4}>Painel</Title>
      {contas.length === 0 ? (
        <Empty description="Nenhuma conta bancária cadastrada">
          <Button type="primary" onClick={() => navigate(`/${banco}/financeiro/importar`)}>Importar o primeiro extrato</Button>
        </Empty>
      ) : contas.map(c => (
        <Card key={c.idConta} title={c.descricao || nomeBanco(c.banco)} style={{ marginBottom: 16 }}
          extra={<Text type="secondary">{nomeBanco(c.banco)}</Text>}>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Statistic title={c.saldoAte ? `Saldo em ${fmtDataUTC(c.saldoAte)}` : 'Saldo'}
                value={c.saldo != null ? fmtValor(c.saldo) : '—'} />
            </Col>
            <Col xs={12} md={6}><Statistic title="Pendentes" value={c.pendentes} valueStyle={{ color: '#d46b08' }} /></Col>
            <Col xs={12} md={6}><Statistic title="Pendentes com cliente identificado" value={c.pendentesComCliente} /></Col>
            <Col xs={12} md={6}><Statistic title="Conciliados" value={c.conciliados} valueStyle={{ color: '#389e0d' }} /></Col>
          </Row>
        </Card>
      ))}
    </>
  );
}

import React from 'react';
import { Result, Typography } from 'antd';
import { DollarOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function Vendas() {
  return (
    <>
      <Title level={4}>Vendas</Title>
      <Result
        icon={<DollarOutlined style={{ color: '#52c41a' }} />}
        title="Módulo de Vendas"
        subTitle="Registro de vendas com parcelas e comissões. Em desenvolvimento."
      />
    </>
  );
}

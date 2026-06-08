import React from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import { CalendarOutlined, ShoppingOutlined, TeamOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function Dashboard() {
  return (
    <>
      <Title level={4} style={{ marginBottom: 24 }}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Leilões Ativos"
              value={0}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Lotes Cadastrados"
              value={0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Animais"
              value={0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

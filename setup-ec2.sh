#!/bin/bash
# Setup inicial do EC2 — rodar UMA VEZ via SSH
# ssh -i sua-chave.pem ec2-user@SEU_EC2_IP 'bash -s' < setup-ec2.sh

set -e

echo "==> Instalando Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -   # Amazon Linux
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -  # Ubuntu

sudo yum install -y nodejs git   # Amazon Linux
# sudo apt-get install -y nodejs git  # Ubuntu

echo "==> Instalando PM2..."
sudo npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME | tail -1 | sudo bash

echo "==> Clonando repositório..."
git clone https://github.com/felipervinhas/Leiloes2026.git ~/leiloes2026

echo "==> Configurando backend..."
cd ~/leiloes2026/backend
npm ci --omit=dev
npm run build

echo ""
echo "==> IMPORTANTE: crie o arquivo .env antes de iniciar:"
echo "    nano ~/leiloes2026/backend/.env"
echo "    (use o conteúdo de backend/.env.example como base)"
echo ""
echo "==> Depois inicie com:"
echo "    cd ~/leiloes2026/backend && pm2 start ecosystem.config.js --env production"
echo "    pm2 save"

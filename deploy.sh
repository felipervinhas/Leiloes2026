#!/bin/bash
# Deploy do backend no EC2
# Uso: ./deploy.sh
# Pré-requisito: chave SSH configurada em ~/.ssh/config ou passar EC2_KEY abaixo

EC2_USER="ec2-user"          # ubuntu (Ubuntu) ou ec2-user (Amazon Linux)
EC2_HOST="SEU_EC2_IP"
EC2_KEY="~/.ssh/sua-chave.pem"
REMOTE_DIR="/home/$EC2_USER/leiloes2026"

echo "==> Conectando ao EC2 e fazendo deploy..."

ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
  set -e
  cd ~/leiloes2026

  echo "-- Pull das atualizações..."
  git pull origin main

  echo "-- Instalando dependências do backend..."
  cd backend
  npm ci --omit=dev

  echo "-- Build TypeScript..."
  npm run build

  echo "-- Reiniciando PM2..."
  pm2 restart leiloes2026-api --env production || pm2 start ecosystem.config.js --env production

  echo "-- Status:"
  pm2 status
ENDSSH

echo "==> Deploy concluído!"

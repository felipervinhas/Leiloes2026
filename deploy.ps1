# Deploy do backend no EC2 Windows
# Uso: .\deploy.ps1
# Pre-requisito: acesso RDP ou SSH configurado no EC2

param(
    [string]$EC2Host = "SEU_EC2_IP",
    [string]$EC2User = "Administrator",
    [string]$RemoteDir = "C:\frvsoftware\Leiloes2026"
)

Write-Host "==> Conectando ao EC2 Windows e fazendo deploy..." -ForegroundColor Cyan

$script = @"
Set-Location "$RemoteDir\backend"
Write-Host '-- Pull das atualizacoes...'
git pull origin main
Write-Host '-- Instalando dependencias...'
npm ci --omit=dev
Write-Host '-- Build TypeScript...'
npm run build
Write-Host '-- Reiniciando PM2...'
pm2 restart leiloes2026-api
pm2 status
"@

ssh "$EC2User@$EC2Host" "powershell -Command { $script }"

Write-Host "==> Deploy concluido!" -ForegroundColor Green

# Setup inicial do backend no EC2 Windows
# Rodar UMA VEZ diretamente no servidor via RDP ou SSH

Set-Location "C:\frvsoftware\Leiloes2026\backend"

Write-Host "==> Instalando PM2 globalmente..." -ForegroundColor Cyan
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install

Write-Host "==> Instalando dependencias do backend..." -ForegroundColor Cyan
npm ci --omit=dev

Write-Host "==> Build TypeScript..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "==> IMPORTANTE: verifique se o arquivo .env existe:" -ForegroundColor Yellow
Write-Host "    C:\frvsoftware\Leiloes2026\backend\.env"
Write-Host ""
Write-Host "==> Para iniciar o servidor:" -ForegroundColor Green
Write-Host "    cd C:\frvsoftware\Leiloes2026\backend"
Write-Host "    pm2 start ecosystem.config.js --env production"
Write-Host "    pm2 save"

@echo off
setlocal

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js no esta instalado. Descargalo desde https://nodejs.org/.
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  npm install
)

echo Iniciando Vite en http://localhost:5173 ...
start "Vite" cmd /c "npm run dev"

echo Iniciando Cloudflare Tunnel...
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
  echo cloudflared no esta instalado.
  echo Instalacion sugerida: winget install Cloudflare.cloudflared
  echo Tambien podes usar: choco install cloudflared
  exit /b 1
)

echo URL local: http://localhost:5173
cloudflared tunnel --url http://localhost:5173

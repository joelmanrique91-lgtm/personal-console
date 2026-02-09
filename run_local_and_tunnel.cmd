@echo off
setlocal

pushd "%~dp0"

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
start "Vite" cmd /k "npm run dev -- --host 0.0.0.0 --port 5173"

echo Iniciando Cloudflare Tunnel...
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
  echo cloudflared no esta instalado.
  echo Instalacion sugerida: winget install Cloudflare.cloudflared
  echo Tambien podes usar: choco install cloudflared
  exit /b 1
)

echo URL local: http://localhost:5173
echo La URL del tunel se mostrara en la ventana de Cloudflared.
start "Cloudflared Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5173"

popd

echo.
echo Listo. Vite y Cloudflared estan corriendo en ventanas separadas.
echo Presiona una tecla para cerrar este launcher.
pause >nul

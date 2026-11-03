@echo off
title Dofus Craft Calc
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org && pause && exit /b 1)
if not exist node_modules (
  echo Instalando dependencias...
  call npm install || (pause && exit /b 1)
)
echo Iniciando o site em http://localhost:5173 ...
call npm run dev
pause

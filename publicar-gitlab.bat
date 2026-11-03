@echo off
setlocal
title Publicar Dofus Craft Calc no GitLab
cd /d "%~dp0"

where git >nul 2>nul || (echo Git nao encontrado. Instale em https://git-scm.com e rode de novo. & pause & exit /b 1)

echo.
echo === Limpando arquivos que nao sao mais usados ===
if exist extension rmdir /s /q extension
if exist src\lib\dofusbook.ts del /q src\lib\dofusbook.ts
if exist src\lib\extensionBridge.ts del /q src\lib\extensionBridge.ts
if exist tests\dofusbook.test.ts del /q tests\dofusbook.test.ts
if exist tests\fixtures\stuff-16101449.json del /q tests\fixtures\stuff-16101449.json

echo.
set /p GLUSER=Seu usuario (ou grupo) do GitLab: 
if "%GLUSER%"=="" (echo Usuario nao informado. & pause & exit /b 1)

if not exist .git (
  git init -b main || (pause & exit /b 1)
)

for /f "delims=" %%e in ('git config user.email') do set GITEMAIL=%%e
if "%GITEMAIL%"=="" (
  set /p GITNAME=Seu nome para os commits: 
  set /p GITEMAIL=Seu e-mail para os commits: 
  call git config user.name "%%GITNAME%%"
  call git config user.email "%%GITEMAIL%%"
)

git add . || (pause & exit /b 1)
git diff --cached --quiet && (echo Nada novo para commitar.) || git commit -m "Dofus Craft Calc: montador de set, precos por lote e export Excel"

git remote get-url origin >nul 2>nul && git remote set-url origin https://gitlab.com/%GLUSER%/dofus-craft-calc.git || git remote add origin https://gitlab.com/%GLUSER%/dofus-craft-calc.git

echo.
echo === Enviando para https://gitlab.com/%GLUSER%/dofus-craft-calc ===
echo (se pedir login, entre com sua conta do GitLab)
git push -u origin main
if errorlevel 1 (
  echo.
  echo O envio falhou. Copie a mensagem acima e mande para o Claude.
  pause
  exit /b 1
)

echo.
echo Pronto! Repositorio: https://gitlab.com/%GLUSER%/dofus-craft-calc
pause

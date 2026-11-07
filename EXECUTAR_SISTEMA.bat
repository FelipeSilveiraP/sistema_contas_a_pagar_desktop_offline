@echo off
title Sistema Contas a Pagar - Chaveiro Universal
chcp 65001 > nul

echo ======================================================================
echo           SISTEMA DE CONTAS A PAGAR - CHAVEIRO UNIVERSAL
echo                       MODO 100%% OFFLINE (DESKTOP)
echo ======================================================================
echo.
echo [*] Iniciando a interface do sistema...
echo.

cd /d "%~dp0"

if not exist "backend\target\findesk-backend-0.1.0.jar" (
    echo [ERRO] Backend nao compilado. Execute: mvn -f backend/pom.xml package
    pause
    exit /b 1
)

call npx electron desktop\main.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] A aplicacao encerrou com codigo de erro %ERRORLEVEL%.
    pause
)

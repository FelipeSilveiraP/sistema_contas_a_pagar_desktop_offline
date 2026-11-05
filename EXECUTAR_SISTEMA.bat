@echo off
title Sistema Contas a Pagar - Chaveiro Universal
chcp 65001 > nul

echo ======================================================================
echo           SISTEMA DE CONTAS A PAGAR - CHAVEIRO UNIVERSAL
echo                       MODO 100%% OFFLINE (DESKTOP)
echo ======================================================================
echo.
echo [*] Inicializando o ambiente e abrindo a interface grafica JavaFX...
echo.

set MAVEN_CMD=%USERPROFILE%\apache-maven-3.9.6\bin\mvn.cmd

if not exist "%MAVEN_CMD%" (
    echo [ERRO] Maven portatil nao localizado em: %MAVEN_CMD%
    pause
    exit /b 1
)

call "%MAVEN_CMD%" javafx:run

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] A aplicacao encerrou com codigo de erro %ERRORLEVEL%.
    pause
)

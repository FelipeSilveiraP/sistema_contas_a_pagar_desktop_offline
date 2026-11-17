; Trechos proprios do instalador NSIS (electron-builder: nsis.include).
;
; O INSTALADOR NAO grava mais o sistema na inicializacao do Windows (2026-11-17):
; instalador sem assinatura que se cadastra para abrir com o computador e o padrao
; que o Windows Defender bloqueia como programa nocivo (o do Garantias, que nao
; grava, passa). O cadastro continua: o PROPRIO sistema o grava a cada abertura,
; respeitando "abrirAoLigarComputador" do configuracoes.json
; (desktop/automacoes.js configurarInicioComWindows).

; numa ATUALIZACAO o desinstalador da versao antiga tambem roda: so remove o
; cadastro quando o sistema e desinstalado de verdade
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Contas a Pagar - Chaveiro Universal"
  ${endIf}
!macroend

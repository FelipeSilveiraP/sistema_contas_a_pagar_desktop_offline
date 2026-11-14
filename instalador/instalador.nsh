; Trechos proprios do instalador NSIS (electron-builder: nsis.include).
; Abrir com o Windows: o INSTALADOR ja cadastra o sistema na inicializacao do
; usuario, sem depender de o sistema ser aberto a mao depois de instalar.
; O sistema confere/regrava o cadastro a cada abertura e respeita
; "abrirAoLigarComputador" do configuracoes.json (desliga se for false).
; Mesmo nome e argumento usados em desktop/automacoes.js (NOME_INICIO, ARG_INICIO).

!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Contas a Pagar - Chaveiro Universal" '"$INSTDIR\Contas a Pagar - Chaveiro Universal.exe" --inicio-automatico'
!macroend

; numa ATUALIZACAO o desinstalador da versao antiga tambem roda: so remove o
; cadastro quando o sistema e desinstalado de verdade
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Contas a Pagar - Chaveiro Universal"
  ${endIf}
!macroend

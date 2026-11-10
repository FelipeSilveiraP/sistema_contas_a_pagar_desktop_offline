# Instalação, atualização e manutenção

Guia para instalar o **Sistema de Contas a Pagar — Chaveiro Universal** no computador da loja. Não precisa de internet nem de Java instalado: tudo vai dentro do instalador.

## Gerar o instalador (computador de desenvolvimento)

Requisitos: JDK 21, Maven 3.9+ e Node.js 20+.

```bash
npm install
npm run instalador
```

O comando faz tudo em sequência:
1. compila a interface;
2. roda os testes do backend e gera o `.jar`;
3. cria um Java mínimo com o `jlink`, de cerca de 50 MB;
4. monta o instalador.

Resultado: `release/Contas a Pagar - Chaveiro Universal - Instalador <versão>.exe`, com cerca de 143 MB.

## Instalar (computador da loja)

1. Copie o instalador para o computador, por pen drive, rede ou como preferir.
2. Dê dois cliques. A instalação é automática, para o usuário do Windows, **sem pedir senha de administrador**, e o sistema abre sozinho ao terminar.
3. Atalhos criados: **"Contas a Pagar"** na Área de Trabalho e no Menu Iniciar.

O Windows pode mostrar o aviso "O Windows protegeu o computador", porque o instalador não tem assinatura digital paga. Clique em **Mais informações › Executar assim mesmo**.

## Atualizar para uma versão nova

1. Feche o sistema.
2. Rode o instalador da versão nova. Ele substitui o programa e **não toca nos dados**.
3. Ao abrir, o sistema faz sozinho um **backup do banco** antes de aplicar qualquer mudança de estrutura (migração). As migrações só acrescentam, nunca apagam dados.

Não existe atualização automática pela internet, porque o sistema é 100% offline.

## Onde ficam os dados

| O quê | Onde |
|---|---|
| Banco de dados | `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\contas_a_pagar.db` |
| Backups automáticos (diário e antes de cada migração; mantém os 8 últimos) | `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\backups\` |
| Logs (`app.log` e `backend.log`, com rotação de 5 MB e limite de 50 MB) | `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar\logs\` |
| Notas fiscais baixadas | `Downloads\Chaveiro Universal - Notas Fiscais\` |
| Relatórios impressos (PDF) | `Downloads\Chaveiro Universal - Relatórios\` |

Para abrir a pasta: tecla **Windows + R**, digite `%LOCALAPPDATA%\ChaveiroUniversal\ContasAPagar` e aperte Enter.

**Cópia de segurança extra:** de tempos em tempos, copie a pasta `backups` para um pen drive. Não copie o arquivo `.db` com o sistema aberto: use os arquivos da pasta `backups`, que são cópias consistentes.

## Desinstalar

Configurações do Windows › Aplicativos › "Contas a Pagar - Chaveiro Universal" › Desinstalar. **Os dados e os backups continuam** em `%LOCALAPPDATA%\ChaveiroUniversal\`. Para apagá-los também, exclua essa pasta manualmente.

## Se algo der errado

- **"O sistema encontrou um problema e precisa ser fechado":** abra de novo pelo atalho. Se repetir, envie a pasta `logs`. Os logs não contêm senhas nem o código de acesso interno.
- **Tela de carregamento com erro:** use **Tentar novamente**. Se persistir, reinicie o computador e envie a pasta `logs`.

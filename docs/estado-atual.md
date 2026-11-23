# Estado atual

> Máximo 30 linhas. **Reescreva** este arquivo a cada entrega (não acrescente histórico — decisões vão em `docs/decisoes.md`, histórico fica no Git).

**Atualizado em:** 2026-11-23 — `main`; instalador em **Releases** a cada envio (versão automática); atualização sozinha pelo GitHub (botão ATUALIZAR); Enter = enviar; **contas com PIN ("Quem está usando?")** e tabelas de 5 linhas com EXPANDIR TABELA, como no Garantias

## Situação
- **ATUALIZAR corrigido e ensaiado (2026-11-17):** abre o instalador direto; cada versao so e publicada se o ensaio pela tela no Windows passar (pop-up no centro, barra, fecha, reabre na versao nova). 1.3.16/1.3.20 nao se atualizam sozinhas: instalar a 1.3.31+ uma vez. Ver `decisoes.md`.
- **Versão 1.3.7 (2026-11-15) — auditoria de segurança** (relatório em `docs/seguranca.md`): teto de valor, PDF com JavaScript escondido recusado, erros 4xx no lugar de 500, limite de tamanho das requisições, token obrigatório, IPC só das telas do sistema, backup no Drive que nunca apaga arquivo alheio, Spring Boot 3.5.16, sqlite-jdbc 3.54.1.0, GitHub Actions (`.github/workflows/testes.yml`).
- Esquema SQLite **v19** (v17: gatilhos + `auditoria_operacoes`; v18: auditoria das contas fixas e teto de valor; v19: contas de usuário com PIN). Nova dependência de execução: `pdf-lib` 1.17.1, que junta a nota em PDF na impressão.

- **O QUE MUDOU (2026-11-23):** depois de cada atualização o Menu mostra o que foi feito (lista dos commits feat/fix).

- **Banco v22 (2026-11-23):** revisão de gatilhos, auditoria completa e transações do PIN (ver `decisoes.md`).

## Próximos passos
- **Atualizar o Electron 33 → atual** (46 avisos de segurança) numa entrega própria, com smoke-real, smoke-dev e CRUD real no Windows.
- Instalar na loja a 1ª versão baixada de Releases (as próximas chegam pelo botão ATUALIZAR).
- Importador da planilha legada para `legado_*` e, depois, para `contas_a_pagar`/`boletos_recorrentes`/`avisos`, quando o usuário enviar os dados.

## Pendências — decisões do usuário (auditoria)
- Empresa: endereço estruturado, nome fantasia e vários e-mails; CNPJ e representante obrigatórios?
- Virada de ano: gerar as contas fixas ao abrir ou manter o botão "Gerar próximos meses"?
- Editar uma conta fixa altera as pendentes já geradas (modo ALTERAR do VBA)?
- Exclusão de banco/empresa com contas: hoje desfaz o vínculo (SET NULL); bloquear?
- Baixa rápida pedir o banco usado no pagamento?

## Pendências do usuário
- Na 1ª abertura da versão nova: criar a conta do administrador; em MINHA CONTA, gravar a senha de app do Gmail da loja (sem ela "Esqueci meu PIN" não funciona) e cadastrar as outras pessoas. Guardar uma cópia de `chave-contas.key` (pasta de dados).
- Decidir sobre **assinar o `versao.json` das atualizações** (ver `docs/seguranca.md` §8). Até lá, compartilhar a pasta de atualizações do Drive só com quem precisa.
- **Ligar os Drives (antes da 1ª atualização):** na conta da firma, criar em Meu Drive a pasta `Chaveiro Universal - Atualizacoes` e compartilhar como Editor com o e-mail do desenvolvedor. No PC de desenvolvimento, usar "Adicionar atalho ao Meu Drive". Na loja, marcar a pasta como "Disponível off-line" (passo a passo em `docs/instalacao.md`).

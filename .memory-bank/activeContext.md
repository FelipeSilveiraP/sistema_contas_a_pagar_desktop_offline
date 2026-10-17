# Active Context

## Foco Atual
Conclusão da arquitetura de banco de dados e modelos relacionais derivados do DER (draw.io). Preparação para início da implementação das telas do Fluxo 1 (`INSERIR CONTA`) e Fluxo 2 (`CONTROLE`).

## Decisões Recentes Tomadas
* DER refinado e implementado em 12 tabelas no SQLite via [`DatabaseInitializer.java`](file:///c:/contas_pagar_chaveiro_universal/src/main/java/com/chaveiro/database/DatabaseInitializer.java).
* Relacionamento `contas_a_pagar` $\longleftrightarrow$ `pagamentos` $\longleftrightarrow$ `bancos` conectado e validado.
* Especialização `xt` de `PAGADOR` (PF/PJ) mapeada em tabela única com constraint `CHECK`.
* 12 Records imutáveis em Java 21 criados em `com.chaveiro.model`.
* Baixa atômica com auditoria ACID implementada no [`ContaRepository.java`](file:///c:/contas_pagar_chaveiro_universal/src/main/java/com/chaveiro/repository/ContaRepository.java).
* Testes unitários atualizados no [`ContaServiceTest.java`](file:///c:/contas_pagar_chaveiro_universal/src/test/java/com/chaveiro/service/ContaServiceTest.java).

## Próximos Passos
1. Construir a tela do **Fluxo 1 (INSERIR CONTA - Formulário em 2 etapas)** no JavaFX FXML + CSS Neobrutalista.
2. Construir o Controller com validações visuais e persistência assíncrona (`Task` + Virtual Threads).

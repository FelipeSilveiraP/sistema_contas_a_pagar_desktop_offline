# Análise do banco — o que é usado e o que está morto (2026-11-18)

Feita pelo código (repositories, services e telas) sobre o esquema atual (v21). "Morto" = nenhuma tela nem rotina lê ou grava. Nada foi apagado: as migrações só acrescentam (AGENTS.md). Uma limpeza precisa de aprovação e começa por backup.

## Contas a Pagar

### Tabelas em uso (todas as colunas usadas)
| Tabela | Para que serve |
|---|---|
| contas_a_pagar | as contas (boletos) |
| pagamentos | baixa de cada conta: data, valor, banco e **forma de pagamento (nova, v21)** |
| boletos_recorrentes | contas fixas |
| empresas + telefones_empresa | cadastro de empresas |
| bancos | cadastro de bancos (chave Pix) |
| pagadores | quem paga |
| avisos | recados do Menu |
| usuarios, acessos_usuario, codigos_redefinicao | contas com PIN, histórico de acessos, "Esqueci meu PIN" |
| manutencao | configurações (e-mail da loja, limpeza das notas etc.) |
| auditoria_operacoes | trilha de segurança: o **banco** grava sozinho (gatilhos) toda alteração de contas, pagamentos, recorrentes, usuários e configurações. Nenhuma tela mostra. **Não é lixo**: é a prova do que mudou. |

### Mortas (nenhuma tela usa)
| O quê | Por quê |
|---|---|
| **legado_lancamentos** (15 colunas) | criada na v1 para importar a planilha antiga; o importador nunca foi feito |
| **legado_padroes** (10 colunas) | idem (contas padrão da planilha) |
| **legado_avisos** (9 colunas) | idem (avisos da planilha) |
| **avisos_antes_v15** | cópia de segurança da tabela de avisos, deixada pela migração v15 |
| empresas.**data_cadastro** | gravada, nunca lida |
| boletos_recorrentes.**categoria** e **numero_documento** | a tela de conta fixa não pede: ficam sempre vazias |
| boletos_recorrentes.**ativo** | sempre "sim"; não existe pausar conta fixa |

### Quase sem uso
- `criado_em` (contas, pagamentos, recorrentes, avisos): o banco preenche sozinho. Só aparece no backup em planilha do Google Drive (contas e pagamentos).

## Sistema de Garantias

### Tabelas em uso
garantias, garantia_itens (produtos de cada garantia), servicos (tabela de valores, com **NOME NO RM**), tecnicos, marcas + veiculos, legado_garantias (planilha antiga importada), usuarios/acessos_usuario/codigos_redefinicao, manutencao, auditoria_operacoes (trilha de segurança, como no Contas a Pagar).

### Mortas ou quase
| O quê | Por quê |
|---|---|
| **modelos** (tabela inteira) | trocada pelo catálogo de marcas e veículos (CONTROLE > VEÍCULOS). A rota `/api/listas/modelos` ainda existe, mas nenhuma tela usa |
| servicos.**pede_carcaca / pede_botao / pede_pilha / pede_itens** | desde os produtos em linhas (quantidade de 1 a 5 em cada linha) o cadastro da garantia não pergunta mais. O "Cadastrar produto" ainda mostra essas caixas, sem efeito |
| garantias.**qtd_carcaca / qtd_botao / qtd_pilha / qtd_itens** | só nas garantias antigas: as novas guardam as quantidades em garantia_itens (aqui fica 0) |
| garantias.**codigo_cupom** e servicos.**codigo_cupom** | códigos do SAT antigo; o cupom novo procura pelo NOME NO RM |
| garantias.**id_tecnico** | gravado, nunca lido (as telas usam o nome do técnico) |
| `criado_em` de marcas, veículos, técnicos e modelos; legado_garantias.**importado_em** | preenchidos pelo banco, nunca lidos |

## Proposta (só com aprovação)
1. Backup automático antes.
2. Contas a Pagar: apagar legado_lancamentos, legado_padroes, legado_avisos e avisos_antes_v15. Garantias: apagar modelos.
3. Garantias: tirar do "Cadastrar produto" as caixas "PERGUNTAR A QUANTIDADE DE" (não fazem nada).
4. Colunas mortas: deixar no banco (apagar coluna no SQLite recria a tabela inteira, com risco e sem ganho) e só parar de mostrar/gravar.

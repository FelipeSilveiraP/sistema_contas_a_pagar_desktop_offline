package com.chaveiro.service;

import com.chaveiro.database.ConnectionFactory;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Backup "quebra-galho" no Google Drive (pedido do usuario, 2026-11-12): toda vez
 * que o sistema abre, grava uma planilha Excel com os DADOS (sem as notas
 * fiscais) na pasta do Google Drive para computador, que sincroniza sozinho.
 *
 * Pasta: findesk.backup-drive.pasta (FINDESK_PASTA_DRIVE) ou, so no banco
 * OPERACIONAL, deteccao automatica de "Meu Drive"/"My Drive" (unidade virtual
 * G:\ etc.). Com banco de teste (FINDESK_DB_PATH) e sem pasta explicita, nao
 * faz nada: teste nunca escreve no Drive real.
 */
@Service
public class BackupDriveService {

    private static final Logger log = LoggerFactory.getLogger(BackupDriveService.class);

    static final String SUBPASTA = "Chaveiro Universal - Backup";
    static final String PREFIXO = "Contas a Pagar - dados ";
    static final int MANTER = 30;

    public record Situacao(String estado, String mensagem, String arquivo, String quando) {}

    private final ConnectionFactory conexao;
    private final String pastaConfigurada;
    private final boolean bancoOperacional;
    private volatile Situacao situacao = new Situacao("aguardando", "Backup ainda não executado.", null, null);

    public BackupDriveService(ConnectionFactory conexao,
                              @Value("${findesk.backup-drive.pasta:}") String pastaConfigurada,
                              @Value("${findesk.db.path:}") String caminhoBancoSobrescrito) {
        this.conexao = conexao;
        this.pastaConfigurada = pastaConfigurada == null ? "" : pastaConfigurada.trim();
        this.bancoOperacional = caminhoBancoSobrescrito == null || caminhoBancoSobrescrito.isBlank();
    }

    public Situacao getSituacao() {
        return situacao;
    }

    /** Roda em segundo plano para nao atrasar a abertura do sistema. */
    public void exportarEmSegundoPlano() {
        Thread t = new Thread(this::exportar, "backup-google-drive");
        t.setDaemon(true);
        t.start();
    }

    public Situacao exportar() {
        Optional<Path> raiz = pastaDestino();
        if (raiz.isEmpty()) {
            situacao = bancoOperacional
                    ? new Situacao("erro", "Pasta do Google Drive não encontrada. Abra o Google Drive no computador e confira se \"Meu Drive\" aparece no Explorador de Arquivos.", null, agora())
                    : new Situacao("desligado", "Backup no Drive desligado (banco de teste).", null, agora());
            if (bancoOperacional) {
                log.warn("backup no Google Drive nao feito: pasta do Drive nao encontrada");
            }
            return situacao;
        }
        situacao = new Situacao("executando", "Enviando backup para o Google Drive...", null, agora());
        try {
            Path pasta = raiz.get().resolve(SUBPASTA);
            Files.createDirectories(pasta);
            Path destino = pasta.resolve(PREFIXO + LocalDate.now() + ".xlsx");
            Path temporario = pasta.resolve(destino.getFileName() + ".tmp");
            Files.write(temporario, PlanilhaXlsx.gerar(abas()));
            // troca atomica: o Drive nunca sincroniza um arquivo pela metade
            Files.move(temporario, destino, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            manterUltimos(pasta);
            situacao = new Situacao("ok", "Backup enviado para o Google Drive.", destino.toString(), agora());
            log.info("backup de dados gravado no Google Drive: {}", destino);
        } catch (IOException | SQLException | RuntimeException erro) {
            situacao = new Situacao("erro", "Não foi possível gravar o backup no Google Drive.", null, agora());
            log.warn("falha no backup para o Google Drive", erro);
        }
        return situacao;
    }

    Optional<Path> pastaDestino() {
        if (!pastaConfigurada.isEmpty()) {
            return Optional.of(Path.of(pastaConfigurada));
        }
        if (!bancoOperacional) {
            return Optional.empty();
        }
        List<Path> candidatas = new ArrayList<>();
        for (File unidade : File.listRoots()) {
            candidatas.add(unidade.toPath().resolve("Meu Drive"));
            candidatas.add(unidade.toPath().resolve("My Drive"));
        }
        // modo "espelhar arquivos" do Drive para computador
        Path usuario = Path.of(System.getProperty("user.home"));
        candidatas.add(usuario.resolve("Meu Drive"));
        candidatas.add(usuario.resolve("My Drive"));
        candidatas.add(usuario.resolve("Google Drive").resolve("Meu Drive"));
        candidatas.add(usuario.resolve("Google Drive").resolve("My Drive"));
        return candidatas.stream().filter(Files::isDirectory).findFirst();
    }

    /** Uma aba por tabela, sem os arquivos das notas fiscais. */
    List<PlanilhaXlsx.Aba> abas() throws SQLException {
        List<PlanilhaXlsx.Aba> abas = new ArrayList<>();
        abas.add(aba("Contas", """
                SELECT c.id_conta AS "Código", strftime('%d/%m/%Y', c.vencimento) AS "Vencimento", c.nome_empresa AS "Empresa / fornecedor",
                       e.razao_social AS "Empresa emissora", c.numero_documento AS "Documento",
                       c.valor_centavos / 100.0 AS "Valor (R$)", c.status AS "Situação",
                       CASE c.boleto_na_pasta WHEN 1 THEN 'Sim' ELSE 'Não' END AS "Na pasta",
                       c.forma_pagamento AS "Cobrança", c.tipo_pessoa AS "PF/PJ", c.pagador_responsavel AS "Pagador",
                       c.categoria AS "Categoria",
                       CASE WHEN c.anexo_pdf IS NOT NULL THEN c.anexo_nome
                            WHEN c.anexo_removido_em IS NOT NULL THEN c.anexo_nome || ' (arquivo apagado em ' || c.anexo_removido_em || ')'
                            WHEN c.sem_nota_fiscal = 1 THEN 'Sem nota fiscal' ELSE '' END AS "Nota fiscal",
                       c.id_recorrente AS "Código recorrência", c.criado_em AS "Cadastrada em"
                FROM contas_a_pagar c LEFT JOIN empresas e ON e.id_empresa = c.id_empresa
                ORDER BY c.vencimento, c.id_conta"""));
        abas.add(aba("Pagamentos", """
                SELECT p.id_pagamento AS "Código", p.id_conta AS "Código da conta", c.nome_empresa AS "Empresa",
                       strftime('%d/%m/%Y', p.data_pagamento) AS "Data do pagamento", p.valor_pago_centavos / 100.0 AS "Valor pago (R$)",
                       b.instituicao AS "Banco", p.criado_em AS "Registrado em"
                FROM pagamentos p LEFT JOIN contas_a_pagar c ON c.id_conta = p.id_conta
                LEFT JOIN bancos b ON b.id_banco = p.id_banco ORDER BY p.data_pagamento"""));
        abas.add(aba("Contas fixas", """
                SELECT id_recorrente AS "Código", nome_empresa AS "Empresa", valor_centavos / 100.0 AS "Valor (R$)",
                       dia AS "Dia", periodicidade AS "Periodicidade", forma_pagamento AS "Cobrança",
                       tipo_pessoa AS "PF/PJ", pagador_responsavel AS "Pagador", categoria AS "Categoria",
                       numero_documento AS "Documento", CASE ativo WHEN 1 THEN 'Sim' ELSE 'Não' END AS "Ativa"
                FROM boletos_recorrentes ORDER BY nome_empresa"""));
        abas.add(aba("Empresas", """
                SELECT e.id_empresa AS "Código", e.razao_social AS "Razão social", e.cnpj AS "CNPJ",
                       e.nome_representante AS "Representante", e.email AS "E-mail", e.logradouro AS "Endereço",
                       (SELECT group_concat(t.numero || COALESCE(' (' || t.tipo || ')', ''), ' / ')
                          FROM telefones_empresa t WHERE t.id_empresa = e.id_empresa) AS "Telefones"
                FROM empresas e ORDER BY e.razao_social"""));
        abas.add(aba("Pagadores", """
                SELECT id_pagador AS "Código", nome AS "Nome", cpf AS "CPF", funcao AS "Função"
                FROM pagadores ORDER BY nome"""));
        abas.add(aba("Bancos", """
                SELECT id_banco AS "Código", instituicao AS "Instituição", chave_pix AS "Chave Pix"
                FROM bancos ORDER BY instituicao"""));
        abas.add(aba("Mensagens", """
                SELECT id_aviso AS "Código", strftime('%d/%m/%Y', data_inicio) AS "Início", strftime('%d/%m/%Y', data_fim) AS "Fim", dia_semana AS "Dias",
                       titulo AS "Título", mensagem AS "Mensagem" FROM avisos ORDER BY data_inicio"""));
        return abas;
    }

    private PlanilhaXlsx.Aba aba(String nome, String sql) throws SQLException {
        try (Connection conn = conexao.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            ResultSetMetaData meta = rs.getMetaData();
            List<String> cabecalho = new ArrayList<>();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                cabecalho.add(meta.getColumnLabel(i));
            }
            List<List<Object>> linhas = new ArrayList<>();
            while (rs.next()) {
                List<Object> linha = new ArrayList<>();
                for (int i = 1; i <= meta.getColumnCount(); i++) {
                    Object v = rs.getObject(i);
                    if (v instanceof Double d) {
                        v = BigDecimal.valueOf(d).setScale(2, java.math.RoundingMode.HALF_UP);
                    } else if (v != null && meta.getColumnType(i) == Types.VARCHAR && !(v instanceof String)) {
                        v = v.toString();
                    }
                    linha.add(v);
                }
                linhas.add(linha);
            }
            return new PlanilhaXlsx.Aba(nome, cabecalho, linhas);
        }
    }

    /** Mantem so as 30 planilhas mais recentes (uma por dia de uso). */
    private void manterUltimos(Path pasta) throws IOException {
        try (Stream<Path> arquivos = Files.list(pasta)) {
            List<Path> antigos = arquivos
                    .filter(p -> p.getFileName().toString().startsWith(PREFIXO) && p.toString().endsWith(".xlsx"))
                    .sorted(Comparator.comparing((Path p) -> p.getFileName().toString()).reversed())
                    .skip(MANTER)
                    .toList();
            for (Path antigo : antigos) {
                Files.deleteIfExists(antigo);
            }
        }
    }

    private static String agora() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }
}

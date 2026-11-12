package com.chaveiro.service;

import com.chaveiro.database.ConnectionFactory;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Limpeza trimestral das notas fiscais (pedido do usuario, 2026-11-12): a cada
 * 3 meses, ao abrir o sistema, apaga o ARQUIVO da nota das contas ja PAGAS com
 * vencimento ha mais de 3 meses. A conta e todos os seus dados ficam; so o
 * arquivo sai do banco, e a data da remocao fica registrada em
 * anexo_removido_em. Contas pendentes mantem a nota (ela ainda serve para pagar).
 */
@Service
public class LimpezaAnexosService {

    private static final Logger log = LoggerFactory.getLogger(LimpezaAnexosService.class);

    static final String CHAVE_ULTIMA = "ultima_limpeza_anexos";
    static final int MESES = 3;

    private final ConnectionFactory conexao;

    public LimpezaAnexosService(ConnectionFactory conexao) {
        this.conexao = conexao;
    }

    /** Roda a limpeza se nunca rodou ou se a ultima foi ha 3 meses ou mais. */
    public int limparSeNecessario(LocalDate hoje) {
        try {
            String ultima = lerManutencao(CHAVE_ULTIMA);
            if (ultima != null && LocalDate.parse(ultima).plusMonths(MESES).isAfter(hoje)) {
                return 0;
            }
            int removidas = limpar(hoje);
            gravarManutencao(CHAVE_ULTIMA, hoje.toString());
            return removidas;
        } catch (SQLException erro) {
            // a limpeza nunca impede o sistema de abrir
            log.warn("limpeza trimestral das notas nao concluida", erro);
            return 0;
        }
    }

    /** Apaga os arquivos das notas de contas PAGAS vencidas ha mais de 3 meses. */
    public int limpar(LocalDate hoje) throws SQLException {
        String sql = "UPDATE contas_a_pagar SET anexo_pdf = NULL, anexo_removido_em = ?"
                + " WHERE anexo_pdf IS NOT NULL AND status = 'PAGO' AND vencimento < ?";
        int removidas;
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, hoje.toString());
            stmt.setString(2, hoje.minusMonths(MESES).toString());
            removidas = stmt.executeUpdate();
        }
        if (removidas > 0) {
            // devolve ao disco o espaco das notas apagadas
            try (Connection conn = conexao.getConnection(); Statement stmt = conn.createStatement()) {
                stmt.execute("VACUUM");
            }
        }
        log.info("limpeza trimestral: {} nota(s) fiscal(is) antiga(s) removida(s)", removidas);
        return removidas;
    }

    private String lerManutencao(String chave) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT valor FROM manutencao WHERE chave = ?")) {
            stmt.setString(1, chave);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        }
    }

    private void gravarManutencao(String chave, String valor) throws SQLException {
        try (Connection conn = conexao.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO manutencao (chave, valor) VALUES (?, ?)"
                             + " ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")) {
            stmt.setString(1, chave);
            stmt.setString(2, valor);
            stmt.executeUpdate();
        }
    }
}

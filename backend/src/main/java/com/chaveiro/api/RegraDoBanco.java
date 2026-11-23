package com.chaveiro.api;

import java.sql.SQLException;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Gatilho do SQLite que recusou uma gravacao ("RAISE(ABORT, 'CODIGO: motivo')"): vira uma
 * mensagem clara para a tela (409) em vez de "erro interno" (500). Os gatilhos sao a ultima
 * linha de defesa; o servico normalmente ja recusou antes, com mensagem propria.
 * Arquivo IGUAL nos dois sistemas.
 */
final class RegraDoBanco {

    private static final Pattern CODIGO = Pattern.compile("\\b([A-Z][A-Z_]{4,}): ([^)\\]]+)");

    private static final Map<String, String> MENSAGENS = Map.ofEntries(
            Map.entry("NFCE_EMITIDA", "Esta garantia já tem NFC-e emitida no RM: ela não pode ser excluída e o cupom não pode ser alterado."),
            Map.entry("DATA_INVALIDA", "Data inválida: confira o dia, o mês e o ano."),
            Map.entry("DATA_FUTURA", "A data não pode ser no futuro."),
            Map.entry("TEXTO_LONGO", "Um dos textos está grande demais. Encurte e salve de novo."),
            Map.entry("VALOR_INVALIDO", "Valor inválido (o máximo é R$ 999.999.999,99)."),
            Map.entry("LEGADO_IMUTAVEL", "As linhas importadas da planilha antiga ficam como vieram e não podem ser alteradas."),
            Map.entry("CODIGO_IMUTAVEL", "Esse código já foi usado. Peça um código novo."),
            Map.entry("AUDITORIA_SOMENTE_LEITURA", "O histórico de alterações não pode ser mudado nem apagado."),
            Map.entry("PLACA_INVALIDA", "Placa inválida: use ABC1234 (antiga) ou ABC1D23 (Mercosul)."),
            Map.entry("CPF_INVALIDO", "CPF inválido: os dígitos verificadores não conferem."));

    private RegraDoBanco() {
    }

    /** Mensagem para a tela, se a causa do erro foi um gatilho do banco. */
    static Optional<String> mensagem(Throwable erro) {
        for (Throwable t = erro; t != null; t = t.getCause()) {
            if (t instanceof SQLException && t.getMessage() != null && t.getMessage().contains("SQLITE_CONSTRAINT")) {
                Matcher m = CODIGO.matcher(t.getMessage());
                if (m.find()) {
                    return Optional.of(MENSAGENS.getOrDefault(m.group(1), "O banco de dados recusou a gravação: " + m.group(2).trim()));
                }
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return Optional.empty();
    }
}

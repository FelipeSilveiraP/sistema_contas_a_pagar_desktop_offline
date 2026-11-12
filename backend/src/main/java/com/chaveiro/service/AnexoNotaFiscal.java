package com.chaveiro.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Validacao da nota fiscal anexada a uma conta. O tipo e decidido pelo
 * CONTEUDO (assinatura/"magic bytes"), nunca pela extensao ou pelo
 * Content-Type enviados (OWASP File Upload). Aceita PDF, JPG, PNG, WEBP e
 * Word .docx; recusa .docm/.doc (macros) e PDF com JavaScript/Launch.
 */
public final class AnexoNotaFiscal {

    /** 10 MB: limite usual para documentos e fotos de celular. */
    public static final int LIMITE_BYTES = 10 * 1024 * 1024;

    /** Teto descompactado do .docx (protege contra "zip bomb"). */
    private static final long LIMITE_DESCOMPACTADO = 60L * 1024 * 1024;
    private static final int LIMITE_ENTRADAS_ZIP = 2000;

    public enum Tipo {
        PDF("pdf", "application/pdf"),
        JPG("jpg", "image/jpeg"),
        PNG("png", "image/png"),
        WEBP("webp", "image/webp"),
        DOCX("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

        public final String extensao;
        public final String mime;

        Tipo(String extensao, String mime) {
            this.extensao = extensao;
            this.mime = mime;
        }
    }

    private AnexoNotaFiscal() {
    }

    /** Tipo pelo conteudo; vazio se nao for um formato aceito. */
    public static Optional<Tipo> detectar(byte[] b) {
        if (b == null || b.length < 12) {
            return Optional.empty();
        }
        if (b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') {
            return Optional.of(Tipo.PDF);
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return Optional.of(Tipo.JPG);
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return Optional.of(Tipo.PNG);
        }
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return Optional.of(Tipo.WEBP);
        }
        if (b[0] == 'P' && b[1] == 'K' && b[2] == 3 && b[3] == 4) {
            return Optional.of(Tipo.DOCX);
        }
        return Optional.empty();
    }

    /** Mensagem de erro para o usuario, ou vazio se o arquivo for aceito. */
    public static Optional<String> validar(byte[] bytes) {
        if (bytes.length > LIMITE_BYTES) {
            return Optional.of("O arquivo deve ter no máximo 10 MB.");
        }
        Optional<Tipo> tipo = detectar(bytes);
        if (tipo.isEmpty()) {
            return Optional.of("Formato não aceito. Envie PDF, foto (JPG, PNG ou WEBP) ou Word (.docx).");
        }
        return switch (tipo.get()) {
            case PDF -> pdfPerigoso(bytes)
                    ? Optional.of("Este PDF contém código executável e foi recusado. Gere o PDF de novo ou envie uma foto.")
                    : Optional.empty();
            case DOCX -> docxValido(bytes)
                    ? Optional.empty()
                    : Optional.of("O arquivo Word está corrompido ou contém macros. Salve como .docx comum ou envie um PDF.");
            default -> Optional.empty();
        };
    }

    /** Nome com a extensao do tipo REAL (ex.: "nota.exe.pdf" -> "nota.exe.pdf"; "foto.pdf" com JPG -> "foto.jpg"). */
    public static String nomeComExtensao(String nome, Tipo tipo) {
        String base = nome == null || nome.isBlank() ? "nota-fiscal" : nome.trim();
        base = base.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        int ponto = base.lastIndexOf('.');
        if (ponto > 0) {
            base = base.substring(0, ponto);
        }
        if (base.length() > 180) {
            base = base.substring(0, 180);
        }
        return base + "." + tipo.extensao;
    }

    private static boolean pdfPerigoso(byte[] bytes) {
        // ISO-8859-1 preserva 1 byte = 1 char: busca simples pelas acoes ativas
        String conteudo = new String(bytes, StandardCharsets.ISO_8859_1);
        return conteudo.contains("/JavaScript") || conteudo.contains("/Launch");
    }

    private static boolean docxValido(byte[] bytes) {
        boolean temDocumento = false;
        boolean temTipos = false;
        long total = 0;
        int entradas = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entrada;
            while ((entrada = zip.getNextEntry()) != null) {
                if (++entradas > LIMITE_ENTRADAS_ZIP) {
                    return false;
                }
                String nome = entrada.getName().toLowerCase(Locale.ROOT);
                if (nome.equals("word/document.xml")) {
                    temDocumento = true;
                }
                if (nome.equals("[content_types].xml")) {
                    temTipos = true;
                }
                if (nome.endsWith("vbaproject.bin") || nome.endsWith(".bin") && nome.contains("activex")) {
                    return false;
                }
                int lidos;
                while ((lidos = zip.read(buffer)) > 0) {
                    total += lidos;
                    if (total > LIMITE_DESCOMPACTADO) {
                        return false;
                    }
                }
            }
        } catch (IOException | IllegalArgumentException erro) {
            return false;
        }
        return temDocumento && temTipos;
    }
}

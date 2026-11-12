package com.chaveiro.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Gera uma planilha Excel (.xlsx) simples, sem dependencias: o formato e um zip
 * de XMLs (Office Open XML). Uma aba por tabela, cabecalho em negrito, numeros
 * como numero (somaveis no Excel) e o resto como texto.
 */
public final class PlanilhaXlsx {

    public record Aba(String nome, List<String> cabecalho, List<List<Object>> linhas) {}

    private PlanilhaXlsx() {
    }

    public static byte[] gerar(List<Aba> abas) throws IOException {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(saida)) {
            StringBuilder tipos = new StringBuilder("""
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                    <Default Extension="xml" ContentType="application/xml"/>
                    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                    """);
            StringBuilder planilhas = new StringBuilder();
            StringBuilder relacoes = new StringBuilder();
            for (int i = 1; i <= abas.size(); i++) {
                tipos.append("<Override PartName=\"/xl/worksheets/sheet").append(i)
                        .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\n");
                planilhas.append("<sheet name=\"").append(xml(nomeAba(abas.get(i - 1).nome())))
                        .append("\" sheetId=\"").append(i).append("\" r:id=\"rId").append(i).append("\"/>");
                relacoes.append("<Relationship Id=\"rId").append(i)
                        .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                        .append(i).append(".xml\"/>");
            }
            int idEstilos = abas.size() + 1;
            relacoes.append("<Relationship Id=\"rId").append(idEstilos)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
            tipos.append("</Types>");

            escrever(zip, "[Content_Types].xml", tipos.toString());
            escrever(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                    </Relationships>""");
            escrever(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                    + "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\""
                    + " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>"
                    + planilhas + "</sheets></workbook>");
            escrever(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                    + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                    + relacoes + "</Relationships>");
            escrever(zip, "xl/styles.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                    <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
                    <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
                    <borders count="1"><border/></borders>
                    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                    <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
                    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                    </styleSheet>""");
            for (int i = 1; i <= abas.size(); i++) {
                escrever(zip, "xl/worksheets/sheet" + i + ".xml", folha(abas.get(i - 1)));
            }
        }
        return saida.toByteArray();
    }

    private static String folha(Aba aba) {
        StringBuilder sb = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n"
                + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
                + "<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>"
                + "<sheetData>");
        linha(sb, 1, List.copyOf(aba.cabecalho()), true);
        int r = 2;
        for (List<Object> valores : aba.linhas()) {
            linha(sb, r++, valores, false);
        }
        return sb.append("</sheetData></worksheet>").toString();
    }

    private static void linha(StringBuilder sb, int r, List<?> valores, boolean cabecalho) {
        sb.append("<row r=\"").append(r).append("\">");
        for (int c = 0; c < valores.size(); c++) {
            Object v = valores.get(c);
            if (v == null) {
                continue;
            }
            String ref = coluna(c) + r;
            if (v instanceof Number numero && !cabecalho) {
                // valores em reais com 2 casas (formato 4 = #,##0.00)
                sb.append("<c r=\"").append(ref).append("\" s=\"2\"><v>").append(numero).append("</v></c>");
            } else {
                sb.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"").append(cabecalho ? " s=\"1\"" : "")
                        .append("><is><t xml:space=\"preserve\">").append(xml(String.valueOf(v))).append("</t></is></c>");
            }
        }
        sb.append("</row>");
    }

    /** 0 -> A, 25 -> Z, 26 -> AA ... */
    static String coluna(int indice) {
        StringBuilder s = new StringBuilder();
        for (int n = indice + 1; n > 0; n = (n - 1) / 26) {
            s.insert(0, (char) ('A' + (n - 1) % 26));
        }
        return s.toString();
    }

    /** Nome de aba valido no Excel: ate 31 caracteres, sem : \ / ? * [ ] */
    private static String nomeAba(String nome) {
        String limpo = nome.replaceAll("[:\\\\/?*\\[\\]]", "_");
        return limpo.length() > 31 ? limpo.substring(0, 31) : limpo;
    }

    /** Escapa XML e remove caracteres de controle invalidos em XML 1.0. */
    private static String xml(String texto) {
        StringBuilder sb = new StringBuilder(texto.length());
        for (char ch : texto.toCharArray()) {
            switch (ch) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                default -> {
                    if (ch >= 0x20 || ch == '\t' || ch == '\n' || ch == '\r') {
                        sb.append(ch);
                    }
                }
            }
        }
        return sb.toString();
    }

    private static void escrever(ZipOutputStream zip, String nome, String conteudo) throws IOException {
        zip.putNextEntry(new ZipEntry(nome));
        zip.write(conteudo.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}

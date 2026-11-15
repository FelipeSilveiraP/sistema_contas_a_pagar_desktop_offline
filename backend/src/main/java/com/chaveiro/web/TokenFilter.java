package com.chaveiro.web;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Porta de entrada de TODAS as rotas: sem o token aleatorio que o Electron gera
 * a cada abertura, a resposta e 401. Tambem recusa corpos grandes demais (413)
 * antes de o Spring ler a requisicao e acrescenta cabecalhos de seguranca.
 */
@Component
public class TokenFilter extends OncePerRequestFilter {

    /** Token minimo aceito: o Electron gera 48 caracteres; vazio/curto = configuracao errada. */
    static final int TAMANHO_MINIMO_TOKEN = 16;

    /**
     * Maior corpo aceito: nota de 10 MB vira ~13,4 MB em base64 dentro do JSON,
     * mais os campos de texto. Acima disso so pode ser erro ou abuso.
     */
    public static final long LIMITE_CORPO_BYTES = 15L * 1024 * 1024;

    @Value("${findesk.api-token}")
    private String tokenEsperado;

    /** Falha fechada: sem token forte o backend nem sobe (nunca aceita token vazio). */
    @PostConstruct
    void conferirToken() {
        if (tokenEsperado == null || tokenEsperado.isBlank() || tokenEsperado.length() < TAMANHO_MINIMO_TOKEN) {
            throw new IllegalStateException("FINDESK_API_TOKEN ausente ou curto demais: o backend nao sobe sem token");
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest requisicao, HttpServletResponse resposta,
                                    FilterChain cadeia) throws ServletException, IOException {
        resposta.setHeader("X-Content-Type-Options", "nosniff");
        resposta.setHeader("Cache-Control", "no-store");

        if ("OPTIONS".equalsIgnoreCase(requisicao.getMethod())) {
            cadeia.doFilter(requisicao, resposta);
            return;
        }

        String tokenRecebido = requisicao.getHeader("X-FinDesk-Token");
        boolean valido = tokenRecebido != null
                && MessageDigest.isEqual(tokenRecebido.getBytes(StandardCharsets.UTF_8),
                                          tokenEsperado.getBytes(StandardCharsets.UTF_8));

        if (!valido) {
            responder(resposta, HttpServletResponse.SC_UNAUTHORIZED, "nao autorizado");
            return;
        }
        if (requisicao.getContentLengthLong() > LIMITE_CORPO_BYTES) {
            responder(resposta, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "requisicao grande demais");
            return;
        }
        if (requisicao.getContentLengthLong() < 0 && requisicao.getHeader("Transfer-Encoding") != null) {
            // corpo sem tamanho declarado (chunked) escaparia do limite acima; a tela sempre envia o tamanho
            responder(resposta, HttpServletResponse.SC_LENGTH_REQUIRED, "tamanho da requisicao obrigatorio");
            return;
        }
        cadeia.doFilter(requisicao, resposta);
    }

    private static void responder(HttpServletResponse resposta, int status, String erro) throws IOException {
        resposta.setStatus(status);
        resposta.setContentType("application/json;charset=UTF-8");
        resposta.getWriter().write("{\"erro\":\"" + erro + "\"}");
    }
}

package com.chaveiro.web;

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

@Component
public class TokenFilter extends OncePerRequestFilter {

    @Value("${findesk.api-token}")
    private String tokenEsperado;

    @Override
    protected void doFilterInternal(HttpServletRequest requisicao, HttpServletResponse resposta,
                                    FilterChain cadeia) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(requisicao.getMethod())) {
            cadeia.doFilter(requisicao, resposta);
            return;
        }

        String tokenRecebido = requisicao.getHeader("X-FinDesk-Token");
        boolean valido = tokenRecebido != null
                && MessageDigest.isEqual(tokenRecebido.getBytes(StandardCharsets.UTF_8),
                                          tokenEsperado.getBytes(StandardCharsets.UTF_8));

        if (valido) {
            cadeia.doFilter(requisicao, resposta);
            return;
        }

        resposta.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        resposta.setContentType("application/json;charset=UTF-8");
        resposta.getWriter().write("{\"erro\":\"nao autorizado\"}");
    }
}

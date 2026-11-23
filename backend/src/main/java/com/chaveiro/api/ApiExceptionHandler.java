package com.chaveiro.api;

import com.chaveiro.service.AcessoNegadoException;
import com.chaveiro.service.ConflitoIntegridadeException;
import com.chaveiro.service.DadosInvalidosException;
import com.chaveiro.service.PossivelDuplicataException;
import com.chaveiro.service.RecursoNaoEncontradoException;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.ErrorResponse;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /** Contas: 401 (sem sessao/PIN errado), 403 (so admin), 423 (bloqueada). */
    @ExceptionHandler(AcessoNegadoException.class)
    public ResponseEntity<Map<String, Object>> acessoNegado(AcessoNegadoException erro) {
        Map<String, Object> corpo = new LinkedHashMap<>(erro.getExtra());
        corpo.put("erro", erro.getMessage());
        return ResponseEntity.status(erro.getStatus()).body(corpo);
    }

    @ExceptionHandler(DadosInvalidosException.class)
    public ResponseEntity<Map<String, Object>> validacao(DadosInvalidosException erro) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("erro", "dados invalidos");
        corpo.put("campos", erro.getCampos());
        return ResponseEntity.badRequest().body(corpo);
    }

    /** Corpo da requisicao ilegivel (JSON malformado, texto fora de UTF-8): 400, nao 500. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> corpoInvalido(HttpMessageNotReadableException erro) {
        log.warn("requisicao com corpo ilegivel recusada: {}", erro.getMostSpecificCause().getClass().getSimpleName());
        return ResponseEntity.badRequest().body(Map.of("erro", "dados invalidos"));
    }

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public ResponseEntity<Map<String, String>> naoEncontrado(RecursoNaoEncontradoException erro) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("erro", erro.getMessage()));
    }

    @ExceptionHandler(ConflitoIntegridadeException.class)
    public ResponseEntity<Map<String, String>> conflito(ConflitoIntegridadeException erro) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("erro", erro.getMessage()));
    }

    @ExceptionHandler(PossivelDuplicataException.class)
    public ResponseEntity<Map<String, Object>> possivelDuplicata(PossivelDuplicataException erro) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("erro", "possivel duplicidade de conta");
        corpo.put("tipo", "possivel_duplicata");
        corpo.put("existente", erro.getExistente());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(corpo);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validacao(MethodArgumentNotValidException erro) {
        return ResponseEntity.badRequest().body(Map.of("erro", "dados invalidos"));
    }

    /** Data em formato errado num filtro (ex.: ?de=abc): 400, nao 500. */
    @ExceptionHandler(DateTimeParseException.class)
    public ResponseEntity<Map<String, String>> dataInvalida(DateTimeParseException erro) {
        log.warn("data invalida recusada");
        return ResponseEntity.badRequest().body(Map.of("erro", "dados invalidos"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> generico(Exception erro) {
        // gatilho do banco recusou (ultima linha de defesa): motivo claro, 409
        var regra = RegraDoBanco.mensagem(erro);
        if (regra.isPresent()) {
            log.warn("gravacao recusada por regra do banco: {}", regra.get());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("erro", regra.get()));
        }
        // Erros do proprio Spring (rota inexistente 404, metodo errado 405, tipo de
        // conteudo errado 415, id que nao e numero 400...): status certo em vez de
        // "erro interno" 500, sem encher o log de ERROR com tentativas invalidas.
        HttpStatus status = null;
        if (erro instanceof ErrorResponse resposta) {
            status = HttpStatus.resolve(resposta.getStatusCode().value());
        } else if (erro instanceof TypeMismatchException) {
            status = HttpStatus.BAD_REQUEST;
        }
        if (status != null && status.is4xxClientError()) {
            log.warn("requisicao recusada ({}): {}", status.value(), erro.getClass().getSimpleName());
            return ResponseEntity.status(status).body(Map.of("erro", "requisicao invalida"));
        }
        log.error("erro nao tratado na API", erro);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("erro", "erro interno"));
    }
}

package com.chaveiro.api;

import com.chaveiro.service.ConflitoIntegridadeException;
import com.chaveiro.service.DadosInvalidosException;
import com.chaveiro.service.PossivelDuplicataException;
import com.chaveiro.service.RecursoNaoEncontradoException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> generico(Exception erro) {
        log.error("erro nao tratado na API", erro);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("erro", "erro interno"));
    }
}

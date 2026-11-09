package com.chaveiro.api;

import com.chaveiro.model.Aviso;
import com.chaveiro.service.AvisoService;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** API REST dos avisos internos. */
@RestController
@RequestMapping("/api/avisos")
public class AvisoController {

    public record AvisoRequest(
            LocalDate dataInicio,
            LocalDate dataFim,
            String diaSemana,
            String titulo,
            String mensagem
    ) {}

    private final AvisoService service;

    public AvisoController(AvisoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Aviso> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public Aviso buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<Aviso> cadastrar(@RequestBody AvisoRequest requisicao) {
        Aviso criado = service.cadastrar(paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/avisos/" + criado.id())).body(criado);
    }

    @PutMapping("/{id}")
    public Aviso atualizar(@PathVariable long id, @RequestBody AvisoRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Aviso paraModelo(AvisoRequest requisicao) {
        return new Aviso(null, requisicao.dataInicio(), requisicao.dataFim(),
                requisicao.diaSemana(), requisicao.titulo(), requisicao.mensagem());
    }
}

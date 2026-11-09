package com.chaveiro.api;

import com.chaveiro.model.BoletoRecorrente;
import com.chaveiro.service.BoletoRecorrenteService;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API REST das contas recorrentes.
 */
@RestController
@RequestMapping("/api/recorrentes")
public class BoletoRecorrenteController {

    public record RecorrenteRequest(
            String nomeEmpresa,
            Long idEmpresa,
            String pagadorResponsavel,
            String categoria,
            String numeroDocumento,
            BigDecimal valor,
            Integer dia,
            String periodicidade,
            String formaPagamento,
            Boolean ativo
    ) {}

    private final BoletoRecorrenteService service;

    public BoletoRecorrenteController(BoletoRecorrenteService service) {
        this.service = service;
    }

    @GetMapping
    public List<BoletoRecorrente> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public BoletoRecorrente buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @PostMapping
    public ResponseEntity<BoletoRecorrente> cadastrar(@RequestBody RecorrenteRequest requisicao) {
        BoletoRecorrente criado = service.cadastrar(paraModelo(requisicao));
        return ResponseEntity.created(URI.create("/api/recorrentes/" + criado.id())).body(criado);
    }

    @PostMapping("/{id}/gerar")
    public Map<String, Object> gerar(@PathVariable long id) {
        int geradas = service.gerarContas(service.buscarPorId(id));
        return Map.of("geradas", geradas);
    }

    @PutMapping("/{id}")
    public BoletoRecorrente atualizar(@PathVariable long id, @RequestBody RecorrenteRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static BoletoRecorrente paraModelo(RecorrenteRequest requisicao) {
        return new BoletoRecorrente(null, requisicao.nomeEmpresa(), requisicao.idEmpresa(),
                requisicao.pagadorResponsavel(), requisicao.categoria(), requisicao.numeroDocumento(),
                requisicao.valor(), requisicao.dia() == null ? 0 : requisicao.dia(),
                requisicao.periodicidade(), requisicao.formaPagamento(),
                !Boolean.FALSE.equals(requisicao.ativo()));
    }
}

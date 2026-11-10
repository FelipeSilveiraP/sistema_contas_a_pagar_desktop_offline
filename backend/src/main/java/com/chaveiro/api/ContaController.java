package com.chaveiro.api;

import com.chaveiro.model.Conta;
import com.chaveiro.service.ContaService;
import com.chaveiro.service.DadosInvalidosException;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API REST das contas a pagar. A logica de validacao vive no servico.
 */
@RestController
@RequestMapping("/api/contas")
public class ContaController {

    public record ContaRequest(
            String nomeEmpresa,
            Long idEmpresa,
            String pagadorResponsavel,
            String tipoPessoa,
            String formaPagamento,
            String categoria,
            String numeroDocumento,
            BigDecimal valor,
            LocalDate vencimento,
            Boolean boletoNaPasta,
            String anexoNome,
            String anexoPdfBase64,
            Boolean forcar
    ) {}

    private final ContaService service;

    public ContaController(ContaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Conta> listar(@RequestParam(required = false) String status,
                             @RequestParam(required = false) Boolean fixas) {
        return Boolean.TRUE.equals(fixas) ? service.listarFixas() : service.listar(status);
    }

    @GetMapping("/{id}")
    public Conta buscar(@PathVariable long id) {
        return service.buscarPorId(id);
    }

    @GetMapping("/{id}/anexo")
    public ResponseEntity<byte[]> baixarAnexo(@PathVariable long id) {
        byte[] pdf = service.buscarAnexoPdf(id);
        Conta conta = service.buscarPorId(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + (conta.anexoNome() == null ? "anexo.pdf" : conta.anexoNome().replace("\"", "")) + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping
    public ResponseEntity<Conta> cadastrar(@RequestBody ContaRequest requisicao) {
        Conta criada = service.cadastrar(paraModelo(requisicao), decodificarAnexo(requisicao),
                Boolean.TRUE.equals(requisicao.forcar()));
        return ResponseEntity.created(URI.create("/api/contas/" + criada.id())).body(criada);
    }

    @PutMapping("/{id}")
    public Conta atualizar(@PathVariable long id, @RequestBody ContaRequest requisicao) {
        return service.atualizar(id, paraModelo(requisicao), decodificarAnexo(requisicao));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }

    private static Conta paraModelo(ContaRequest requisicao) {
        return new Conta(
                null,
                requisicao.nomeEmpresa(),
                requisicao.idEmpresa(),
                null,
                requisicao.pagadorResponsavel(),
                requisicao.tipoPessoa(),
                requisicao.formaPagamento(),
                requisicao.categoria(),
                requisicao.numeroDocumento(),
                requisicao.valor(),
                requisicao.vencimento(),
                Boolean.TRUE.equals(requisicao.boletoNaPasta()),
                requisicao.anexoNome(),
                "PENDENTE"
        );
    }

    private static byte[] decodificarAnexo(ContaRequest requisicao) {
        if (requisicao.anexoPdfBase64() == null || requisicao.anexoPdfBase64().isBlank()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(requisicao.anexoPdfBase64());
        } catch (IllegalArgumentException erro) {
            throw new DadosInvalidosException(Map.of("anexo", "O arquivo anexado está corrompido. Escolha o PDF de novo."));
        }
    }
}

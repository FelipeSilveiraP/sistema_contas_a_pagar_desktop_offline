package com.chaveiro.api;

import com.chaveiro.repository.UsuarioRepository.Acesso;
import com.chaveiro.service.DadosInvalidosException;
import com.chaveiro.service.UsuarioService;
import com.chaveiro.service.UsuarioService.Dados;
import com.chaveiro.service.UsuarioService.Perfil;
import com.chaveiro.service.UsuarioService.Sessao;
import com.chaveiro.service.UsuarioService.Usuario;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Contas de usuario. A sessao vai no header X-Contas-Sessao (token devolvido ao
 * entrar com o PIN); as rotas de administracao conferem no servidor se e o admin.
 */
@RestController
@RequestMapping("/api")
public class UsuarioController {

    static final String SESSAO = "X-Contas-Sessao";
    private static final int LIMITE_FOTO_BASE64 = 1_400_000 + 64;

    public record EntrarRequest(long idUsuario, String pin) {
    }

    /** `emailLoja` so na primeira conta (admin): o e-mail da loja. */
    public record UsuarioRequest(String nome, String login, String email, String pin, Boolean admin, Boolean ativo,
                                 String fotoBase64, String emailLoja) {
        Dados dados() {
            return new Dados(nome, login, email, pin, admin, ativo);
        }
    }

    public record PinRequest(String pinAtual, String novoPin) {
    }

    public record EsqueciRequest(String login) {
    }

    public record RedefinirRequest(String login, String codigo, String novoPin) {
    }

    public record EmailRequest(String remetente, String senhaApp, String destino) {
    }

    public record FotoRequest(String fotoBase64) {
    }

    private final UsuarioService service;

    public UsuarioController(UsuarioService service) {
        this.service = service;
    }

    private static Map<String, Object> sessao(Sessao s) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("token", s.token());
        r.put("id", s.id());
        r.put("nome", s.nome());
        r.put("admin", s.admin());
        return r;
    }

    private static byte[] foto(String base64) {
        if (base64 == null || base64.isBlank()) {
            return null;
        }
        // 1 MB de foto vira ~1,4 MB em base64: recusa antes de decodificar (nao gasta memoria)
        if (base64.length() > LIMITE_FOTO_BASE64) {
            throw new DadosInvalidosException(Map.of("foto", "Foto inválida: use JPG ou PNG de até 1 MB."));
        }
        try {
            return Base64.getDecoder().decode(base64.replaceFirst("^data:[^,]*,", ""));
        } catch (IllegalArgumentException erro) {
            throw new DadosInvalidosException(Map.of("foto", "Foto corrompida. Escolha de novo."));
        }
    }

    // ---------- tela de perfis (sem sessao) ----------

    @GetMapping("/perfis")
    public Map<String, Object> perfis() {
        List<Perfil> perfis = service.perfis();
        return Map.of("primeiroAcesso", service.primeiroAcesso(), "perfis", perfis);
    }

    @GetMapping("/perfis/{id}/foto")
    public ResponseEntity<byte[]> foto(@PathVariable long id) {
        byte[] f = service.foto(id);
        MediaType tipo = (f[0] & 0xFF) == 0x89 ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().contentType(tipo).cacheControl(CacheControl.noStore()).body(f);
    }

    @PostMapping("/perfis/primeiro-admin")
    public ResponseEntity<Map<String, Object>> primeiroAdmin(@RequestBody UsuarioRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sessao(service.criarPrimeiroAdmin(r.dados(), r.emailLoja())));
    }

    @PostMapping("/sessao")
    public Map<String, Object> entrar(@RequestBody EntrarRequest r) {
        return sessao(service.entrar(r.idUsuario(), r.pin()));
    }

    @DeleteMapping("/sessao")
    public ResponseEntity<Void> sair(@RequestHeader(value = SESSAO, required = false) String token) {
        service.sair(token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sessao/esqueci-pin")
    public Map<String, String> esqueci(@RequestBody EsqueciRequest r) {
        return Map.of("enviadoPara", service.esqueciPin(r.login()));
    }

    @PostMapping("/sessao/redefinir-pin")
    public ResponseEntity<Void> redefinir(@RequestBody RedefinirRequest r) {
        service.redefinirPin(r.login(), r.codigo(), r.novoPin());
        return ResponseEntity.noContent().build();
    }

    // ---------- minha conta (qualquer usuario com sessao) ----------

    @GetMapping("/usuarios/eu")
    public Usuario eu(@RequestHeader(value = SESSAO, required = false) String token) {
        return service.eu(token);
    }

    @PutMapping("/usuarios/eu/pin")
    public ResponseEntity<Void> meuPin(@RequestHeader(value = SESSAO, required = false) String token, @RequestBody PinRequest r) {
        service.trocarMeuPin(token, r.pinAtual(), r.novoPin());
        return ResponseEntity.noContent().build();
    }

    // ---------- administrador ----------

    @GetMapping("/usuarios")
    public List<Usuario> listar(@RequestHeader(value = SESSAO, required = false) String token) {
        return service.listar(token);
    }

    @PostMapping("/usuarios")
    public ResponseEntity<Usuario> cadastrar(@RequestHeader(value = SESSAO, required = false) String token, @RequestBody UsuarioRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cadastrar(token, r.dados(), foto(r.fotoBase64())));
    }

    @PutMapping("/usuarios/{id}")
    public Usuario atualizar(@RequestHeader(value = SESSAO, required = false) String token, @PathVariable long id,
                             @RequestBody UsuarioRequest r) {
        return service.atualizar(token, id, r.dados());
    }

    @PutMapping("/usuarios/{id}/pin")
    public ResponseEntity<Void> novoPin(@RequestHeader(value = SESSAO, required = false) String token, @PathVariable long id,
                                        @RequestBody PinRequest r) {
        service.novoPin(token, id, r.novoPin());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/usuarios/{id}/foto")
    public ResponseEntity<Void> trocarFoto(@RequestHeader(value = SESSAO, required = false) String token, @PathVariable long id,
                                           @RequestBody FotoRequest r) {
        service.trocarFoto(token, id, foto(r.fotoBase64()));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/usuarios/{id}")
    public ResponseEntity<Void> excluir(@RequestHeader(value = SESSAO, required = false) String token, @PathVariable long id) {
        service.excluir(token, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/usuarios/acessos")
    public List<Acesso> acessos(@RequestHeader(value = SESSAO, required = false) String token,
                                @RequestParam(required = false) Long id, @RequestParam(defaultValue = "100") int limite) {
        return service.acessos(token, id, limite);
    }

    @GetMapping("/email-config")
    public Map<String, Object> configEmail(@RequestHeader(value = SESSAO, required = false) String token) {
        return service.configEmail(token);
    }

    @PutMapping("/email-config")
    public ResponseEntity<Void> gravarEmail(@RequestHeader(value = SESSAO, required = false) String token, @RequestBody EmailRequest r) {
        service.gravarConfigEmail(token, r.remetente(), r.senhaApp());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email-config/teste")
    public ResponseEntity<Void> testarEmail(@RequestHeader(value = SESSAO, required = false) String token, @RequestBody EmailRequest r) {
        service.testarEmail(token, r.destino());
        return ResponseEntity.noContent().build();
    }
}

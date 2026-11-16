package com.chaveiro.service;

import com.chaveiro.repository.UsuarioRepository;
import com.chaveiro.repository.UsuarioRepository.Acesso;
import com.chaveiro.repository.UsuarioRepository.Linha;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.Map;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Contas de usuario da tela "Quem esta usando?": PIN de 4 a 6 numeros, sessao,
 * bloqueio apos 5 PINs errados, historico de acessos, redefinicao por e-mail
 * (codigo de 6 digitos, 15 minutos) e o administrador, o UNICO que cadastra e
 * edita contas (nome, foto, login, e-mail, PIN). Login, e-mail e PIN nunca ficam
 * em texto no banco (Cripto). As permissoes sao conferidas AQUI, no servidor.
 */
@Service
public class UsuarioService {

    private static final Logger log = LoggerFactory.getLogger(UsuarioService.class);
    static final int MAX_FALHAS = 5;
    static final int MINUTOS_BLOQUEIO = 5;
    static final int MINUTOS_CODIGO = 15;
    /** Bloqueio progressivo: cada bloqueio nas ultimas 24 h dobra o tempo (5, 10, 20... ate 24 h). */
    static final int MINUTOS_BLOQUEIO_MAXIMO = 24 * 60;
    /** "Esqueci o PIN": no maximo 1 codigo por minuto e 5 por hora por conta, 20 por hora no total. */
    static final int SEGUNDOS_ENTRE_CODIGOS = 60;
    static final int CODIGOS_POR_HORA_CONTA = 5;
    static final int CODIGOS_POR_HORA_TOTAL = 20;
    private static final long HORAS_SESSAO = 12;
    private static final int LIMITE_FOTO = 1024 * 1024;
    private static final String CFG_REMETENTE = "email.remetente";
    private static final String CFG_SENHA_APP = "email.senha_app";

    /** O que o admin ve (login e e-mail ja decifrados). */
    public record Usuario(long id, String nome, String login, String email, boolean admin, boolean ativo, boolean temFoto,
                          int acessos, String ultimoAcesso, boolean bloqueado, String criadoEm) {
    }

    /** Bolinha da tela de perfis: sem login nem e-mail. */
    public record Perfil(long id, String nome, boolean temFoto, boolean admin) {
    }

    public record Sessao(String token, long id, String nome, boolean admin, Instant expira) {
    }

    public record Dados(String nome, String login, String email, String pin, Boolean admin, Boolean ativo) {
    }

    private final UsuarioRepository repository;
    private final Cripto cripto;
    private final Carteiro carteiro;
    private final Map<String, Sessao> sessoes = new ConcurrentHashMap<>();

    public UsuarioService(UsuarioRepository repository, Cripto cripto, Carteiro carteiro) {
        this.repository = repository;
        this.cripto = cripto;
        this.carteiro = carteiro;
    }

    private interface Sql<T> {
        T executar() throws SQLException;
    }

    private static <T> T banco(Sql<T> acao) {
        try {
            return acao.executar();
        } catch (SQLException erro) {
            String msg = erro.getMessage() == null ? "" : erro.getMessage();
            if (msg.contains("ULTIMO_ADMIN")) {
                throw new ConflitoIntegridadeException("o sistema precisa de pelo menos um administrador ativo");
            }
            log.error("falha no banco de usuarios", erro);
            throw new IllegalStateException("falha ao acessar as contas", erro);
        }
    }

    // ---------- perfis e entrada ----------

    public boolean primeiroAcesso() {
        return banco(repository::contar) == 0;
    }

    public List<Perfil> perfis() {
        return banco(repository::listar).stream().filter(Linha::ativo)
                .map(l -> new Perfil(l.id(), l.nome(), l.temFoto(), l.admin())).toList();
    }

    public byte[] foto(long id) {
        byte[] f = banco(() -> repository.foto(id));
        if (f == null) {
            throw new RecursoNaoEncontradoException("foto");
        }
        return f;
    }

    /** Primeira abertura: a primeira conta e a do administrador (e so funciona enquanto nao houver contas). */
    public Sessao criarPrimeiroAdmin(Dados d) {
        return criarPrimeiroAdmin(d, null);
    }

    /**
     * Primeira conta (admin). `emailLoja` e o e-mail da loja: vira o e-mail que envia os
     * codigos de "Esqueci o PIN" e recebe uma copia deles (a senha de app vai em CONTAS).
     */
    public synchronized Sessao criarPrimeiroAdmin(Dados d, String emailLoja) {
        if (!primeiroAcesso()) {
            throw new AcessoNegadoException(403, "o administrador ja foi criado");
        }
        String loja = null;
        if (emailLoja != null) {
            loja = emailLoja.trim().toLowerCase(Locale.ROOT);
            if (!emailValido(loja)) {
                throw new DadosInvalidosException(Map.of("emailLoja", loja.isEmpty()
                        ? "Informe o e-mail da loja." : "E-mail da loja inválido. Exemplo: loja@gmail.com"));
            }
        }
        long id = inserir(d, true, null);
        if (loja != null) {
            String lojaCifrado = cripto.cifrar(loja);
            banco(() -> {
                repository.gravarConfig(CFG_REMETENTE, lojaCifrado);
                return null;
            });
        }
        Linha l = banco(() -> repository.buscarPorId(id)).orElseThrow();
        banco(() -> {
            repository.registrarEntrada(id, l.nome());
            return null;
        });
        log.info("primeiro administrador criado (id={})", id);
        return abrirSessao(l);
    }

    /**
     * synchronized: as tentativas de PIN passam uma de cada vez. Sem isso, varios pedidos
     * ao mesmo tempo passariam pela conferencia do bloqueio antes de a 5a falha gravar.
     */
    public synchronized Sessao entrar(long id, String pin) {
        Linha l = banco(() -> repository.buscarPorId(id)).filter(Linha::ativo)
                .orElseThrow(() -> new AcessoNegadoException(401, "conta inexistente ou desativada"));
        if (banco(() -> repository.bloqueada(id))) {
            throw new AcessoNegadoException(423, "conta bloqueada por PINs errados",
                    Map.of("minutos", banco(() -> repository.minutosRestantesBloqueio(id))));
        }
        if (!cripto.conferirPin(textoPin(pin), l.pinHash())) {
            registrarPinErrado(l);
        }
        banco(() -> {
            repository.registrarEntrada(id, l.nome());
            return null;
        });
        return abrirSessao(l);
    }

    /** PIN errado: soma a falha; na 5a bloqueia (tempo dobrando a cada bloqueio do dia). */
    private void registrarPinErrado(Linha l) {
        long id = l.id();
        int bloqueiosHoje = banco(() -> repository.contarEventos(id, "BLOQUEIO", "-24 hours"));
        int minutos = (int) Math.min(MINUTOS_BLOQUEIO_MAXIMO, (long) MINUTOS_BLOQUEIO << Math.min(bloqueiosHoje, 20));
        int falhas = banco(() -> repository.registrarFalha(id, l.nome(), MAX_FALHAS, minutos));
        if (falhas >= MAX_FALHAS) {
            log.warn("conta id={} bloqueada por {} minuto(s) apos {} PINs errados", id, minutos, MAX_FALHAS);
            throw new AcessoNegadoException(423, "conta bloqueada por PINs errados", Map.of("minutos", minutos));
        }
        throw new AcessoNegadoException(401, "PIN incorreto", Map.of("tentativasRestantes", MAX_FALHAS - falhas));
    }

    /** PIN como chegou: so os primeiros 20 caracteres (nao gasta o PBKDF2 com textos enormes). */
    private static String textoPin(String pin) {
        String p = pin == null ? "" : pin.trim();
        return p.length() > 20 ? p.substring(0, 20) : p;
    }

    private Sessao abrirSessao(Linha l) {
        Sessao s = new Sessao(Cripto.tokenAleatorio(), l.id(), l.nome(), l.admin(), Instant.now().plus(HORAS_SESSAO, ChronoUnit.HOURS));
        sessoes.put(s.token(), s);
        return s;
    }

    public void sair(String token) {
        if (token != null) {
            sessoes.remove(token);
        }
    }

    /** Sessao valida de uma conta que continua ativa (desativar/excluir derruba a sessao). */
    public Sessao sessao(String token) {
        Sessao s = token == null ? null : sessoes.get(token);
        if (s == null || s.expira().isBefore(Instant.now())) {
            if (s != null) {
                sessoes.remove(token);
            }
            throw new AcessoNegadoException(401, "entre com o seu perfil e PIN");
        }
        Linha l = banco(() -> repository.buscarPorId(s.id())).filter(Linha::ativo).orElse(null);
        if (l == null) {
            sessoes.remove(token);
            throw new AcessoNegadoException(401, "conta desativada");
        }
        return new Sessao(token, l.id(), l.nome(), l.admin(), s.expira());
    }

    public Sessao exigirAdmin(String token) {
        Sessao s = sessao(token);
        if (!s.admin()) {
            throw new AcessoNegadoException(403, "so o administrador pode fazer isso");
        }
        return s;
    }

    /** Nome do perfil da sessao (para "cadastrada por"), ou nulo sem sessao valida. */
    public String nomeDaSessao(String token) {
        try {
            return token == null ? null : sessao(token).nome();
        } catch (AcessoNegadoException semSessao) {
            return null;
        }
    }

    // ---------- esqueci o PIN (codigo por e-mail) ----------

    /**
     * Envia o codigo para o e-mail da conta E para o e-mail da loja (o Gmail que envia),
     * e devolve para onde foi, mascarado ("f****@gmail.com e l***@gmail.com (loja)").
     * O login e o proprio e-mail da conta.
     */
    public synchronized String esqueciPin(String login) {
        String remetente = banco(() -> repository.config(CFG_REMETENTE)).map(cripto::decifrar).orElse(null);
        String senhaApp = banco(() -> repository.config(CFG_SENHA_APP)).map(cripto::decifrar).orElse(null);
        if (remetente == null || senhaApp == null) {
            throw new DadosInvalidosException(Map.of("email", "O e-mail da loja que envia os códigos ainda não foi configurado. Peça ao administrador."));
        }
        String loginLimpo = login == null ? "" : login.trim();
        if (loginLimpo.length() > 120) {
            throw new DadosInvalidosException(Map.of("login", "E-mail não encontrado. Confira o e-mail da sua conta."));
        }
        // envio em massa: o sistema inteiro manda no maximo 20 codigos por hora
        if (banco(() -> repository.contarCodigos(null, "-1 hour")) >= CODIGOS_POR_HORA_TOTAL) {
            throw new AcessoNegadoException(429, "muitos pedidos de codigo; tente de novo daqui a 1 hora", Map.of("minutos", 60));
        }
        Linha l = banco(() -> repository.buscarPorIndice(cripto.indice(loginLimpo))).filter(Linha::ativo)
                .orElseThrow(() -> new DadosInvalidosException(Map.of("login", "E-mail não encontrado. Confira o e-mail da sua conta.")));
        if (banco(() -> repository.contarCodigos(l.id(), "-" + SEGUNDOS_ENTRE_CODIGOS + " seconds")) > 0) {
            throw new AcessoNegadoException(429, "aguarde 1 minuto para pedir outro codigo", Map.of("minutos", 1));
        }
        if (banco(() -> repository.contarCodigos(l.id(), "-1 hour")) >= CODIGOS_POR_HORA_CONTA) {
            throw new AcessoNegadoException(429, "muitos pedidos de codigo para esta conta; tente daqui a 1 hora", Map.of("minutos", 60));
        }
        String emailConta = cripto.decifrar(l.emailCifrado());
        Set<String> destinos = new LinkedHashSet<>();
        if (emailConta != null && !emailConta.isBlank()) {
            destinos.add(emailConta);
        }
        destinos.add(remetente.toLowerCase(Locale.ROOT));
        String codigo = Cripto.codigoAleatorio();
        banco(() -> {
            repository.criarCodigo(l.id(), cripto.hashCodigo(codigo), MINUTOS_CODIGO);
            return null;
        });
        List<String> enviados = new ArrayList<>();
        for (String destino : destinos) {
            boolean daLoja = destino.equalsIgnoreCase(remetente) && !destino.equalsIgnoreCase(emailConta == null ? "" : emailConta);
            String texto = (daLoja
                    ? "Pedido de PIN novo da conta " + l.nome() + " (cópia para a loja).\n\nO código é: "
                    : "Olá, " + l.nome() + ".\n\nSeu código para criar um novo PIN é: ")
                    + codigo + "\n\nEle vale por " + MINUTOS_CODIGO + " minutos. Se não foi você, ignore este e-mail.\n\nChaveiro Universal";
            try {
                carteiro.enviar(remetente, senhaApp, destino, "Código para criar um novo PIN — Sistema de Contas a Pagar", texto);
                enviados.add(mascarar(destino) + (daLoja ? " (loja)" : ""));
            } catch (RuntimeException erro) {
                log.warn("falha ao enviar o codigo de redefinicao: {}", erro.getClass().getSimpleName());
            }
        }
        if (enviados.isEmpty()) {
            throw new DadosInvalidosException(Map.of("email", "Não foi possível enviar o e-mail. Confira a internet e tente de novo."));
        }
        banco(() -> {
            repository.registrarEvento(l.id(), l.nome(), "CODIGO_ENVIADO");
            return null;
        });
        return String.join(" e ", enviados);
    }

    public synchronized void redefinirPin(String login, String codigo, String novoPin) {
        String pin = validarPin(novoPin);
        Linha l = banco(() -> repository.buscarPorIndice(cripto.indice(login == null ? "" : login))).filter(Linha::ativo)
                .orElseThrow(() -> new DadosInvalidosException(Map.of("codigo", "Código inválido ou vencido.")));
        var c = banco(() -> repository.codigoValido(l.id()))
                .orElseThrow(() -> new DadosInvalidosException(Map.of("codigo", "Código inválido ou vencido. Peça outro.")));
        String digitado = codigo == null ? "" : codigo.trim();
        boolean confere = digitado.matches("\\d{6}") && MessageDigest.isEqual(
                cripto.hashCodigo(digitado).getBytes(StandardCharsets.UTF_8), c.codigoHash().getBytes(StandardCharsets.UTF_8));
        if (!confere) {
            banco(() -> {
                repository.tentativaCodigo(c.id());
                return null;
            });
            throw new DadosInvalidosException(Map.of("codigo", "Código incorreto."));
        }
        banco(() -> repository.atualizarPin(l.id(), cripto.hashPin(pin)));
        banco(() -> {
            repository.registrarEvento(l.id(), l.nome(), "PIN_REDEFINIDO_EMAIL");
            return null;
        });
    }

    static String mascarar(String email) {
        int arroba = email.indexOf('@');
        if (arroba <= 1) {
            return "***" + email.substring(Math.max(arroba, 0));
        }
        return email.charAt(0) + "*".repeat(Math.min(arroba - 1, 6)) + email.substring(arroba);
    }

    // ---------- conta propria (qualquer usuario) ----------

    public Usuario eu(String token) {
        return visao(banco(() -> repository.buscarPorId(sessao(token).id())).orElseThrow());
    }

    public synchronized void trocarMeuPin(String token, String pinAtual, String novoPin) {
        Sessao s = sessao(token);
        Linha l = banco(() -> repository.buscarPorId(s.id())).orElseThrow();
        if (banco(() -> repository.bloqueada(s.id()))) {
            throw new AcessoNegadoException(423, "conta bloqueada por PINs errados",
                    Map.of("minutos", banco(() -> repository.minutosRestantesBloqueio(s.id()))));
        }
        if (!cripto.conferirPin(textoPin(pinAtual), l.pinHash())) {
            // conta como PIN errado: quem achar a sessao aberta nao descobre o PIN chutando
            try {
                registrarPinErrado(l);
            } catch (AcessoNegadoException bloqueio) {
                if (bloqueio.getStatus() == 423) {
                    sessoes.values().removeIf(x -> x.id() == s.id());
                    throw bloqueio;
                }
            }
            throw new DadosInvalidosException(Map.of("pinAtual", "PIN atual incorreto."));
        }
        banco(() -> repository.atualizarPin(s.id(), cripto.hashPin(validarPin(novoPin))));
        banco(() -> {
            repository.registrarEvento(s.id(), s.nome(), "PIN_TROCADO");
            return null;
        });
    }

    // ---------- administrador ----------

    public List<Usuario> listar(String token) {
        exigirAdmin(token);
        return banco(repository::listar).stream().map(this::visao).toList();
    }

    public Usuario cadastrar(String token, Dados d, byte[] foto) {
        exigirAdmin(token);
        long id = inserir(d, Boolean.TRUE.equals(d.admin()), foto);
        return visao(banco(() -> repository.buscarPorId(id)).orElseThrow());
    }

    public Usuario atualizar(String token, long id, Dados d) {
        exigirAdmin(token);
        Linha atual = banco(() -> repository.buscarPorId(id)).orElseThrow(() -> new RecursoNaoEncontradoException("usuario"));
        Map<String, String> erros = new LinkedHashMap<>();
        String nome = d.nome() == null ? atual.nome() : nome(d.nome(), erros);
        // o e-mail e o login: trocar um troca os dois
        boolean trocaEmail = d.email() != null || d.login() != null;
        String login = trocaEmail ? loginEmail(d.email(), d.login(), erros) : cripto.decifrar(atual.loginCifrado());
        String email = trocaEmail ? login : cripto.decifrar(atual.emailCifrado());
        if (!erros.isEmpty()) {
            throw new DadosInvalidosException(erros);
        }
        String indice = cripto.indice(login);
        if (banco(() -> repository.indiceEmUso(indice, id))) {
            throw new DadosInvalidosException(Map.of("email", "Esse e-mail já é de outra conta."));
        }
        boolean admin = d.admin() == null ? atual.admin() : d.admin();
        boolean ativo = d.ativo() == null ? atual.ativo() : d.ativo();
        banco(() -> repository.atualizarDados(id, nome, indice, cripto.cifrar(login), email == null ? null : cripto.cifrar(email), admin, ativo));
        if (!ativo) {
            sessoes.values().removeIf(s -> s.id() == id);
        }
        return visao(banco(() -> repository.buscarPorId(id)).orElseThrow());
    }

    /** So o admin cria um PIN novo para qualquer conta (sem saber o anterior). */
    public void novoPin(String token, long id, String novoPin) {
        exigirAdmin(token);
        Linha l = banco(() -> repository.buscarPorId(id)).orElseThrow(() -> new RecursoNaoEncontradoException("usuario"));
        banco(() -> repository.atualizarPin(id, cripto.hashPin(validarPin(novoPin))));
        banco(() -> {
            repository.registrarEvento(id, l.nome(), "PIN_REDEFINIDO_ADMIN");
            return null;
        });
    }

    public void trocarFoto(String token, long id, byte[] foto) {
        exigirAdmin(token);
        if (foto != null) {
            validarFoto(foto);
        }
        if (!banco(() -> repository.atualizarFoto(id, foto))) {
            throw new RecursoNaoEncontradoException("usuario");
        }
    }

    public void excluir(String token, long id) {
        Sessao s = exigirAdmin(token);
        if (s.id() == id) {
            throw new ConflitoIntegridadeException("voce nao pode excluir a sua propria conta");
        }
        if (!banco(() -> repository.excluir(id))) {
            throw new RecursoNaoEncontradoException("usuario");
        }
        sessoes.values().removeIf(x -> x.id() == id);
    }

    public List<Acesso> acessos(String token, Long id, int limite) {
        exigirAdmin(token);
        return banco(() -> repository.acessos(id, Math.max(1, Math.min(limite, 500))));
    }

    public Map<String, Object> configEmail(String token) {
        exigirAdmin(token);
        String remetente = banco(() -> repository.config(CFG_REMETENTE)).map(cripto::decifrar).orElse(null);
        boolean temSenha = banco(() -> repository.config(CFG_SENHA_APP)).isPresent();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("remetente", remetente);
        r.put("configurado", remetente != null && temSenha);
        return r;
    }

    public void gravarConfigEmail(String token, String remetente, String senhaApp) {
        exigirAdmin(token);
        Map<String, String> erros = new LinkedHashMap<>();
        String r = email(remetente, erros);
        String senha = senhaApp == null ? "" : senhaApp.replace(" ", "");
        if (r == null) {
            erros.put("remetente", "Informe o Gmail da loja.");
        }
        if (!senha.matches("[A-Za-z]{16}")) {
            erros.put("senhaApp", "A senha de app do Google tem 16 letras.");
        }
        if (!erros.isEmpty()) {
            throw new DadosInvalidosException(erros);
        }
        banco(() -> {
            repository.gravarConfig(CFG_REMETENTE, cripto.cifrar(r));
            repository.gravarConfig(CFG_SENHA_APP, cripto.cifrar(senha));
            return null;
        });
    }

    public void testarEmail(String token, String destino) {
        exigirAdmin(token);
        Map<String, String> erros = new LinkedHashMap<>();
        String para = email(destino, erros);
        if (para == null || !erros.isEmpty()) {
            throw new DadosInvalidosException(Map.of("destino", "Informe o e-mail que vai receber o teste."));
        }
        String remetente = banco(() -> repository.config(CFG_REMETENTE)).map(cripto::decifrar)
                .orElseThrow(() -> new DadosInvalidosException(Map.of("remetente", "Grave o Gmail e a senha de app primeiro.")));
        String senha = banco(() -> repository.config(CFG_SENHA_APP)).map(cripto::decifrar).orElseThrow();
        try {
            carteiro.enviar(remetente, senha, para, "Teste — Sistema de Contas a Pagar", "O envio de e-mails do Sistema de Contas a Pagar está funcionando.");
        } catch (RuntimeException erro) {
            log.warn("teste de e-mail falhou: {}", erro.getClass().getSimpleName());
            throw new DadosInvalidosException(Map.of("destino", "Não foi possível enviar. Confira o Gmail, a senha de app e a internet."));
        }
    }

    // ---------- validacao ----------

    private long inserir(Dados d, boolean admin, byte[] foto) {
        Map<String, String> erros = new LinkedHashMap<>();
        String nome = nome(d.nome(), erros);
        String login = loginEmail(d.email(), d.login(), erros);
        String email = login;
        String pin = null;
        try {
            pin = validarPin(d.pin());
        } catch (DadosInvalidosException e) {
            erros.putAll(e.getCampos());
        }
        if (foto != null) {
            try {
                validarFoto(foto);
            } catch (DadosInvalidosException e) {
                erros.putAll(e.getCampos());
            }
        }
        if (!erros.isEmpty()) {
            throw new DadosInvalidosException(erros);
        }
        String indice = cripto.indice(login);
        if (banco(() -> repository.indiceEmUso(indice, null))) {
            throw new DadosInvalidosException(Map.of("email", "Esse e-mail já é de outra conta."));
        }
        String hash = cripto.hashPin(pin);
        return banco(() -> repository.inserir(nome, indice, cripto.cifrar(login), email == null ? null : cripto.cifrar(email), hash, admin, foto));
    }

    private static String nome(String nome, Map<String, String> erros) {
        String n = nome == null ? "" : semControle(nome).trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
        if (n.length() < 2 || n.length() > 40) {
            erros.put("nome", "Informe o nome (de 2 a 40 letras).");
        }
        return n;
    }

    /** O login e o e-mail da pessoa: qualquer e-mail valido (Gmail, Hotmail, da empresa...). */
    private static String loginEmail(String email, String login, Map<String, String> erros) {
        String valor = email != null && !email.isBlank() ? email : login;
        String e = valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
        if (e.isEmpty()) {
            erros.put("email", "Informe o e-mail (ele é o login da conta).");
        } else if (!emailValido(e)) {
            erros.put("email", "E-mail inválido. Exemplo: nome@gmail.com");
        }
        return e;
    }

    /**
     * E-mail simples (algo@algo.algo), ate 120 letras, sem espaco, quebra de linha ou
     * caractere de controle (impede injecao de cabecalho no e-mail enviado).
     */
    static boolean emailValido(String e) {
        return e.length() <= 120 && e.matches("[^\\s@\\p{Cntrl}<>,;\"]+@[^\\s@\\p{Cntrl}<>,;\"]+\\.[^\\s@\\p{Cntrl}<>,;\"]+");
    }

    /** Tira caracteres de controle (quebras de linha, NUL, ESC...): o texto vira uma linha so. */
    static String semControle(String texto) {
        return texto.replaceAll("\\p{Cntrl}", " ");
    }

    private static String email(String email, Map<String, String> erros) {
        String e = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (e.isEmpty()) {
            return null;
        }
        if (!emailValido(e)) {
            erros.put("email", "E-mail inválido.");
        }
        return e;
    }

    static String validarPin(String pin) {
        String p = pin == null ? "" : pin.trim();
        if (!p.matches("\\d{4,6}")) {
            throw new DadosInvalidosException(Map.of("pin", "O PIN tem de 4 a 6 números."));
        }
        return p;
    }

    /** Tipo REAL pelo comeco do arquivo ("magic bytes"), nao pelo nome: PNG ou JPEG. */
    static void validarFoto(byte[] foto) {
        byte[] assinaturaPng = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
        boolean png = foto.length > 8 && java.util.Arrays.equals(foto, 0, 8, assinaturaPng, 0, 8);
        boolean jpg = foto.length > 3 && (foto[0] & 0xFF) == 0xFF && (foto[1] & 0xFF) == 0xD8 && (foto[2] & 0xFF) == 0xFF;
        if (foto.length > LIMITE_FOTO || !(png || jpg)) {
            throw new DadosInvalidosException(Map.of("foto", "Foto inválida: use JPG ou PNG de até 1 MB."));
        }
    }

    private Usuario visao(Linha l) {
        boolean bloqueado = banco(() -> repository.bloqueada(l.id()));
        return new Usuario(l.id(), l.nome(), cripto.decifrar(l.loginCifrado()), cripto.decifrar(l.emailCifrado()), l.admin(),
                l.ativo(), l.temFoto(), l.acessos(), l.ultimoAcesso(), bloqueado, l.criadoEm());
    }
}

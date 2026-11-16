package com.chaveiro.service;

import com.chaveiro.database.ConnectionFactory;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Criptografia das contas de usuario. A CHAVE MESTRA (32 bytes aleatorios) fica no
 * arquivo "chave-contas.key" ao lado do banco, nunca dentro dele: copiar so o
 * banco (ou um backup VACUUM INTO, ou a planilha do Drive) nao revela nada.
 * - cifrar/decifrar: AES-256-GCM (login, e-mail, senha de app do Gmail);
 * - indice: HMAC-SHA256 do login normalizado (busca sem decifrar);
 * - PIN: PBKDF2-HMAC-SHA256 (210 mil iteracoes, sal por conta) sobre um HMAC do
 *   PIN com a chave (pimenta): sem o arquivo da chave nao da nem para tentar os
 *   PINs por forca bruta com o banco copiado.
 * Se o arquivo da chave se perder, os logins/e-mails cifrados ficam ilegiveis:
 * ele precisa entrar no backup manual da pasta de dados.
 */
@Component
public class Cripto {

    private static final Logger log = LoggerFactory.getLogger(Cripto.class);
    static final String ARQUIVO_CHAVE = "chave-contas.key";
    private static final int ITERACOES = 210_000;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final byte[] chaveCifra;
    private final byte[] chaveIndice;

    public Cripto(ConnectionFactory conexao) {
        byte[] mestra = carregarOuCriar(conexao.getDiretorioDados().resolve(ARQUIVO_CHAVE));
        this.chaveCifra = hmac(mestra, "cifra".getBytes(StandardCharsets.UTF_8));
        this.chaveIndice = hmac(mestra, "indice".getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] carregarOuCriar(Path arquivo) {
        try {
            if (!Files.exists(arquivo)) {
                byte[] nova = new byte[32];
                ALEATORIO.nextBytes(nova);
                try {
                    Files.write(arquivo, nova, StandardOpenOption.CREATE_NEW);
                    log.info("chave de criptografia criada em {}", arquivo.getFileName());
                } catch (FileAlreadyExistsException outraJanelaCriou) {
                    // corrida improvavel: usa a que ja existe
                }
            }
            byte[] chave = Files.readAllBytes(arquivo);
            if (chave.length != 32) {
                throw new IllegalStateException("arquivo de chave invalido: " + arquivo.getFileName());
            }
            return chave;
        } catch (IOException erro) {
            throw new IllegalStateException("nao foi possivel ler/criar a chave de criptografia", erro);
        }
    }

    private static byte[] hmac(byte[] chave, byte[] dados) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(chave, "HmacSHA256"));
            return mac.doFinal(dados);
        } catch (GeneralSecurityException erro) {
            throw new IllegalStateException(erro);
        }
    }

    public String cifrar(String texto) {
        if (texto == null) {
            return null;
        }
        try {
            byte[] iv = new byte[12];
            ALEATORIO.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(chaveCifra, "AES"), new GCMParameterSpec(128, iv));
            byte[] cifrado = c.doFinal(texto.getBytes(StandardCharsets.UTF_8));
            byte[] tudo = new byte[iv.length + cifrado.length];
            System.arraycopy(iv, 0, tudo, 0, iv.length);
            System.arraycopy(cifrado, 0, tudo, iv.length, cifrado.length);
            return "v1:" + Base64.getEncoder().encodeToString(tudo);
        } catch (GeneralSecurityException erro) {
            throw new IllegalStateException("falha ao cifrar", erro);
        }
    }

    public String decifrar(String valor) {
        if (valor == null) {
            return null;
        }
        try {
            byte[] tudo = Base64.getDecoder().decode(valor.substring(3));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(chaveCifra, "AES"), new GCMParameterSpec(128, tudo, 0, 12));
            return new String(c.doFinal(tudo, 12, tudo.length - 12), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException erro) {
            throw new IllegalStateException("falha ao decifrar (chave diferente da usada ao gravar?)", erro);
        }
    }

    /** Indice de busca do login: igual para "Felipe" e " FELIPE ". */
    public String indice(String login) {
        String normal = login.trim().toLowerCase(Locale.ROOT);
        return HexFormat.of().formatHex(hmac(chaveIndice, normal.getBytes(StandardCharsets.UTF_8)));
    }

    public String hashPin(String pin) {
        byte[] sal = new byte[16];
        ALEATORIO.nextBytes(sal);
        return "pbkdf2$" + ITERACOES + "$" + Base64.getEncoder().encodeToString(sal) + "$"
                + Base64.getEncoder().encodeToString(pbkdf2(pin, sal, ITERACOES));
    }

    public boolean conferirPin(String pin, String hash) {
        String[] p = hash == null ? new String[0] : hash.split("\\$");
        if (p.length != 4 || !"pbkdf2".equals(p[0]) || pin == null) {
            return false;
        }
        byte[] esperado = Base64.getDecoder().decode(p[3]);
        byte[] calculado = pbkdf2(pin, Base64.getDecoder().decode(p[2]), Integer.parseInt(p[1]));
        return MessageDigest.isEqual(esperado, calculado);
    }

    private byte[] pbkdf2(String pin, byte[] sal, int iteracoes) {
        try {
            // "pimenta": HMAC do PIN com a chave antes do PBKDF2
            char[] apimentado = HexFormat.of().formatHex(hmac(chaveIndice, ("pin:" + pin).getBytes(StandardCharsets.UTF_8))).toCharArray();
            PBEKeySpec spec = new PBEKeySpec(apimentado, sal, iteracoes, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException erro) {
            throw new IllegalStateException(erro);
        }
    }

    /** Codigo de redefinicao (6 digitos) guardado so como HMAC. */
    public String hashCodigo(String codigo) {
        return HexFormat.of().formatHex(hmac(chaveIndice, ("codigo:" + codigo).getBytes(StandardCharsets.UTF_8)));
    }

    public static String codigoAleatorio() {
        return String.format("%06d", ALEATORIO.nextInt(1_000_000));
    }

    /** Token de sessao: 32 bytes aleatorios em hexadecimal. */
    public static String tokenAleatorio() {
        byte[] b = new byte[32];
        ALEATORIO.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }
}

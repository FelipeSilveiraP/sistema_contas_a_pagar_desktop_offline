package com.chaveiro.service;

import java.util.Properties;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Envio de e-mail pelo Gmail da loja (smtp.gmail.com:587, STARTTLS) com a "senha de
 * app" do Google. E a UNICA parte do sistema que usa a internet, e so na hora de
 * mandar o codigo de redefinicao do PIN. Os testes trocam esta classe por uma falsa.
 */
@Component
public class Carteiro {

    public void enviar(String remetente, String senhaApp, String destino, String assunto, String texto) {
        JavaMailSenderImpl envio = new JavaMailSenderImpl();
        envio.setHost("smtp.gmail.com");
        envio.setPort(587);
        envio.setUsername(remetente);
        envio.setPassword(senhaApp);
        Properties p = envio.getJavaMailProperties();
        p.put("mail.smtp.auth", "true");
        p.put("mail.smtp.starttls.enable", "true");
        p.put("mail.smtp.starttls.required", "true");
        p.put("mail.smtp.connectiontimeout", "15000");
        p.put("mail.smtp.timeout", "15000");
        p.put("mail.smtp.writetimeout", "15000");
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(remetente);
        msg.setTo(destino);
        msg.setSubject(assunto);
        msg.setText(texto);
        envio.send(msg);
    }
}

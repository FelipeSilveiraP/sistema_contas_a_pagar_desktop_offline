---
name: desktop-security-guard
description: >
  Directives for desktop software security based on OWASP Desktop Top 10 and OWASP Password Storage.
  Enforces parameterized queries, sensitive memory wiping (char[]), Argon2id/BCrypt password hashing,
  atomic audit trails, and preparation for secure internet communication (TLS 1.3, JWT, rate limiting).
---

# Desktop & Offline-to-Online Security Guidelines

Guidelines to protect local desktop software from reverse-engineering, local data tampering, and prepare it securely for future online access and user authentication.

## 1. Local Storage & Database Security (SQLite)
* **100% Prepared Statements:** Never concatenate variables into SQL strings. SQL Injection can happen locally just as it does on web servers.
* **Sensitive Data at Rest:** Never store plaintext passwords or sensitive tokens in `.properties`, JSON, or SQLite columns.
* **Tamper-Evident Logs:** Audit logs must be recorded within the same ACID transaction (`connection.setAutoCommit(false)`) as the financial change.

## 2. Password Hashing (Future Auth & Users)
* **Never use fast hashes:** MD5, SHA-1, SHA-256, and SHA-512 are strictly forbidden for user passwords (brute-forceable by GPUs).
* **Use Memory-Hard Hashing:** Use **Argon2id** (OWASP recommended standard) or **BCrypt** with automatic cryptographically secure salt.
* **Memory Safety:** Handle passwords in `char[]` arrays and explicitly wipe them (`Arrays.fill(pwd, '0')`) immediately after verification, avoiding lingering plaintext passwords in JVM heap memory.

## 3. Future Internet & API Connectivity
* **Transport Security:** When the desktop app starts talking to remote servers, mandate **TLS 1.3** and disable legacy SSL/TLS versions.
* **Stateless Tokens:** Use short-lived JWTs (JSON Web Tokens) with secure refresh token rotation stored in the OS Credential Vault (Windows Credential Manager) instead of flat disk files.
* **Input Validation on Both Sides:** Even if the desktop UI validates inputs, remote APIs must validate 100% of payloads independently.

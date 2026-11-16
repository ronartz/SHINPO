# SHINPO 50-Point Security Coverage Matrix

**Assessment date:** 2026-11-03  
**Source revision:** `cdb80f653f3176504484fbb5528edf026c065bba` plus the uncommitted worktree  
**Status:** Work-in-progress evidence register; not a certification or release approval.

Status describes evidence currently available, not a claim that the whole category is secure. `PARTIAL` means a specific control/test exists while relevant coverage remains open. `NOT TESTED` means no current evidence was gathered. `FAIL` is a known release gap.

| # | Category | Status | Current evidence / remaining gap |
|---:|---|---|---|
| 01 | Exposed database credentials | NOT TESTED | No full secret/history scan in this slice. |
| 02 | Public `.env` files | NOT TESTED | Repository-wide tracked/untracked secret review remains open. |
| 03 | Hardcoded API keys | NOT TESTED | EONPAI provider key flow uses OS credential storage; full artifact scan not run. |
| 04 | Weak or missing authentication | PARTIAL | Rust Argon2id key wrapping; NFKC, 15-character new-password minimum, generic failures, and offline list; offline list is curated and incomplete. Rust auth tests pass. |
| 05 | Missing authorization checks | PARTIAL | Vault IPC operations use locked-vault checks; full command-by-command authorization review remains open. |
| 06 | Cross-user data access | PARTIAL | SQLCipher account isolation and EONPAI account-separation tests pass; full feature matrix not retested. |
| 07 | Database/file permissions | PARTIAL | `local_vault_metadata_and_database_use_private_unix_modes` verifies Unix vault/account directories `0700` and metadata, database, and auth lock files `0600`; Windows ACL behavior is not verified. |
| 08 | Misconfigured hosted storage | NOT APPLICABLE | No hosted Firebase/Supabase/S3 storage is in the local-first vault path; remote service configuration was not audited. |
| 09 | Unprotected administrative routes | NOT TESTED | No current full backend route audit. |
| 10 | Production debug pages | NOT TESTED | Release artifact/debug configuration was not built or inspected here. |
| 11 | Build logs leaking secrets | NOT TESTED | No log/artifact secret scan. |
| 12 | Verbose errors | PARTIAL | Native login failures are generic; all IPC and Java errors have not been reviewed. |
| 13 | Git history exposure | NOT TESTED | No history/secrets scan performed. |
| 14 | Secrets in frontend bundles | NOT TESTED | Production bundle was built, but not scanned for secrets. |
| 15 | Client-only security | PARTIAL | Native vault owns idle expiry and privileged DB operations reject after lock; other non-vault IPC command authorization is not exhaustively verified. |
| 16 | Input validation | PARTIAL | Serde request validation and targeted invalid-input tests exist; complete IPC boundary inventory remains open. |
| 17 | SQL injection | PARTIAL | Reviewed native operations use parameterized rusqlite queries; no whole-repository SQL audit in this slice. |
| 18 | NoSQL injection | NOT APPLICABLE | No NoSQL datastore identified in the local native path. |
| 19 | XSS | NOT TESTED | AI output handling and CSP need a focused complete review. |
| 20 | CSRF | NOT APPLICABLE | Local Tauri IPC is the local account authority; hosted web backend CSRF was not retested. |
| 21 | Insecure uploads | NOT APPLICABLE | No file-import/upload path is included in this security slice. |
| 22 | Path traversal | PARTIAL | Disposable tests cover vault traversal and account symlink rejection; other filesystem commands remain unreviewed. |
| 23 | SSRF | PARTIAL | EONPAI provider URL validation rejects unsafe/local destinations in tests; broader network-call audit remains open. |
| 24 | Password recovery | PARTIAL | Recovery-key unwrap and password rewrap preserve encrypted data; one-time user confirmation and encrypted backup/restore are not implemented/verified. |
| 25 | Session management | PARTIAL | Rust-owned 15-minute idle expiry, serialized lock, key drop, Focus pause, EONPAI cancel, Guardian lock state and browser-policy clear have targeted tests. Fedora logind hook is source/build verified only; Windows lock notification and real signal delivery are unverified. |
| 26 | JWT secrets | NOT TESTED | Local vault does not use JWT; legacy remote-auth secrets were not audited. |
| 27 | CORS | NOT TESTED | No current full service/browser CORS audit. |
| 28 | Rate limiting | PARTIAL | Persisted exponential backoff covers unlock, recovery-key verification, and current-password verification for password changes; cross-process serialization and unknown-account dummy Argon2 work are tested. The same local user can still tamper with metadata, and unknown-account attempts have no persistent per-identifier cooldown. |
| 29 | Public test/staging environments | NOT TESTED | No deployment inventory audit. |
| 30 | Default credentials | NOT TESTED | No complete source/config scan. |
| 31 | Webhook signatures | NOT APPLICABLE | No webhook path in the native local workflow. |
| 32 | Frontend-only payments | NOT APPLICABLE | No payment/subscription path in this scope. |
| 33 | IDOR | PARTIAL | Native ownership scoping and cross-account EONPAI tests exist; all resource commands need a complete review. |
| 34 | User-controlled identifiers/roles | PARTIAL | Typed native command validation and ownership-scoped queries exist; not every command is covered. |
| 35 | Sensitive logging | NOT TESTED | No comprehensive log redaction scan. |
| 36 | Source maps | NOT TESTED | Production source-map publishing configuration was not checked. |
| 37 | Vulnerable dependencies | NOT TESTED | `cargo audit`/`npm audit`/browser-extension audit were not run for this checkpoint. |
| 38 | Outdated packages | NOT TESTED | No dependency freshness audit. |
| 39 | AI prompt injection | PARTIAL | Typed proposal/confirmation flows and bounded context tests exist; adversarial end-to-end prompt suite is incomplete. |
| 40 | AI tool authorization | PARTIAL | Revision-bound confirmation and allowlisted native actions have tests; full tool inventory and lock-race review remain open. |
| 41 | Database privileges | NOT APPLICABLE | The local SQLCipher database has no remote DB role model; server DB roles remain unreviewed. |
| 42 | Audit logs | PARTIAL | Local Guardian events and warnings persist encrypted; append-only/tamper-evident guarantees are not established. |
| 43 | Monitoring/alerting | NOT TESTED | No production monitoring design is included in the offline app. |
| 44 | Backup/restore | FAIL | Encrypted backup/restore implementation and corruption/wrong-key atomicity tests are absent. |
| 45 | Public internal dashboards | NOT TESTED | No deployment exposure audit. |
| 46 | Security headers/CSP | PARTIAL | Step 3 narrows production `connect-src` to Tauri IPC, removes broad `https:`/`wss:` and external fonts, and adds automated CSP/network-boundary checks. Ubuntu and Windows hosted compile/build CI passed on run [41871138031](https://github.com/ronartz/SHINPO/actions/runs/41871138031); an isolated unauthenticated idle-start capture found no process-attributed IP sockets (20 samples). Inline styles remain allowed; authenticated/provider-enabled runtime and full command-capability audit are not verified. |
| 47 | Cookie flags | NOT TESTED | Native local account does not use cookies; hosted backend cookie flags were not inspected. |
| 48 | Encryption at rest | PARTIAL | SQLCipher disposable tests reject plaintext SQLite and tampered ciphertext; platform memory/key lifecycle and backup encryption are not comprehensively verified. |
| 49 | Tenant isolation | PARTIAL | Disposable multi-account native tests pass; full app-level isolation review remains open. |
| 50 | AI-generated code trust | NOT TESTED | No independent full source/release review has been completed. |

## Security decisions and compatibility

- New passwords use NFKC and require at least 15 Unicode scalar values; existing 12–14-character vault passwords remain unlockable. This avoids stranding encrypted vaults. NIST SP 800-63B-4 says single-factor passwords **SHALL** be at least 15 characters and **SHOULD** accept at least 64; it also recommends NFC for Unicode. SHINPO currently retains NFKC to preserve existing vault derivation semantics. Review a versioned credential migration before changing normalization. See [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html).
- The bundled password list is a small offline denylist, not a comprehensive breached-password corpus. No password or password-derived value is sent over the network. HIBP lookup is not implemented or enabled.
- Linux logind `Lock` and `PrepareForSleep(true)` are wired through system D-Bus. Runtime delivery has not been exercised by locking/suspending the workstation. Windows lock/suspend signal integration is not implemented in this slice.

## Next security work

Implement one-time recovery-key confirmation and encrypted backup/restore with disposable wrong-key, corruption, interruption, and atomic-failure tests; then audit non-vault IPC authorization and the release supply chain. Release remains **NO-GO**.

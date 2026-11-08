import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

console.log('=== SHINPO EMPIRICAL SECURITY & SUPPLY-CHAIN AUDIT GATE ===')

const results = {
  timestamp: new Date().toISOString(),
  secretsScan: { status: 'PENDING', findings: [] },
  cargoAuditTauri: { status: 'PENDING', findings: [] },
  cargoAuditShield: { status: 'PENDING', findings: [] },
  cargoAuditBrowserHost: { status: 'PENDING', findings: [] },
  sqlCipherCryptoTest: { status: 'PENDING', findings: [] },
  npmAudit: { status: 'PENDING', findings: [] },
  ipcBoundary: { status: 'PENDING', findings: [] },
}

let totalFailures = 0

// -----------------------------------------------------------------------------
// 1. Secrets and Plaintext Credential Scanning
// -----------------------------------------------------------------------------
console.log('\n[1/7] Scanning codebase for leaked secrets and private keys...')
const SECRET_PATTERNS = [
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Hardcoded Password in Config', regex: /(?:password|secret|api_key|apikey)\s*[:=]\s*["'][A-Za-z0-9+/=]{16,}["']/i },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Personal Token', regex: /ghp_[A-Za-z0-9]{36}/ },
]

const filesToScan = [
  'frontend/src/api/auth.ts',
  'frontend/src/api/tauri.ts',
  'frontend/src/api/device.ts',
  'frontend/src-tauri/src/native_vault.rs',
  'frontend/src-tauri/src/native_eonpai.rs',
  'crates/shinpo-shield/src/lib.rs',
]

console.log('  The regex check below supplements Gitleaks; it is not a repository-wide secret scan.')

for (const relPath of filesToScan) {
  const fullPath = path.resolve(relPath)
  if (!existsSync(fullPath)) {
    results.secretsScan.findings.push({ file: relPath, pattern: 'required scan target missing' })
    continue
  }
  const content = readFileSync(fullPath, 'utf8')
  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      results.secretsScan.findings.push({ file: relPath, pattern: name })
    }
  }
}

if (results.secretsScan.findings.length > 0) {
  results.secretsScan.status = 'FAIL'
  totalFailures++
  console.error('  ✗ Secrets scan detected potential credentials:', results.secretsScan.findings)
} else {
  try {
    execSync('gitleaks --version', { encoding: 'utf8', stdio: 'ignore' })
    execSync('gitleaks detect --redact', { encoding: 'utf8', stdio: 'pipe' })
    execSync('gitleaks detect --no-git --redact', { encoding: 'utf8', stdio: 'pipe' })
    results.secretsScan.status = 'PASS'
    console.log('  ✓ Gitleaks completed committed-history and current-worktree scans; the supplementary pattern check also passed.')
  } catch (err) {
    results.secretsScan.status = err.code === 'ENOENT' ? 'UNAVAILABLE' : 'FAIL'
    results.secretsScan.findings.push(err.code === 'ENOENT'
      ? 'Gitleaks is not installed; repository history and the full worktree were not scanned.'
      : 'Gitleaks history or worktree scan failed; inspect the redacted command output.')
    totalFailures++
    console.error(`  ! Repository-wide secret scanning ${results.secretsScan.status.toLowerCase()}; limited regex results cannot pass this gate.`)
  }
}

// -----------------------------------------------------------------------------
// 2. RustSec / cargo-audit on Tauri Crate
// -----------------------------------------------------------------------------
console.log('\n[2/7] Running cargo-audit on frontend/src-tauri...')
try {
  const auditTauriOut = execSync('cargo audit --deny unsound', { cwd: 'frontend/src-tauri', encoding: 'utf8' })
  results.cargoAuditTauri.status = 'PASS'
  console.log(`  ✓ frontend/src-tauri: cargo audit exited 0.\n${auditTauriOut.trim() || 'No findings reported.'}`)
} catch (err) {
  const out = (err.stdout || '') + (err.stderr || '')
  results.cargoAuditTauri.status = 'FAIL'
  totalFailures++
  console.error('  ✗ cargo audit failed in frontend/src-tauri:', out)
}

// -----------------------------------------------------------------------------
// 3. RustSec / cargo-audit on shinpo-shield Crate
// -----------------------------------------------------------------------------
console.log('\n[3/7] Running cargo-audit on crates/shinpo-shield...')
try {
  const auditShieldOut = execSync('cargo audit --deny unsound', { cwd: 'crates/shinpo-shield', encoding: 'utf8' })
  results.cargoAuditShield.status = 'PASS'
  console.log(`  ✓ crates/shinpo-shield: cargo audit exited 0.\n${auditShieldOut.trim() || 'No findings reported.'}`)
} catch (err) {
  const out = (err.stdout || '') + (err.stderr || '')
  results.cargoAuditShield.status = 'FAIL'
  totalFailures++
  console.error('  ✗ cargo audit failed in crates/shinpo-shield:', out)
}

// -----------------------------------------------------------------------------
// 4. RustSec / cargo-audit on Browser Host Crate
// -----------------------------------------------------------------------------
console.log('\n[4/7] Running cargo-audit on crates/shinpo-browser-host...')
try {
  const auditHostOut = execSync('cargo audit --deny unsound', { cwd: 'crates/shinpo-browser-host', encoding: 'utf8' })
  results.cargoAuditBrowserHost.status = 'PASS'
  console.log(`  ✓ crates/shinpo-browser-host: cargo audit exited 0.\n${auditHostOut.trim() || 'No findings reported.'}`)
} catch (err) {
  const out = (err.stdout || '') + (err.stderr || '')
  results.cargoAuditBrowserHost.status = 'FAIL'
  totalFailures++
  console.error('  ✗ cargo audit failed in crates/shinpo-browser-host:', out)
}

// -----------------------------------------------------------------------------
// 5. SQLCipher Vault Cryptographic Integrity & Recovery Test Execution
// -----------------------------------------------------------------------------
console.log('\n[5/7] Executing empirical SQLCipher cryptographic integrity test...')
try {
  const expected = [
    'native_vault::tests::corrupt_metadata_and_tampered_ciphertext_are_rejected_without_plaintext_fallback',
    'native_vault::tests::sqlcipher_vault_rejects_wrong_password_and_recovers_without_plaintext_sqlite',
  ]
  const outputs = expected.map((name) => execSync(
    `cargo test --lib -- --exact ${name}`,
    { cwd: 'frontend/src-tauri', encoding: 'utf8' },
  ))
  const cryptoOut = outputs.join('\n')
  if (outputs.length === expected.length && expected.every((name, index) =>
    outputs[index].includes(`test ${name} ... ok`)
      && /test result: ok\. 1 passed; 0 failed;/.test(outputs[index]))) {
    results.sqlCipherCryptoTest.status = 'PASS'
    console.log('  ✓ SQLCipher lib tests passed: 2 expected tests executed, 2 passed, 0 failed.')
  } else {
    results.sqlCipherCryptoTest.status = 'FAIL'
    totalFailures++
    console.error('  ✗ SQLCipher tests failed execution:', cryptoOut)
  }
} catch (err) {
  results.sqlCipherCryptoTest.status = 'FAIL'
  totalFailures++
  console.error('  ✗ SQLCipher test execution threw an error:', err.message)
}

// -----------------------------------------------------------------------------
// 6. Frontend Production npm Audit
// -----------------------------------------------------------------------------
console.log('\n[6/7] Running npm production dependency audit...')
try {
  const auditOutput = execSync('npm audit --prefix frontend --omit=dev --json', { encoding: 'utf8' })
  const auditJson = JSON.parse(auditOutput)
  const vulnerabilities = auditJson.metadata?.vulnerabilities
  if (!vulnerabilities || !['info', 'low', 'moderate', 'high', 'critical'].every((key) => Number.isInteger(vulnerabilities[key]))) {
    throw new Error('npm audit returned malformed or incomplete vulnerability metadata')
  }
  const totalVulnerabilities = ['info', 'low', 'moderate', 'high', 'critical'].reduce((total, key) => total + vulnerabilities[key], 0)

  if (totalVulnerabilities === 0) {
    results.npmAudit.status = 'PASS'
    console.log('  ✓ Zero production npm advisories found.')
  } else {
    results.npmAudit.status = 'FAIL'
    totalFailures++
    console.error(`  ✗ npm audit found ${totalVulnerabilities} production advisories:`, vulnerabilities)
  }
} catch (err) {
  try {
    const stdout = err.stdout ? JSON.parse(err.stdout) : null
    const vulnerabilities = stdout?.metadata?.vulnerabilities
    if (!vulnerabilities || !['info', 'low', 'moderate', 'high', 'critical'].every((key) => Number.isInteger(vulnerabilities[key]))) {
      throw new Error('npm audit returned malformed or incomplete vulnerability metadata')
    }
    const totalVulnerabilities = ['info', 'low', 'moderate', 'high', 'critical'].reduce((total, key) => total + vulnerabilities[key], 0)
    if (totalVulnerabilities > 0) {
      results.npmAudit.status = 'FAIL'
      totalFailures++
      console.error(`  ✗ npm audit reported ${totalVulnerabilities} production advisories:`, vulnerabilities)
    } else {
      results.npmAudit.status = 'UNAVAILABLE'
      results.npmAudit.findings.push('npm audit exited unsuccessfully despite reporting zero advisories; the result is not trusted.')
      totalFailures++
      console.error('  ! npm audit exited unsuccessfully despite zero reported advisories; result is unavailable, not a pass.')
    }
  } catch (parseError) {
    results.npmAudit.status = 'UNAVAILABLE'
    results.npmAudit.findings.push(String(parseError))
    totalFailures++
    console.error('  ! npm audit result is unavailable; malformed output cannot pass:', String(parseError))
  }
}

// -----------------------------------------------------------------------------
// 6. Tauri IPC Boundary & Configuration Verification
// -----------------------------------------------------------------------------
console.log('\n[7/7] Verifying Tauri IPC permissions & security boundary...')
const tauriConfPath = path.resolve('frontend/src-tauri/tauri.conf.json')
if (existsSync(tauriConfPath)) {
  const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8'))
  const csp = conf.app?.security?.csp
  const capabilitiesPath = path.resolve('frontend/src-tauri/capabilities/default.json')
  const connect = csp?.['connect-src']
  if (connect === 'ipc: http://ipc.localhost' && existsSync(capabilitiesPath)) {
    JSON.parse(readFileSync(capabilitiesPath, 'utf8'))
    results.ipcBoundary.status = 'PASS'
    console.log('  ✓ Production connect-src is restricted to Tauri IPC and the default capability file parses.')
  } else {
    results.ipcBoundary.status = 'FAIL'
    totalFailures++
    console.error('  ✗ Production CSP or default capability configuration is missing/overbroad.')
  }
} else {
  results.ipcBoundary.status = 'FAIL'
  totalFailures++
  console.error('  ✗ tauri.conf.json not found!')
}

console.log('\n=== SECURITY AUDIT RESULT ===')
if (totalFailures === 0) {
  console.log('STATUS: PASS — Required scans and cryptographic checks passed; review printed RustSec warnings separately.')
  process.exit(0)
} else {
  console.error(`STATUS: FAIL — ${totalFailures} security check(s) failed.`)
  process.exit(1)
}

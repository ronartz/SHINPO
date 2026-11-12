import path from 'node:path'
import os from 'node:os'
import { existsSync } from 'node:fs'

// Keep release acceptance on the production binary by default. Native QA
// fixtures that require opt-in debug-only IPC (for example qa-clock) must
// supply an explicit binary instead of changing release build features.
const appBinary = path.resolve(process.env.SHINPO_TAURI_APP_BINARY || 'src-tauri/target/release/shinpo-desktop')
const defaultNativeDriver = existsSync(path.join(os.homedir(), '.local/bin/WebKitWebDriver'))
  ? path.join(os.homedir(), '.local/bin/WebKitWebDriver')
  : 'WebKitWebDriver'

export const config = {
  runner: 'local',
  specs: ['./e2e/tauri-native/**/*.spec.js'],
  maxInstances: 1,
  services: [[
    '@wdio/tauri-service',
    {
      driverProvider: 'external',
      appBinaryPath: appBinary,
      tauriDriverPath: process.env.TAURI_DRIVER_PATH || path.join(os.homedir(), '.cargo/bin/tauri-driver'),
      nativeDriverPath: process.env.WEBKIT_WEBDRIVER_PATH || defaultNativeDriver,
    },
  ]],
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': { application: appBinary },
  }],
  logLevel: 'warn',
  bail: 1,
  baseUrl: 'http://localhost:4444',
  waitforTimeout: 12000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 1,
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 900000 },
}

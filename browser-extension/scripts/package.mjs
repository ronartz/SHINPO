import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')
const artifactDirectory = resolve(projectDirectory, 'artifacts')

execFileSync(process.execPath, [resolve(scriptDirectory, 'build.mjs')], {
  cwd: projectDirectory,
  stdio: 'inherit',
})
await mkdir(artifactDirectory, { recursive: true })

for (const target of ['chromium', 'firefox']) {
  const output = resolve(artifactDirectory, `shinpo-browser-companion-${target}.zip`)
  execFileSync('zip', ['-q', '-r', output, '.'], {
    cwd: resolve(projectDirectory, 'dist', target),
  })
  console.log(`Created ${output}`)
}

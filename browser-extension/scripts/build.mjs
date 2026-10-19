import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectDirectory = resolve(scriptDirectory, '..')
const sourceDirectory = resolve(projectDirectory, 'src')
const distributionDirectory = resolve(projectDirectory, 'dist')
const argumentsSet = new Set(process.argv.slice(2))
const requestedTarget = process.argv.includes('--target')
  ? process.argv[process.argv.indexOf('--target') + 1]
  : null

if (argumentsSet.has('--clean')) {
  await rm(distributionDirectory, { recursive: true, force: true })
  process.exit(0)
}

const targets = requestedTarget ? [requestedTarget] : ['chromium', 'firefox']
if (targets.some((target) => !['chromium', 'firefox'].includes(target))) {
  throw new Error('Target must be chromium or firefox')
}

const commonManifest = JSON.parse(
  await readFile(resolve(projectDirectory, 'manifests/common.json'), 'utf8'),
)

for (const target of targets) {
  const targetDirectory = resolve(distributionDirectory, target)
  await rm(targetDirectory, { recursive: true, force: true })
  await mkdir(targetDirectory, { recursive: true })
  await cp(sourceDirectory, targetDirectory, { recursive: true })

  const targetManifest = JSON.parse(
    await readFile(resolve(projectDirectory, `manifests/${target}.json`), 'utf8'),
  )
  const manifest = mergeManifest(commonManifest, targetManifest)
  await writeFile(
    resolve(targetDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

function mergeManifest(common, target) {
  const merged = structuredClone(common)
  for (const [key, value] of Object.entries(target)) {
    if (value === null) {
      delete merged[key]
      continue
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === 'object' &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = { ...merged[key], ...value }
    } else {
      merged[key] = value
    }
  }
  return merged
}

console.log(`Built SHINPO Browser Companion: ${targets.join(', ')}`)

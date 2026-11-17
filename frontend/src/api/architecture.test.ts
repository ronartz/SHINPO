import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Architecture Gate: zero circular dependencies and zero forbidden legacy terms', async (t) => {
  await t.test('no circular dependencies in frontend/src', () => {
    const srcDir = path.resolve('src')
    const files: string[] = []

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(full)
        }
      }
    }
    walk(srcDir)

    const imports: Record<string, string[]> = {}
    for (const file of files) {
      const rel = path.relative(srcDir, file)
      imports[rel] = []
      const content = fs.readFileSync(file, 'utf8')
      const lines = content.split('\n')
      for (const line of lines) {
        const m = line.match(/from\s+['"](\.[^'"]+)['"]/)
        if (m) {
          const targetRel = m[1]
          const targetDir = path.dirname(rel)
          const resolved = path.normalize(path.join(targetDir, targetRel))
          for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
            const cand = resolved + ext
            if (fs.existsSync(path.join(srcDir, cand))) {
              imports[rel].push(cand)
              break
            }
          }
        }
      }
    }

    const visited: Record<string, number> = {}
    const curPath: string[] = []
    const cycles: string[][] = []

    function visit(node: string) {
      visited[node] = 1
      curPath.push(node)
      for (const next of imports[node] || []) {
        if (visited[next] === 1) {
          const idx = curPath.indexOf(next)
          cycles.push([...curPath.slice(idx), next])
        } else if (!visited[next]) {
          visit(next)
        }
      }
      curPath.pop()
      visited[node] = 2
    }

    for (const node of Object.keys(imports)) {
      if (!visited[node]) visit(node)
    }

    assert.equal(
      cycles.length,
      0,
      `Found circular dependencies: ${cycles.map((c) => c.join(' -> ')).join('; ')}`
    )
  })

  await t.test('zero forbidden legacy terms in active source files', () => {
    const rootDir = path.resolve('..')
    const pattern = /localhost:8080|localhost:5432|\bspring\b|postgresql|flyway|actuator/i
    const matches: string[] = []

    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (['docs', 'node_modules', 'target', '.git', 'backups', 'dist'].includes(entry.name)) {
            continue
          }
          scan(full)
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.rs'))) {
          if (entry.name === 'architecture.test.ts') continue
          const content = fs.readFileSync(full, 'utf8')
          const lines = content.split('\n')
          lines.forEach((line, idx) => {
            if (pattern.test(line)) {
              matches.push(`${path.relative(rootDir, full)}:${idx + 1}:${line.trim()}`)
            }
          })
        }
      }
    }
    scan(rootDir)

    assert.equal(
      matches.length,
      0,
      `Found forbidden legacy terms in code:\n${matches.join('\n')}`
    )
  })
})

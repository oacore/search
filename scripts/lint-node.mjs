// lint-node.mjs - the Node the lint tools run on (W1). ESLint 10 and stylelint 17 need Node >= 20.19 and
// lint-staged 17 >= 22.22.1; they run on the tooling Node (24: .nvmrc and the devEngines floor of package.json,
// CS-W0-5), while Jest and the app stay on the runtime Node (24.18.1 from W4e; 18.20.8 before). A lint script
// started on an older Node (the static Jest project before W4e, for one) runs itself again on the tooling Node.
// The tooling Node: LINT_NODE_BIN if set, else the running Node when it meets the floor, else the newest
// $NVM_DIR/versions/node/v<major>.* that meets it.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parse = (v) =>
  String(v)
    .replace(/^v/, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)

export const atLeast = (version, floor) => {
  const a = parse(version)
  const b = parse(floor)
  for (let i = 0; i < 3; i += 1)
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  return true
}

// the devEngines floor (">=24.15.0")
export function toolingFloor() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
  )
  const spec = pkg.devEngines?.runtime?.version || ''
  const m = /^>=\s*(\d+\.\d+\.\d+)$/.exec(spec.trim())
  if (!m)
    throw new Error(`devEngines.runtime.version is not ">=x.y.z": ${spec}`)
  return m[1]
}

export function toolingNode() {
  if (process.env.LINT_NODE_BIN) return process.env.LINT_NODE_BIN
  const floor = toolingFloor()
  if (atLeast(process.version, floor)) return process.execPath
  const dir = path.join(
    process.env.NVM_DIR || path.join(os.homedir(), '.nvm'),
    'versions',
    'node'
  )
  const major = parse(floor)[0]
  let best = null
  for (const v of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!v.startsWith(`v${major}.`) || !atLeast(v, floor)) continue
    if (!best || atLeast(v, best)) best = v
  }
  const bin = best && path.join(dir, best, 'bin', 'node')
  if (!bin || !fs.existsSync(bin))
    throw new Error(
      `no Node >= ${floor} found (nvm install ${major}, or set LINT_NODE_BIN)`
    )
  return bin
}

// null when the running Node is the tooling Node; otherwise the exit status of the same script run on it
export function reexecOnToolingNode(moduleUrl, args) {
  // already the second run: never a third
  if (process.env.LINT_INVOKED_WITH) return null
  const bin = toolingNode()
  if (bin === process.execPath) return null
  const r = spawnSync(bin, [fileURLToPath(moduleUrl), ...args], {
    stdio: 'inherit',
    env: { ...process.env, LINT_INVOKED_WITH: process.version },
  })
  if (r.error) throw r.error
  return r.status === null ? 1 : r.status
}

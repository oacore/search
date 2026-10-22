#!/usr/bin/env node
// t908-logo-tls.mjs - the logo TLS probe of T-908 (41 J; R-080, X10.23): `checkLogo` swallows every error, so a
// host whose certificate Node 24's OpenSSL (security level 2) refuses would only show as a missing logo. The
// probe takes the hosts the app can fetch a member logo or a citation from, TLS-connects to each under Node
// 22.18.0 and Node 24.18.1 (handshake only, no request), and prints the hosts whose outcome differs.
//
//   node test/ops/t908-logo-tls.mjs hosts [--data-dir <dir>] [--json]
//        the distinct hosts: the homepage hosts of the member data providers (data/.members.json repo_id joined to
//        data/.formap.json id -> urlHomepage, the snapshot of test/fixtures/data-snapshot/ when present), the
//        host every recorded member-logo URL has (api.core.ac.uk) and doi.org. Host names only: no e-mail
//        address or other field of the snapshot is read out.
//   node test/ops/t908-logo-tls.mjs stub [--nodes 22.18.0,24.18.1] [--data-dir <dir>]
//        the pilot: the SSR stub's TLS endpoint (test/ssr/stub.mjs, a test CA, one leaf per host) started in this
//        process, every host probed under each Node; exit 1 when the outcomes differ.
//   node test/ops/t908-logo-tls.mjs control [--nodes ...]
//        the detector check: a server with an RSA-1024 certificate (which Node 24 refuses and Node 22 accepts)
//        and one with RSA-2048; the probe must report the first as the only difference.
//   node test/ops/t908-logo-tls.mjs live --owner-approved [--nodes ...] [--data-dir <dir>]
//        the real hosts, port 443, handshake only. DEFERRED: contacting third-party hosts needs the owner. The
//        command refuses (exit 3) unless the flag AND T908_LIVE=1 are given; nothing in the test suite runs it.
//   node test/ops/t908-logo-tls.mjs worker --spec <file>      (internal) one Node's probe of a target list
//
// The Node binaries come from T908_NODE_<major.minor.patch> or $NVM_DIR/versions/node/v<version>/bin/node.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const DEFAULT_NODES = ['22.18.0', '24.18.1']
const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/
const ALWAYS = ['api.core.ac.uk', 'doi.org']

// ---------- the host list ----------
// a homepage is a URL, or a bare host name (some rows have no scheme)
const hostnameOf = (value) => {
  for (const candidate of [value, `https://${value}`]) {
    try {
      return new URL(candidate).hostname.toLowerCase()
    } catch {
      // try the next form
    }
  }
  return null
}
export function dataDir(explicit) {
  const candidates = [
    explicit,
    process.env.T908_DATA_DIR,
    path.join(REPO, 'test', 'fixtures', 'data-snapshot'),
    path.join(REPO, 'data'),
  ].filter(Boolean)
  const found = candidates.find(
    (d) =>
      fs.existsSync(path.join(d, '.members.json')) &&
      fs.existsSync(path.join(d, '.formap.json'))
  )
  if (!found)
    throw new Error(
      `no .members.json and .formap.json in ${candidates.join(', ')}`
    )
  return found
}

export function hostList({ dir } = {}) {
  const base = dataDir(dir)
  const members = JSON.parse(
    fs.readFileSync(path.join(base, '.members.json'), 'utf8')
  )
  const formap = JSON.parse(
    fs.readFileSync(path.join(base, '.formap.json'), 'utf8')
  )
  const home = new Map(formap.map((p) => [Number(p.id), p.urlHomepage]))
  const counts = new Map()
  const skipped = {
    noProvider: 0,
    noHomepage: 0,
    ipLiteral: 0,
    invalidHost: 0,
  }
  const add = (host) => counts.set(host, (counts.get(host) || 0) + 1)
  for (const m of members) {
    const ids = Array.isArray(m.repo_id) ? m.repo_id : [m.repo_id]
    for (const id of ids) {
      if (!home.has(Number(id))) {
        skipped.noProvider += 1
        continue
      }
      const url = home.get(Number(id))
      if (!url) {
        skipped.noHomepage += 1
        continue
      }
      const host = hostnameOf(url)
      if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) skipped.ipLiteral += 1
      else if (host && HOSTNAME.test(host)) add(host)
      else skipped.invalidHost += 1
    }
  }
  const memberHosts = [...counts.keys()]
  for (const h of ALWAYS) if (!counts.has(h)) counts.set(h, 0)
  return {
    source: path.relative(REPO, base) || '.',
    members: members.length,
    memberHosts: memberHosts.length,
    skipped,
    hosts: [...counts.keys()].sort(),
  }
}

// ---------- the worker: one Node's probe ----------
function probeOne(target, spec) {
  return new Promise((resolve) => {
    const started = Date.now()
    const done = (r) =>
      resolve({ host: target, ms: Date.now() - started, ...r })
    let socket
    try {
      socket = tls.connect({
        host: spec.connectHost || target,
        port: spec.port,
        servername: target,
        ca: spec.ca,
        rejectUnauthorized: true,
      })
    } catch (e) {
      done({
        ok: false,
        error: { code: e.code || 'THROWN', message: e.message },
      })
      return
    }
    socket.setTimeout(spec.timeoutMs || 10000, () =>
      socket.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
    )
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      done({
        ok: true,
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        sanMatches: String(cert.subjectaltname || '')
          .split(', ')
          .includes(`DNS:${target}`),
        keyBits: cert.bits || null,
      })
      socket.end()
    })
    socket.once('error', (e) =>
      done({
        ok: false,
        error: { code: e.code || 'ERROR', message: e.message },
      })
    )
  })
}

async function worker(specFile) {
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'))
  const results = []
  const queue = spec.targets.slice()
  const run = async () => {
    while (queue.length) results.push(await probeOne(queue.shift(), spec))
  }
  await Promise.all(Array.from({ length: spec.concurrency || 16 }, run))
  results.sort((a, b) => (a.host < b.host ? -1 : 1))
  console.log(
    JSON.stringify({
      node: process.version,
      openssl: process.versions.openssl,
      results,
    })
  )
}

// ---------- the orchestrator ----------
export function nodeBinary(version) {
  const env = process.env[`T908_NODE_${version.replace(/\./g, '_')}`]
  const bin =
    env ||
    path.join(
      process.env.NVM_DIR || path.join(os.homedir(), '.nvm'),
      'versions',
      'node',
      `v${version}`,
      'bin',
      'node'
    )
  if (!fs.existsSync(bin)) throw new Error(`no Node ${version} at ${bin}`)
  return bin
}

// asynchronous on purpose: the servers of the stub and control modes live in this process and must keep serving
export async function probeUnderNodes(nodes, spec) {
  const out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't908-'))
  try {
    const file = path.join(dir, 'spec.json')
    fs.writeFileSync(file, JSON.stringify(spec))
    for (const version of nodes) {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(
          nodeBinary(version),
          [fileURLToPath(import.meta.url), 'worker', '--spec', file],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        )
        const chunks = []
        let err = ''
        child.stdout.on('data', (c) => chunks.push(c))
        child.stderr.on('data', (c) => {
          err += c
        })
        const timer = setTimeout(() => child.kill('SIGKILL'), 600000)
        child.on('error', reject)
        child.on('close', (code) => {
          clearTimeout(timer)
          if (code !== 0)
            reject(new Error(`worker under Node ${version} failed: ${err}`))
          else resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        })
      })
      out[version] = result
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return out
}

// the hosts whose outcome is not the same under every Node
export function differences(perNode) {
  const versions = Object.keys(perNode)
  const hosts = new Set(
    versions.flatMap((v) => perNode[v].results.map((r) => r.host))
  )
  const outcome = (v, h) => {
    const r = perNode[v].results.find((x) => x.host === h)
    return r.ok ? 'ok' : `error ${r.error.code}: ${r.error.message}`
  }
  return [...hosts]
    .sort()
    .map((host) => ({
      host,
      outcomes: Object.fromEntries(versions.map((v) => [v, outcome(v, host)])),
    }))
    .filter((d) => new Set(Object.values(d.outcomes)).size > 1)
}

const summary = (perNode, expectedHosts) =>
  Object.fromEntries(
    Object.entries(perNode).map(([v, r]) => [
      v,
      {
        node: r.node,
        openssl: r.openssl,
        probed: r.results.length,
        ok: r.results.filter((x) => x.ok).length,
        failed: r.results.filter((x) => !x.ok).length,
        // the certificate that answered was the stub's leaf for that very host
        sanMatches: r.results.filter((x) => x.sanMatches).length,
        expectedHosts,
      },
    ])
  )

async function stubMode(nodes, dir) {
  const list = hostList({ dir })
  const { startStub } = await import(
    pathToFileURL(path.join(REPO, 'test', 'ssr', 'stub.mjs'))
  )
  const stub = await startStub({ extraHosts: list.hosts })
  try {
    const perNode = await probeUnderNodes(nodes, {
      connectHost: '127.0.0.1',
      port: stub.ports.https,
      ca: stub.ca.pem,
      targets: list.hosts,
    })
    return {
      mode: 'stub',
      hosts: list.hosts.length,
      source: list.source,
      nodes: summary(perNode, list.hosts.length),
      differing: differences(perNode),
      failures: Object.fromEntries(
        Object.entries(perNode).map(([v, r]) => [
          v,
          r.results.filter((x) => !x.ok).map((x) => x.host),
        ])
      ),
    }
  } finally {
    await stub.close()
  }
}

// the detector check: RSA-1024 is refused by OpenSSL 3.5 (security level 2) and accepted by 3.0 (level 1)
async function controlMode(nodes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't908-ctl-'))
  const servers = []
  try {
    const mint = (name, bits) => {
      const key = path.join(dir, `${name}.key`)
      const cert = path.join(dir, `${name}.pem`)
      const r = spawnSync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          `rsa:${bits}`,
          '-nodes',
          '-keyout',
          key,
          '-out',
          cert,
          '-subj',
          `/CN=${name}`,
          '-addext',
          `subjectAltName=DNS:${name}`,
          '-days',
          '2',
          '-sha256',
        ],
        { encoding: 'utf8' }
      )
      if (r.status !== 0) throw new Error(`openssl req failed: ${r.stderr}`)
      return {
        name,
        cert: fs.readFileSync(cert, 'utf8'),
        key: fs.readFileSync(key, 'utf8'),
      }
    }
    const weak = mint('weak-rsa1024.p2.test', 1024)
    const strong = mint('strong-rsa2048.p2.test', 2048)
    const results = {}
    for (const pair of [weak, strong]) {
      const server = tls.createServer(
        { cert: pair.cert, key: pair.key, ciphers: 'DEFAULT@SECLEVEL=0' },
        (s) => s.end()
      )
      servers.push(server)
      await new Promise((r) => server.listen(0, '127.0.0.1', r))
      const perNode = await probeUnderNodes(nodes, {
        connectHost: '127.0.0.1',
        port: server.address().port,
        ca: pair.cert,
        targets: [pair.name],
      })
      results[pair.name] = perNode
    }
    const merged = Object.fromEntries(
      nodes.map((v) => [
        v,
        {
          node: results[weak.name][v].node,
          openssl: results[weak.name][v].openssl,
          results: [
            ...results[weak.name][v].results,
            ...results[strong.name][v].results,
          ],
        },
      ])
    )
    return {
      mode: 'control',
      nodes: summary(merged, 2),
      differing: differences(merged),
    }
  } finally {
    for (const s of servers) s.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

async function liveMode(nodes, dir, args) {
  if (!args.includes('--owner-approved') || process.env.T908_LIVE !== '1') {
    console.error(
      't908: DEFERRED (owner): the live probe connects to third-party hosts on port 443 and needs the owner; pass --owner-approved and set T908_LIVE=1 only with that approval'
    )
    return 3
  }
  const list = hostList({ dir })
  const perNode = await probeUnderNodes(nodes, {
    port: 443,
    targets: list.hosts,
    concurrency: 8,
    timeoutMs: 10000,
  })
  console.log(
    JSON.stringify({
      mode: 'live',
      hosts: list.hosts.length,
      nodes: summary(perNode, list.hosts.length),
      differing: differences(perNode),
    })
  )
  return differences(perNode).length ? 1 : 0
}

async function main(argv) {
  const [cmd, ...rest] = argv
  const opt = (name, d) => {
    const i = rest.indexOf(name)
    return i >= 0 ? rest[i + 1] : d
  }
  const nodes = opt('--nodes', DEFAULT_NODES.join(',')).split(',')
  if (cmd === 'worker') return worker(opt('--spec'))
  if (cmd === 'hosts') {
    console.log(JSON.stringify(hostList({ dir: opt('--data-dir') })))
    return 0
  }
  if (cmd === 'stub') {
    const out = await stubMode(nodes, opt('--data-dir'))
    console.log(JSON.stringify(out))
    return out.differing.length ? 1 : 0
  }
  if (cmd === 'control') {
    const out = await controlMode(nodes)
    console.log(JSON.stringify(out))
    return out.differing.length ? 1 : 0
  }
  if (cmd === 'live') return liveMode(nodes, opt('--data-dir'), rest)
  console.error(
    'usage: t908-logo-tls.mjs hosts | stub | control | live --owner-approved | worker --spec <file> (see the header)'
  )
  return 2
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  // exitCode, not exit(): a pipe may still hold the JSON the worker printed
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code || 0
    },
    (e) => {
      console.error(`t908: ${e.message}`)
      process.exitCode = 2
    }
  )

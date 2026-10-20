#!/usr/bin/env node
// Gateway-equivalent proxy generator (40 §2.3, T-612). Reads kube/{prod,stage}/httproute.yaml, asserts the two
// differ only in metadata.namespace and spec.hostnames, and emits from the prod rules:
//   - an nginx config: :8080 gateway-faithful, :8081 allow-all (local-only pages, Q-005), both to the app;
//   - a JSON route table (host mode: e2e/proxy/node-proxy.mjs serves the same table).
// Semantics (Gateway API HTTPRoute, kube/prod/httproute.yaml:13-65): PathPrefix matches whole path elements on the
// raw request path (`/search/x`, never `/searchx`; no slash merging, no decoding); the longest matching prefix
// wins; URLRewrite ReplacePrefixMatch replaces the matched prefix; backend timeout 30 s (the 35 s request
// timeout is not emulated); anything else is answered 404 by "another service". Never hand-edited.
//
// Usage:
//   node e2e/proxy/generate.mjs [--overlay cs-ops-1] [--out <dir>] [--app <host:port>] [--listen-gateway <port>]
//                               [--listen-allow <port>] [--json]
//   node e2e/proxy/generate.mjs --self-test
// --overlay cs-ops-1 adds the 20 §2.0 rule (PathPrefix /search/_next/data -> ReplacePrefixMatch /_next/data)
// before the /static/search rule, for tests only (I-05).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { routeFor as nodeRouteFor } from './node-proxy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '..', '..')
export const DEBUG_HEADER = 'x-p2-debug'

// the exact rule of docs/upgrade/20-change-sites.md §2.0 (CS-OPS-1)
export const CS_OPS_1_YAML = `
- matches: [{path: {type: PathPrefix, value: /search/_next/data}}]
  filters:
    - {type: URLRewrite, urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /_next/data}}}
  timeouts: {request: 35s, backendRequest: 30s}
  backendRefs: [{name: core-frontend-search, port: 80}]
`

const read = (env) =>
  YAML.parse(
    fs.readFileSync(path.join(REPO, 'kube', env, 'httproute.yaml'), 'utf8')
  )

// prod and stage may differ only in metadata.namespace and spec.hostnames
export function compareEnvs(prod = read('prod'), stage = read('stage')) {
  const strip = (doc) => {
    const d = JSON.parse(JSON.stringify(doc))
    delete d.metadata.namespace
    delete d.spec.hostnames
    return d
  }
  const same = JSON.stringify(strip(prod)) === JSON.stringify(strip(stage))
  return {
    same,
    prod: {
      namespace: prod.metadata.namespace,
      hostnames: prod.spec.hostnames,
    },
    stage: {
      namespace: stage.metadata.namespace,
      hostnames: stage.spec.hostnames,
    },
  }
}

const seconds = (s) => (s == null ? null : Number(String(s).replace(/s$/, '')))

// flatten HTTPRoute rules into prefix entries
export function routeTable({ overlay = null, doc = read('prod') } = {}) {
  let rules = doc.spec.rules.slice()
  if (overlay === 'cs-ops-1') {
    const extra = YAML.parse(CS_OPS_1_YAML)
    const i = rules.findIndex((r) =>
      r.matches.some((m) => m.path && m.path.value === '/static/search')
    )
    rules = [...rules.slice(0, i), ...extra, ...rules.slice(i)]
  } else if (overlay) throw new Error(`unknown overlay ${overlay}`)
  const entries = []
  rules.forEach((rule, ruleIndex) => {
    const rewrite = (rule.filters || []).find((f) => f.type === 'URLRewrite')
    const replace =
      rewrite &&
      rewrite.urlRewrite.path &&
      rewrite.urlRewrite.path.type === 'ReplacePrefixMatch'
        ? rewrite.urlRewrite.path.replacePrefixMatch
        : null
    for (const m of rule.matches) {
      if (!m.path || m.path.type !== 'PathPrefix')
        throw new Error(`unsupported match ${JSON.stringify(m)}`)
      const prefix =
        m.path.value.length > 1 ? m.path.value.replace(/\/$/, '') : m.path.value
      entries.push({
        rule: ruleIndex,
        prefix,
        replacePrefixMatch: replace,
        backendRequestTimeout: seconds(
          rule.timeouts && rule.timeouts.backendRequest
        ),
        requestTimeout: seconds(rule.timeouts && rule.timeouts.request),
        backend: rule.backendRefs.map((b) => `${b.name}:${b.port}`),
      })
    }
  })
  // longest prefix first (ties keep rule order)
  entries.sort((a, b) => b.prefix.length - a.prefix.length || a.rule - b.rule)
  const table = { source: 'kube/prod/httproute.yaml', overlay, entries }
  table.sha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex')
  return table
}

// raw request target -> { route: entry prefix | 'other', upstream: raw target sent to the app }
export function routeFor(table, target) {
  const q = target.indexOf('?')
  const rawPath = q < 0 ? target : target.slice(0, q)
  const query = q < 0 ? '' : target.slice(q)
  for (const e of table.entries) {
    const matches =
      e.prefix === '/' ||
      rawPath === e.prefix ||
      rawPath.startsWith(`${e.prefix}/`)
    if (!matches) continue
    if (e.replacePrefixMatch == null)
      return {
        route: e.prefix,
        upstream: target,
        timeout: e.backendRequestTimeout,
      }
    const rest = rawPath.slice(e.prefix.length)
    const R = e.replacePrefixMatch
    const upstreamPath =
      R.endsWith('/') && rest.startsWith('/') ? R + rest.slice(1) : R + rest
    return {
      route: e.prefix,
      upstream: (upstreamPath || '/') + query,
      timeout: e.backendRequestTimeout,
    }
  }
  return { route: 'other', upstream: null }
}

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function nginxConfig(
  table,
  {
    app = 'app:8080',
    gatewayPort = 8080,
    allowPort = 8081,
    accessLog = '/dev/stdout',
  } = {}
) {
  const lines = []
  const routeMap = []
  const uriMap = []
  table.entries.forEach((e, i) => {
    const P = reEscape(e.prefix)
    routeMap.push(`    "~^${P}(?:[/?]|$)" "${e.prefix}";`)
    if (e.replacePrefixMatch == null)
      uriMap.push(`    "~^${P}(?:[/?]|$)" "$request_uri";`)
    else if (e.replacePrefixMatch.endsWith('/'))
      uriMap.push(
        `    "~^${P}(?:/(?<p2a${i}>[^?]*))?(?<p2b${i}>\\?.*)?$" "${e.replacePrefixMatch}$p2a${i}$p2b${i}";`
      )
    else
      uriMap.push(
        `    "~^${P}(?<p2a${i}>/[^?]*)?(?<p2b${i}>\\?.*)?$" "${e.replacePrefixMatch}$p2a${i}$p2b${i}";`
      )
  })
  const timeout = Math.max(
    ...table.entries.map((e) => e.backendRequestTimeout || 30)
  )
  lines.push(
    `# generated by e2e/proxy/generate.mjs from ${table.source}${
      table.overlay ? ` + overlay ${table.overlay}` : ''
    }; route table sha256 ${table.sha256}`,
    'worker_processes 1;',
    'error_log /dev/stderr warn;',
    'pid /tmp/nginx.pid;',
    'events { worker_connections 1024; }',
    'http {',
    `  log_format p2 '$remote_addr "$request" $status $body_bytes_sent route=$p2_route upstream="$p2_uri" rt=$request_time';`,
    `  access_log ${accessLog} p2;`,
    '  client_body_temp_path /tmp/client_body;',
    '  proxy_temp_path /tmp/proxy;',
    '  large_client_header_buffers 8 64k;',
    '  map $request_uri $p2_route {',
    ...routeMap,
    '    default "other";',
    '  }',
    '  map $request_uri $p2_uri {',
    ...uriMap,
    '    default "";',
    '  }',
    `  map $http_${DEBUG_HEADER.replace(
      /-/g,
      '_'
    )} $p2_dbg_uri { "1" $p2_uri; default ""; }`,
    `  map $http_${DEBUG_HEADER.replace(
      /-/g,
      '_'
    )} $p2_dbg_route { "1" $p2_route; default ""; }`,
    `  upstream p2_app { server ${app}; keepalive 16; }`,
    '  server {',
    `    listen ${gatewayPort};`,
    '    merge_slashes off;',
    '    location / {',
    '      if ($p2_route = "other") { return 404 "other service\\n"; }',
    '      add_header X-P2-Route $p2_dbg_route always;',
    '      add_header X-P2-Upstream $p2_dbg_uri always;',
    '      proxy_http_version 1.1;',
    '      proxy_set_header Connection "";',
    '      proxy_set_header Host $http_host;',
    '      proxy_set_header X-P2-Debug "";',
    '      proxy_buffering off;',
    '      proxy_redirect off;',
    `      proxy_connect_timeout ${timeout}s;`,
    `      proxy_send_timeout ${timeout}s;`,
    `      proxy_read_timeout ${timeout}s;`,
    '      proxy_pass http://p2_app$p2_uri;',
    '    }',
    '  }',
    '  server {',
    `    listen ${allowPort};`,
    '    merge_slashes off;',
    '    location / {',
    '      proxy_http_version 1.1;',
    '      proxy_set_header Connection "";',
    '      proxy_set_header Host $http_host;',
    '      proxy_buffering off;',
    '      proxy_redirect off;',
    '      proxy_pass http://p2_app$request_uri;',
    '    }',
    '  }',
    '}',
    ''
  )
  return lines.join('\n')
}

// the T-612 acceptance table: target -> expected route and upstream target (null = other service).
// Targets the app answers without an upstream call (redirects, 404 pages, cached data), except /display/1/,
// whose output request the T-612 spec answers with a stub rule, so the table needs no recorded fixture.
export const ACCEPTANCE = [
  ['/searchx', 'other', null],
  ['/searchx/', 'other', null],
  ['/search', '/search', '/search'],
  ['/search/', '/search', '/search/'],
  ['/search?q=a+b', '/search', '/search?q=a+b'],
  ['/search?q=%C3%BC', '/search', '/search?q=%C3%BC'],
  ['/search/%C3%BC/', '/search', '/search/%C3%BC/'],
  ['/static/search', '/static/search', '/'],
  ['/static/search/', '/static/search', '/'],
  ['/static/search/icons.svg', '/static/search', '/icons.svg'],
  [
    '/static/search/_next/static/chunks/x.js',
    '/static/search',
    '/_next/static/chunks/x.js',
  ],
  [
    '/static/search/_next/image?url=%2Fx.png&w=64&q=75',
    '/static/search',
    '/_next/image?url=%2Fx.png&w=64&q=75',
  ],
  ['/static/searchx', 'other', null],
  ['/display', '/display', '/outputs'],
  ['/display/', '/display', '/outputs/'],
  ['/display/1/', '/display', '/outputs/1/'],
  ['/display/1?source=oai', '/display', '/outputs/1?source=oai'],
  ['//works/1', 'other', null],
  ['/works//1', '/works', '/works//1'],
  ['/works/1001', '/works', '/works/1001'],
  ['/works%2F1001/', 'other', null],
  ['/search/a%2Fb/', '/search', '/search/a%2Fb/'],
  ['/outputs/2001', '/outputs', '/outputs/2001'],
  ['/data-providers/', '/data-providers', '/data-providers/'],
  ['/data-providers/?q=100%25', '/data-providers', '/data-providers/?q=100%25'],
  ['/_next/static/chunks/x.js', 'other', null],
  ['/_next/data/b/works/1.json', 'other', null],
  [
    '/search/_next/data/b/works/1001.json?id=1001',
    '/search',
    '/search/_next/data/b/works/1001.json?id=1001',
  ],
  ['/', 'other', null],
  ['/api/healthz/', 'other', null],
  ['/error-card/', 'other', null],
  ['/robots.txt', 'other', null],
  ['/404', 'other', null],
]
export const ACCEPTANCE_CS_OPS_1 = [
  [
    '/search/_next/data/b/works/1001.json?id=1001',
    '/search/_next/data',
    '/_next/data/b/works/1001.json?id=1001',
  ],
  ['/search/_next/data', '/search/_next/data', '/_next/data'],
  ['/search/_next/datax', '/search', '/search/_next/datax'],
  ['/search/?q=x', '/search', '/search/?q=x'],
  ['/static/search/icons.svg', '/static/search', '/icons.svg'],
]
// 4,000 characters: the app's 308 repeats the target in Location and Refresh, and with the debug header the
// response headers stay under the 16 KiB a Node HTTP client parses
export const longUrl = () => `/search?q=${'a'.repeat(4000)}`

export function selfTest() {
  const out = []
  const ok = (name, cond, detail) => out.push({ name, ok: !!cond, detail })
  const cmp = compareEnvs()
  ok('prod and stage differ only in namespace and hostnames', cmp.same, cmp)
  const t = routeTable()
  ok(
    'rules flattened (6 prefixes)',
    t.entries.length === 6,
    t.entries.map((e) => e.prefix)
  )
  ok(
    'backend timeout 30 s on every rule',
    t.entries.every((e) => e.backendRequestTimeout === 30),
    null
  )
  for (const [target, route, upstream] of ACCEPTANCE) {
    const r = routeFor(t, target)
    ok(`route ${target}`, r.route === route && r.upstream === upstream, r)
  }
  const long = routeFor(t, longUrl())
  ok(
    'long URL routed unchanged',
    long.route === '/search' && long.upstream === longUrl(),
    null
  )
  const o = routeTable({ overlay: 'cs-ops-1' })
  ok(
    'overlay adds one prefix',
    o.entries.length === 7 && o.sha256 !== t.sha256,
    null
  )
  for (const [target, route, upstream] of ACCEPTANCE_CS_OPS_1) {
    const r = routeFor(o, target)
    ok(
      `overlay route ${target}`,
      r.route === route && r.upstream === upstream,
      r
    )
  }
  // the host-mode proxy serves the same algorithm
  for (const [target] of [...ACCEPTANCE, ...ACCEPTANCE_CS_OPS_1]) {
    for (const table of [t, o])
      ok(
        `node-proxy agrees on ${target}${table.overlay ? ' (overlay)' : ''}`,
        JSON.stringify(nodeRouteFor(table, target)) ===
          JSON.stringify(routeFor(table, target)),
        null
      )
  }
  const conf = nginxConfig(t)
  ok(
    'nginx: merge_slashes off on both servers',
    (conf.match(/merge_slashes off;/g) || []).length === 2,
    null
  )
  ok(
    'nginx: raw request_uri routing',
    /map \$request_uri \$p2_route/.test(conf) &&
      /proxy_pass http:\/\/p2_app\$p2_uri;/.test(conf),
    null
  )
  ok('nginx: 30 s backend timeout', /proxy_read_timeout 30s;/.test(conf), null)
  ok(
    'nginx: other service 404',
    /return 404 "other service\\n";/.test(conf),
    null
  )
  // the nginx regexes agree with routeFor on the acceptance table
  const rx = [...conf.matchAll(/^ {4}"~(\^[^"]+)" "([^"]+)";$/gm)]
  const routeRegexes = rx
    .slice(0, t.entries.length)
    .map((m) => [new RegExp(m[1]), m[2]])
  for (const [target, route] of ACCEPTANCE) {
    const hit = routeRegexes.find(([re]) => re.test(target))
    ok(
      `nginx route regex ${target}`,
      (hit ? hit[1] : 'other') === route,
      hit && hit[1]
    )
  }
  return out
}

function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  if (argv.includes('--self-test')) {
    const rows = selfTest()
    const bad = rows.filter((r) => !r.ok)
    for (const r of bad)
      console.log(`FAIL ${r.name} ${JSON.stringify(r.detail)}`)
    console.log(
      `proxy generator self-test: ${rows.length - bad.length}/${rows.length} ok`
    )
    process.exit(bad.length ? 1 : 0)
  }
  const cmp = compareEnvs()
  if (!cmp.same) {
    console.error(
      'kube/prod and kube/stage httproute.yaml differ outside metadata.namespace and spec.hostnames'
    )
    process.exit(1)
  }
  const table = routeTable({ overlay: opt('--overlay', null) })
  const conf = nginxConfig(table, {
    app: opt('--app', 'app:8080'),
    gatewayPort: Number(opt('--listen-gateway', 8080)),
    allowPort: Number(opt('--listen-allow', 8081)),
  })
  const out = opt('--out', null)
  if (out) {
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(out, 'nginx.conf'), conf)
    fs.writeFileSync(
      path.join(out, 'routes.json'),
      `${JSON.stringify(table, null, 1)}\n`
    )
  }
  if (argv.includes('--json')) console.log(JSON.stringify(table, null, 1))
  else if (!out) process.stdout.write(conf)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  main(process.argv.slice(2))

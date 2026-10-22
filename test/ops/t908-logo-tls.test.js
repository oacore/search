// T-908 (41 J; R-080): the logo TLS probe, test/ops/t908-logo-tls.mjs.
// `checkLogo` swallows every error, so a host whose certificate Node 24's
// OpenSSL (security level 2) refuses would only show as a missing logo. The
// probe lists the hosts (the member data providers' homepage hosts of the
// members/formap snapshot, the host of the recorded member-logo URLs, doi.org),
// TLS-connects to each under Node 22.18.0 and Node 24.18.1 and diffs. Here it
// runs against the SSR stub's TLS endpoint (one leaf per host, a test CA):
// both Nodes must accept every host. A detector check proves the probe sees the
// difference R-080 describes (an RSA-1024 certificate). The live hosts are
// DEFERRED: contacting third-party servers needs the owner, and the probe
// refuses without it.
// Ops test, outside the default Jest projects. Run:
//  npx jest --config '{"testMatch":["**/ops/t908*.test.js"],"transform":{}}'
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

jest.setTimeout(300000)

const REPO = path.resolve(__dirname, '..', '..')
const PROBE = path.join(REPO, 'test', 'ops', 't908-logo-tls.mjs')
const NODES = ['22.18.0', '24.18.1']

const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, [PROBE, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    env: { ...process.env, ...env },
  })
  return { rc: r.status, out: r.stdout, err: r.stderr }
}
const json = (r) => JSON.parse(r.out)

// the same list from the data files with this file's own few lines
const expectedHosts = (source) => {
  const dir = path.join(REPO, source)
  const members = JSON.parse(
    fs.readFileSync(path.join(dir, '.members.json'), 'utf8')
  )
  const formap = JSON.parse(
    fs.readFileSync(path.join(dir, '.formap.json'), 'utf8')
  )
  const home = new Map(formap.map((p) => [Number(p.id), p.urlHomepage]))
  const hosts = new Set(['api.core.ac.uk', 'doi.org'])
  for (const m of members) {
    for (const id of [].concat(m.repo_id)) {
      const value = home.get(Number(id))
      let host = null
      for (const candidate of value ? [value, `https://${value}`] : []) {
        try {
          host = new URL(candidate).hostname.toLowerCase()
          break
        } catch (e) {
          host = null
        }
      }
      if (host && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) hosts.add(host)
    }
  }
  return [...hosts].sort()
}

describe('T-908 @P1 logo TLS probe, Node 22 vs 24 (stub endpoint; live hosts DEFERRED)', () => {
  test('T-908 @P1 host list: the member homepage hosts of the members/formap snapshot, the logo host and doi.org; names only', () => {
    const r = run(['hosts'])
    expect(r.rc).toBe(0)
    const list = json(r)
    expect(list.members).toBe(477)
    expect(list.hosts).toEqual(expectedHosts(list.source))
    expect(list.hosts).toContain('doi.org')
    // every recorded member-logo URL is on this host
    expect(list.hosts).toContain('api.core.ac.uk')
    expect(list.hosts.length).toBeGreaterThan(400)
    expect(list.hosts).toEqual([...list.hosts].sort())
    expect(new Set(list.hosts).size).toBe(list.hosts.length)
    for (const h of list.hosts) {
      expect(h).toMatch(/^[a-z0-9.-]+$/)
      expect(net.isIP(h)).toBe(0)
    }
    // the unusable rows are counted, not listed (the snapshot holds contact
    // e-mail addresses: none is read out)
    expect(list.skipped).toEqual({
      noProvider: expect.any(Number),
      noHomepage: expect.any(Number),
      ipLiteral: expect.any(Number),
      invalidHost: expect.any(Number),
    })
    expect(r.out).not.toMatch(/@/)
    // the hosts of the recorded logo URLs, from the fixtures (the request URL
    // sits in the first bytes): one host
    const logoHosts = new Set()
    const head = (file) => {
      const fd = fs.openSync(file, 'r')
      try {
        const buf = Buffer.alloc(800)
        const n = fs.readSync(fd, buf, 0, buf.length, 0)
        return buf.toString('utf8', 0, n)
      } finally {
        fs.closeSync(fd)
      }
    }
    const apiDir = path.join(REPO, 'test', 'fixtures', 'api')
    for (const scenario of fs.readdirSync(apiDir)) {
      for (const f of fs.readdirSync(path.join(apiDir, scenario))) {
        const m = /"url": "https:\/\/([^/"]+)\/data-providers\/\d+\/logo"/.exec(
          head(path.join(apiDir, scenario, f))
        )
        if (m) logoHosts.add(m[1])
      }
    }
    expect([...logoHosts]).toEqual(['api.core.ac.uk'])
  })

  test('T-908 @P1 stub TLS endpoint: every host is accepted by Node 22.18.0 and Node 24.18.1, with the certificate of that host, and no outcome differs', () => {
    const r = run(['stub'])
    expect(r.err).toBe('')
    expect(r.rc).toBe(0)
    const out = json(r)
    const n = out.hosts
    expect(n).toBeGreaterThan(400)
    expect(Object.keys(out.nodes)).toEqual(NODES)
    // two different Node binaries with two different OpenSSL lines: the probe
    // really ran under both
    expect(out.nodes['22.18.0'].node).toBe('v22.18.0')
    expect(out.nodes['24.18.1'].node).toBe('v24.18.1')
    expect(out.nodes['22.18.0'].openssl).toMatch(/^3\.0\./)
    expect(out.nodes['24.18.1'].openssl).toMatch(/^3\.5\./)
    for (const v of NODES) {
      expect(out.nodes[v]).toMatchObject({
        probed: n,
        ok: n,
        failed: 0,
        sanMatches: n,
      })
    }
    expect(out.failures).toEqual({ '22.18.0': [], '24.18.1': [] })
    expect(out.differing).toEqual([])
    // the list probed is the list of the host command
    expect(n).toBe(json(run(['hosts'])).hosts.length)
  })

  test('T-908 @P1 detector check: an RSA-1024 certificate (R-080) is accepted by Node 22.18.0 and refused by Node 24.18.1, and it is the only difference', () => {
    const r = run(['control'])
    expect(r.rc).toBe(1)
    const out = json(r)
    expect(out.differing).toEqual([
      {
        host: 'weak-rsa1024.p2.test',
        outcomes: {
          '22.18.0': 'ok',
          '24.18.1': expect.stringMatching(
            /^error \w+: EE certificate key too weak/
          ),
        },
      },
    ])
    // the RSA-2048 server is accepted by both
    expect(out.nodes['22.18.0']).toMatchObject({ probed: 2, ok: 2 })
    expect(out.nodes['24.18.1']).toMatchObject({ probed: 2, ok: 1, failed: 1 })
  })

  test('T-908 @P1 a refused connection is reported as a failed host with its error code, never as a pass', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't908-test-'))
    try {
      // a port nobody listens on
      const server = net.createServer()
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const { port } = server.address()
      await new Promise((resolve) => server.close(resolve))
      const spec = path.join(dir, 'spec.json')
      fs.writeFileSync(
        spec,
        JSON.stringify({
          connectHost: '127.0.0.1',
          port,
          targets: ['closed.p2.test'],
          timeoutMs: 5000,
        })
      )
      const r = run(['worker', '--spec', spec])
      expect(r.rc).toBe(0)
      const out = json(r)
      expect(out.results).toHaveLength(1)
      expect(out.results[0]).toMatchObject({
        host: 'closed.p2.test',
        ok: false,
        error: { code: 'ECONNREFUSED' },
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('T-908 @P1 live hosts are DEFERRED: the live mode refuses (exit 3) without the owner flag and without T908_LIVE=1', () => {
    for (const [args, env] of [
      [['live'], {}],
      [['live', '--owner-approved'], { T908_LIVE: '' }],
      [['live'], { T908_LIVE: '1' }],
    ]) {
      const r = run(args, env)
      expect(r.rc).toBe(3)
      expect(r.out).toBe('')
      expect(r.err).toMatch(/DEFERRED \(owner\)/)
    }
  })
})

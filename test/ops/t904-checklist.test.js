// T-904 (41 J; R-003, R-026, R-041, R-083): the manual checklist is the
// structured file test/ops/t904-checklist.json. This test checks its structure
// against the plan, so the checklist cannot drift from the 41 row it
// implements. Executing it needs the deployed site, the probe path of VF-14
// and the team's accounts: DEFERRED to the owner (Q-096). The items stay
// DEFERRED here and the structure test accepts the filled-in form too.
//   c1 GA realtime            c2 Sentry test event
//   c3 LogRocket session      c4 Rich Results + Scholar meta
//   c5 edge headers incl. cf-cache-status
// Ops test, outside the default Jest projects. Run:
//  npx jest --config '{"testMatch":["**/ops/t904*.test.js"],"transform":{}}'
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8')
const checklist = JSON.parse(read('test/ops/t904-checklist.json'))

// the T-904 row of 41: [id, priority, target, cases, risks, waves]
const row = (() => {
  const line = read('docs/upgrade/41-test-inventory.md')
    .split('\n')
    .find((l) => l.startsWith('| T-904 |'))
  const cells = line.split('|').map((c) => c.trim())
  return { cases: cells[4], risks: cells[5], waves: cells[6] }
})()

// the checker's rule (41 section 0): clauses are the Cases cell split on
// top-level `;`
const clausesOf = (cell) => {
  const out = []
  let depth = 0
  let tick = false
  let cur = ''
  for (const ch of cell) {
    if (ch === '`') tick = !tick
    else if (!tick && ch === '(') depth += 1
    else if (!tick && ch === ')') depth -= 1
    if (ch === ';' && depth === 0 && !tick) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}
const listOf = (cell) =>
  cell.split(',').flatMap((w) => {
    const t = w.trim()
    const range = /^(W\d)([a-z])–(W\d)([a-z])$/.exec(t)
    return range
      ? Array.from(
          { length: range[4].charCodeAt(0) - range[2].charCodeAt(0) + 1 },
          (_, i) =>
            `${range[1]}${String.fromCharCode(range[2].charCodeAt(0) + i)}`
        )
      : [t]
  })

const ROW_CLAUSES = clausesOf(row.cases)
const ROW_RISKS = listOf(row.risks)
const ROW_WAVES = listOf(row.waves)

// the registers the checklist cites
const register = {
  Q: read('docs/upgrade/30-quirks-register.md'),
  R: read('docs/upgrade/10-risk-register.md'),
  VF: read('docs/upgrade/STATUS.md'),
}
const known = (id) => {
  const kind = id.startsWith('VF-') ? 'VF' : id[0]
  const re =
    kind === 'VF'
      ? new RegExp(`^\\|${id}\\|`, 'm')
      : new RegExp(`^\\| ${id}\\b`, 'm')
  return re.test(register[kind])
}

const strings = (value) => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(strings)
  return []
}
const allText = strings(checklist)

describe('T-904 @P1 manual checklist (structure; execution DEFERRED, Q-096)', () => {
  test('T-904 c1 @P1 GA realtime: item c1 follows the 41 clause, names its risk and quirks, and checks the three cookie states', () => {
    const item = checklist.items[0]
    expect(item.id).toBe('c1')
    expect(item.clause).toBe(ROW_CLAUSES[0])
    expect(item.clause).toBe('GA realtime')
    expect(item.risks).toEqual(['R-041'])
    expect(item.quirks).toEqual(expect.arrayContaining(['Q-070', 'Q-071']))
    const text = [...item.steps, ...item.expect].join(' ')
    expect(text).toMatch(/Realtime/)
    expect(text).toMatch(/page_view/)
    expect(text).toMatch(/Essential only/)
    expect(text).toMatch(/I agree/)
    expect(item.evidence.kind).toBe('screenshot')
  })

  test('T-904 c2 @P1 Sentry test event where a DSN exists (VF-04): item c2 covers the no-DSN and the CSP-blocked outcomes', () => {
    const item = checklist.items[1]
    expect(item.id).toBe('c2')
    expect(item.clause).toBe(ROW_CLAUSES[1])
    expect(item.clause).toMatch(/^Sentry test event where a DSN exists/)
    expect(item.verifies).toEqual(expect.arrayContaining(['VF-04']))
    expect(item.quirks).toEqual(expect.arrayContaining(['Q-096', 'Q-074']))
    const text = [...item.prerequisites, ...item.steps, ...item.expect].join(
      ' '
    )
    // stage has no Sentry.init; the legacy DSN host does not match the CSP
    // (Q-096): both outcomes are named
    expect(text).toMatch(/NOT-APPLICABLE/)
    expect(text).toMatch(/Content-Security-Policy/)
    expect(text).toMatch(/doi/i)
    expect(text).toMatch(/100%25/)
    expect(item.evidence.kind).toBe('link')
  })

  test('T-904 c3 @P1 LogRocket session: item c3 asks for a replayable session and no CSP violation on a LogRocket host', () => {
    const item = checklist.items[2]
    expect(item.id).toBe('c3')
    expect(item.clause).toBe(ROW_CLAUSES[2])
    expect(item.clause).toBe('LogRocket session')
    expect(item.risks).toEqual(['R-026'])
    expect(item.quirks).toEqual(expect.arrayContaining(['Q-009']))
    const text = [...item.steps, ...item.expect].join(' ')
    expect(text).toMatch(/logrocket\.com/)
    expect(text).toMatch(/lgrckt-in\.com/)
    expect(text).toMatch(/logr-in\.com/)
    expect(text).toMatch(/session/)
  })

  test('T-904 c4 @P1 Rich Results + Scholar meta on prod after the merge (stage first when used): item c4 compares the head before and after and runs the tester', () => {
    const item = checklist.items[3]
    expect(item.id).toBe('c4')
    expect(item.clause).toBe(ROW_CLAUSES[3])
    expect(item.clause).toMatch(
      /^Rich Results \+ Scholar meta on prod after the merge/
    )
    expect(item.risks).toEqual(['R-003'])
    expect(item.quirks).toEqual(expect.arrayContaining(['Q-053']))
    const text = [...item.prerequisites, ...item.steps, ...item.expect].join(
      ' '
    )
    expect(text).toMatch(/Rich Results Test/)
    expect(text).toMatch(/citation_title/)
    expect(text).toMatch(/citation_author/)
    expect(text).toMatch(/citation_publication_date/)
    expect(text).toMatch(/JSON-LD/)
    expect(text).toMatch(/stage/i)
  })

  test('T-904 c5 @P1 edge headers incl. cf-cache-status (VF-14): item c5 lists the header classes of the contract baseline', () => {
    const item = checklist.items[4]
    expect(item.id).toBe('c5')
    expect(item.clause).toBe(ROW_CLAUSES[4])
    expect(item.clause).toMatch(/cf-cache-status/)
    expect(item.risks).toEqual(['R-083'])
    expect(item.verifies).toEqual(expect.arrayContaining(['VF-14']))
    const steps = item.steps.join(' ')
    expect(steps).toMatch(/cf-cache-status/)
    // every class of the origin's header baseline (T-603) that an edge could
    // change
    const baseline = JSON.parse(read('e2e/http/contract.baseline.json'))
    const classes = [...new Set(baseline.routes.map((r) => r.class))]
    expect(classes).toEqual(
      expect.arrayContaining([
        'HTML',
        '_next/data',
        'public/',
        '_next/static',
        '308',
        '404',
      ])
    )
    expect(steps).toMatch(/getServerSideProps/)
    expect(steps).toMatch(/getInitialProps/)
    expect(steps).toMatch(/_next\/data/)
    expect(steps).toMatch(/_next\/static/)
    expect(steps).toMatch(/308/)
    expect(steps).toMatch(/404/)
    expect(item.expect.join(' ')).toMatch(/no-store/)
  })

  test('T-904 @P1 the checklist file is the 41 row: one item per clause, risks and waves covered, ids known, evidence and status consistent', () => {
    expect(checklist.schema).toBe(1)
    expect(checklist.id).toBe('T-904')
    // 41 is the source: five clauses, four risks, the wave list
    expect(ROW_CLAUSES).toHaveLength(5)
    expect(ROW_RISKS).toEqual(['R-003', 'R-026', 'R-041', 'R-083'])
    expect(checklist.waves).toEqual(ROW_WAVES)
    expect(checklist.items.map((i) => i.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
    ])
    expect(checklist.items.map((i) => i.clause)).toEqual(ROW_CLAUSES)
    // the items together cover every risk and every wave of the row, and name
    // nothing outside it
    const usedRisks = new Set(checklist.items.flatMap((i) => i.risks))
    expect([...usedRisks].sort()).toEqual([...ROW_RISKS].sort())
    const usedWaves = new Set(checklist.items.flatMap((i) => i.waves))
    expect([...usedWaves].sort()).toEqual([...ROW_WAVES].sort())
    for (const item of checklist.items) {
      // fields and types
      expect(typeof item.title).toBe('string')
      for (const key of [
        'risks',
        'quirks',
        'verifies',
        'waves',
        'prerequisites',
        'steps',
        'expect',
      ])
        expect(Array.isArray(item[key])).toBe(true)
      expect(item.risks.length).toBeGreaterThan(0)
      expect(item.waves.length).toBeGreaterThan(0)
      expect(item.prerequisites.length).toBeGreaterThan(0)
      expect(item.steps.length).toBeGreaterThanOrEqual(3)
      expect(item.expect.length).toBeGreaterThan(0)
      for (const s of [...item.steps, ...item.expect, ...item.prerequisites])
        expect(typeof s === 'string' && s.length > 20).toBe(true)
      expect(['screenshot', 'link', 'text']).toContain(item.evidence.kind)
      expect(item.evidence.record.length).toBeGreaterThan(10)
      expect(typeof item.onFailure).toBe('string')
      // waves belong to the row
      expect(item.waves.filter((w) => !ROW_WAVES.includes(w))).toEqual([])
      // ids cited exist in the registers
      for (const id of [...item.risks, ...item.quirks, ...item.verifies])
        expect([id, known(id)]).toEqual([id, true])
      // status: DEFERRED with no result, or filled in
      expect(['DEFERRED', 'DONE', 'NOT-APPLICABLE']).toContain(item.status)
      if (item.status === 'DEFERRED') expect(item.result).toBeNull()
      else {
        expect(item.result).toEqual(
          expect.objectContaining({
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            by: expect.any(String),
            step: expect.any(String),
            evidence: expect.any(String),
          })
        )
      }
    }
    // the execution state of the file: deferred with its reason, Q-096 and
    // VF-14 named
    expect(['DEFERRED', 'DONE']).toContain(checklist.execution.status)
    expect(checklist.execution.reason).toMatch(/Q-096/)
    expect(checklist.execution.reason).toMatch(/VF-14/)
    if (checklist.execution.status === 'DONE')
      expect(checklist.items.filter((i) => i.status === 'DEFERRED')).toEqual([])
    else expect(checklist.items.some((i) => i.status === 'DEFERRED')).toBe(true)

    // paths the file cites are repo-relative and exist
    const cited = allText.flatMap((t) =>
      (t.match(/\b(?:docs|test|e2e|scripts)\/[A-Za-z0-9_./-]+/g) || []).map(
        (p) => p.replace(/[.,;:]+$/, '')
      )
    )
    expect(cited.length).toBeGreaterThan(3)
    expect(cited.filter((p) => !fs.existsSync(path.join(REPO, p)))).toEqual([])
    expect(
      allText.filter((t) => /(^|\s)\/(Users|home|private|tmp)\//.test(t))
    ).toEqual([])
    // no address, credential or token in a checklist that people fill in and
    // commit
    const joined = allText.join('\n')
    expect(joined).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/)
    expect(joined).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/-]{8,}/)
    expect(joined).not.toMatch(/-----BEGIN/)
    expect(joined).not.toMatch(/https?:\/\/[^\s/]*:[^\s/]*@/)
    expect(joined).not.toMatch(/\b(api[_-]?key|secret|password)\s*[:=]/i)
  })
})

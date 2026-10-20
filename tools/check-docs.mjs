#!/usr/bin/env node
// check-docs.mjs - consistency checker for docs/upgrade/*.md
//
// Usage:
//   node check-docs.mjs <docsDir> [--findings <dir>] [--repo <gitDir>] [--tree <treeish>]
//                       [--scan-findings] [--scan-history <range>] [--tests <dir,dir>] [--cases-out <file>]
//                       [--constants] [--json]
//
//   <docsDir>   directory holding README.md, STATUS.md and NN-*.md
//   --findings  directory that `findings/...` links resolve to (default <docsDir>/findings)
//   --repo      git checkout used to verify code `path:line` citations (optional)
//   --tree      tree-ish for code citations (default a825839)
//   --scan-findings  also apply the forbidden-text rule to every text file under the findings dir
//   --scan-history   apply the forbidden-text rule to the messages and diffs of `git log -p <range>` in --repo
//   --tests     dirs whose test titles (`T-###`, `T-### c<k>`) must name an active T row of 41 (e.g. test,e2e);
//               a row with several Cases clauses (41 §0) needs a test per clause once it has any test
//   --cases-out write the 41 Cases clauses and the 30 quirk clauses as JSON ({T-###: {p, clauses}, Q-###: {pinnedBy, clauses}})
//               to <file>; a quirk clause = the behaviour cell split on top-level `;` and before `(b)`...`(e)` items (30 §1 rule 1)
//   --constants print the sha256 of the T-805 list, the 40 §1 normalisation column and the 42 §8 key rule
//               (the values T-012 pins, 40 §8 rule 8) as JSON and exit
//
// Reports (exit 1 if any ERROR):
//   ERROR undefined-id     an ID referenced somewhere but defined in no owner doc
//   ERROR duplicate-def    an ID defined twice (owner-doc table first cell / heading)
//   ERROR broken-link      a markdown link to a missing file
//   ERROR broken-anchor    a #anchor or a "NN §x" section reference with no matching heading
//   ERROR forbidden-text   home-relative or absolute local paths, working-directory names, tool or vendor
//                          names, automation wording (owner style rule); with --scan-findings also in findings/,
//                          with --scan-history also in commit messages and diffs
//   ERROR unknown-test-id  a test title whose T-ID is not an active row of 41 (--tests)
//   ERROR missing-clause   a 41 row with tests but no test naming one of its Cases clauses (--tests)
//   ERROR id-needed        an unresolved [ID-NEEDED ...] marker
//   WARN  legacy-id        an old ID name (G1-G7 CI gates, O1-O14, D0-D6 design steps) outside a rename note
//   WARN  count-mismatch   a stated count that differs from the rows in its table
//   WARN  version-not-in-02 a x.y.z version outside 02 that 02 does not contain
//   WARN  code-ref         a code citation whose file is absent or line exceeds the file at --tree
//   INFO  review-ref       an X##.# review entry that does not exist in the review file
// Node built-ins only.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : def
}
const docsDir = path.resolve(args.find((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--'))) || '.')
const findingsDir = path.resolve(opt('--findings', path.join(docsDir, 'findings')))
const repo = opt('--repo', null)
const tree = opt('--tree', 'a825839')
const asJson = args.includes('--json')

const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md')).sort()
const docs = {}
for (const f of files) docs[f] = fs.readFileSync(path.join(docsDir, f), 'utf8')
const docKey = (f) => (f.match(/^(\d\d)-/) || [null, f.replace(/\.md$/, '')])[1]
const keyToFile = {}
for (const f of files) keyToFile[docKey(f)] = f

const findings = []
const report = (level, kind, file, line, msg) => findings.push({ level, kind, file, line, msg })

// ---------- helpers ----------
const lines = (f) => docs[f].split('\n')
// strip fenced code blocks (keep line count)
const proseLines = (f) => {
  let inFence = false
  return lines(f).map((l) => {
    if (/^\s*```/.test(l)) {
      inFence = !inFence
      return ''
    }
    return inFence ? '' : l
  })
}
const firstCell = (l) => {
  if (!/^\s*\|/.test(l)) return null
  const cells = l.split('|')
  if (cells.length < 3) return null
  const c = cells[1].trim()
  if (/^:?-+:?$/.test(c)) return null
  return c
}
const headings = (f) =>
  lines(f)
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^#{1,6}\s/.test(l))
    .map(({ l, i }) => ({ text: l.replace(/^#+\s*/, '').trim(), line: i + 1 }))
const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

// ---------- ID families ----------
// owner: doc keys whose definitions count; mode: where a definition sits
const W_STEPS = ['W0', 'W0b', 'W0.5', 'W1', 'W2a', 'W2b', 'W2c', 'W2d', 'W2e', 'W3', 'W4a', 'W4b', 'W4c', 'W4d', 'W4e', 'W5', 'W5.5', 'W6a', 'W6c', 'W6d', 'W7a', 'W7b', 'W7c', 'W8']
const W_ALLOWED_REFS = new Set(['W2', 'W4', 'W6', 'W7', 'W9', 'W6b']) // groups, W9 alias (=6.7), W6b WITHDRAWN

const families = [
  { fam: 'R', re: /(?<![\w-])R-(\d{3})(?![\w])/g, owner: ['10'], mode: 'cell', fmt: (m) => `R-${m[1]}` },
  { fam: 'Q', re: /(?<![\w-])Q-(\d{3})(?![\d])/g, owner: ['30'], mode: 'cell', fmt: (m) => `Q-${m[1]}` },
  { fam: 'S', re: /(?<![\w-])S-(\d{1,2})(?![\w])/g, owner: ['30'], mode: 'cell', fmt: (m) => `S-${m[1]}` },
  { fam: 'T', re: /(?<![\w-])T-(\d{3})(?![\w])/g, owner: ['41'], mode: 'cell', fmt: (m) => `T-${m[1]}` },
  { fam: 'OD', re: /(?<![\w-])OD-(\d{2})(?![\w])/g, owner: ['90'], mode: 'heading', fmt: (m) => `OD-${m[1]}` },
  { fam: 'VF', re: /(?<![\w-])VF-(\d{2})(?![\w])/g, owner: ['STATUS'], mode: 'cell', fmt: (m) => `VF-${m[1]}` },
  { fam: 'OC', re: /(?<![\w-])OC-(\d{1,2})(?![\w])/g, owner: ['50'], mode: 'cell', fmt: (m) => `OC-${m[1]}` },
  { fam: 'DU', re: /(?<![\w-])DU-(\d{2})(?![\w])/g, owner: ['60'], mode: 'cell', fmt: (m) => `DU-${m[1]}` },
  { fam: 'DV', re: /(?<![\w-])DV(\d)(?![\w])/g, owner: ['60'], mode: 'cell', fmt: (m) => `DV${m[1]}` },
  { fam: 'C', re: /(?<![\w-])C([1-8])(?![\w])/g, owner: ['55'], mode: 'heading', fmt: (m) => `C${m[1]}` },
  { fam: 'RG', re: /(?<![\w-])RG-(\d)(?![\w])/g, owner: ['55'], mode: 'cell', fmt: (m) => `RG-${m[1]}` },
  { fam: 'VG', re: /(?<![\w-])VG-(\d)(?![\w])/g, owner: ['55'], mode: 'cell', fmt: (m) => `VG-${m[1]}` },
  { fam: 'CI', re: /(?<![\w-])CI-(\d)(?![\w])/g, owner: ['42'], mode: 'mention', fmt: (m) => `CI-${m[1]}` },
  { fam: 'GATE', re: /GATE-([SAF])(?:\.(\d+))?(?![\w])/g, owner: ['55'], mode: 'mention', fmt: (m) => (m[2] ? `GATE-${m[1]}.${m[2]}` : `GATE-${m[1]}`) },
  { fam: 'ER', re: /(?<![\w-])ER-(\d{2})(?![\w])/g, owner: ['README'], mode: 'cell', fmt: (m) => `ER-${m[1]}` },
  { fam: 'E', re: /(?<![\w-])E(\d{1,2})(?![\w])/g, owner: ['41'], mode: 'cell', fmt: (m) => `E${m[1]}` },
  { fam: 'V', re: /(?<![\w-])V(\d{1,2})(?![\w])/g, owner: ['41'], mode: 'cell', fmt: (m) => `V${m[1]}` },
  { fam: 'J', re: /(?<![\w-])J(\d{1,2})(?![\w])/g, owner: ['41'], mode: 'cell', fmt: (m) => `J${m[1]}` },
  { fam: 'M', re: /(?<![\w-])M([1-9])(?![\w])/g, owner: ['00'], mode: 'cell', fmt: (m) => `M${m[1]}` },
  { fam: 'D', re: /(?<![\w-])D(1a|4a|\d{1,2})(?![\w])/g, owner: ['00'], mode: 'cellOrHeading', fmt: (m) => `D${m[1]}` },
  { fam: 'W', re: /(?<![\w.-])(W\d(?:\.5|[a-z])?)(?![\w])/g, owner: ['50'], mode: 'cell', fmt: (m) => m[1] },
  { fam: 'FW', re: /(?<![\w-])FW(\d)(?![\w])/g, owner: ['README'], mode: 'mention', fmt: (m) => `FW${m[1]}` },
]

// CS needs range/list expansion
const CS_RE = /CS-([A-Z][A-Za-z0-9]*)-(\d+)((?:\s*(?:(?:\/|\.\.|–)\s*(?:CS-\1-)?-?|,\s*-|,\s*CS-\1-)\d+(?![\w]|\.\d))*)/g
function expandCS(text) {
  const out = []
  for (const m of text.matchAll(CS_RE)) {
    const g = m[1]
    const first = Number(m[2])
    out.push({ id: `CS-${g}-${first}`, index: m.index })
    const tail = m[3] || ''
    let prev = first
    for (const t of tail.matchAll(/\s*(\/|,|\.\.|–)\s*(?:CS-[A-Za-z0-9]+-)?-?(\d+)/g)) {
      const n = Number(t[2])
      if (t[1] === '..' || t[1] === '–') {
        for (let k = prev + 1; k <= n; k++) out.push({ id: `CS-${g}-${k}`, index: m.index })
      } else out.push({ id: `CS-${g}-${n}`, index: m.index })
      prev = n
    }
  }
  return out
}
// generic range expansion for R-a..R-b, T-a–T-b, Q-a..Q-b, OD-a..OD-b, VF-a..VF-b etc.
function expandRanges(text) {
  const out = []
  const re = /(?<![\w-])(R|Q|T|OD|VF|OC|DU|RG|VG|CI|ER|S)-(\d+)\s*(?:\.\.|–)\s*(?:\1-)?(\d+)(?![\w])/g
  for (const m of text.matchAll(re)) {
    const w = m[2].length
    const a = Number(m[2])
    const b = Number(m[3])
    if (b <= a || b - a > 120) continue
    for (let k = a + 1; k < b; k++) out.push(`${m[1]}-${String(k).padStart(w, '0')}`)
  }
  for (const m of text.matchAll(/(?<![\w-])(E|V|J|DV|C|M|FW)(\d+)\s*(?:\.\.|–)\s*\1?(\d+)(?![\w])/g)) {
    const a = Number(m[2])
    const b = Number(m[3])
    if (b <= a || b - a > 60) continue
    for (let k = a + 1; k < b; k++) out.push(`${m[1]}${k}`)
  }
  return out
}

const defs = new Map() // id -> [{file,line}]
const refs = new Map() // id -> [{file,line}]
const addTo = (map, id, file, line) => {
  if (!map.has(id)) map.set(id, [])
  map.get(id).push({ file, line })
}

const ownerOf = { CS: ['20', '60', '70', '80'] }
const isOwner = (fam, key) => (fam === 'CS' ? ownerOf.CS : families.find((x) => x.fam === fam).owner).includes(key)

for (const f of files) {
  const key = docKey(f)
  const pl = proseLines(f)
  let section = ''
  pl.forEach((l, i) => {
    if (/^#{1,6}\s/.test(l)) section = l
    const ln = i + 1
    const cell = firstCell(l)
    const isHeading = /^#{1,6}\s/.test(l)
    // ----- generic families
    for (const fa of families) {
      for (const m of l.matchAll(fa.re)) {
        const id = fa.fmt(m)
        addTo(refs, id, f, ln)
        if (!fa.owner.includes(key)) continue
        let isDef = false
        const lead = cell === null ? null : cell.replace(/\*\*/g, '').trim().split(/[\s,(]/)[0]
        const htext = isHeading ? l.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() : ''
        // a heading defines every ID in its leading run "OD-24 / OD-25 ..." or "D1 — ..."
        const hrun = isHeading ? (htext.match(/^((?:[A-Z][A-Za-z]*-?\d+[a-z]?(?:\.\d+)?)(?:\s*(?:\/|,)\s*)?)+/) || [''])[0] : ''
        const hlead = isHeading && new RegExp(`(^|[\\s/,])${id.replace(/[.]/g, '\\.')}(?=$|[\\s/,])`).test(hrun) ? id : null
        if (fa.mode === 'mention') isDef = true
        else if (fa.mode === 'heading') isDef = hlead === id
        else if (fa.mode === 'cell') isDef = lead === id
        else if (fa.mode === 'cellOrHeading') isDef = hlead === id || lead === id
        if (isDef) addTo(defs, id, f, ln)
      }
    }
    for (const id of expandRanges(l)) {
      addTo(refs, id, f, ln)
      const fa = families.find((x) => x.fam === famOf(id))
      if (fa && fa.mode === 'mention' && fa.owner.includes(key)) addTo(defs, id, f, ln)
    }
    // ----- CS
    for (const { id, index } of expandCS(l)) {
      addTo(refs, id, f, ln)
      if (!ownerOf.CS.includes(key)) continue
      const inWithdrawnTable = /Withdrawn and rescheduled/i.test(section)
      const before = l.slice(0, index)
      const atLineStart = /^\s*(?:[-*]\s+|\d+\.\s+)?(?:\*\*)?\s*$/.test(before) || /\*\*$/.test(before)
      const cells = /^\s*\|/.test(l) ? l.split('|') : []
      const c2end = cells.length > 3 ? cells.slice(0, 3).join('|').length : -1
      const c1 = cells.length > 2 ? cells.slice(0, 2).join('|').length : -1
      const inCell = cell !== null && (index < c1 || (/^\s*\d+\s*$/.test(cells[1] || '') && index < c2end))
      let isDef = (inCell && !inWithdrawnTable) || (atLineStart && !inWithdrawnTable)
      if (/^\s*Verify only:/.test(l)) isDef = true
      const ptr = l.slice(index).match(/^CS-[\w-]+\*\*\s*\(\[?(\d\d)/)
      if (ptr && ptr[1] !== key) isDef = false
      if (inWithdrawnTable && inCell && /WITHDRAWN/.test(l)) isDef = true
      if (isDef) addTo(defs, id, f, ln)
    }
  })
}

// ---------- undefined / duplicates ----------
function famOf(id) {
  if (id.startsWith('CS-')) return 'CS'
  if (id.startsWith('GATE-')) return 'GATE'
  const m = id.match(/^(R|Q|S|T|OD|VF|OC|DU|RG|VG|CI|ER)-/) || id.match(/^(DV|FW|E|V|J|C|M|D|W)/)
  return m ? m[1] : null
}
const gateCriteria = new Set()
for (const x of ['S', 'A', 'F']) for (let n = 1; n <= 9; n++) gateCriteria.add(`GATE-${x}.${n}`)
for (const x of ['A', 'F']) for (let n = 10; n <= 13; n++) gateCriteria.add(`GATE-${x}.${n}`)
const allowUndefined = new Set([...W_ALLOWED_REFS, ...gateCriteria])
// IDs that the plan keeps deliberately unallocated (documented in their owner doc)
const documentedUnused = { 'T-111': '41 §0: unused', 'T-112': '41 §0: unused', 'Q-086': '30 §1 rule 5: unallocated' }
const legacyNotes = /(was|draft|\bold\b|renamed|rename|=\s*(the\s*)?draft|replaces|WITHDRAWN|former|formerly|its D0|unused|unallocated|not allocated)/i

for (const [id, list] of refs) {
  if (allowUndefined.has(id)) continue
  if (documentedUnused[id]) {
    report('INFO', 'documented-unused', list[0].file, list[0].line, `${id} referenced ${list.length}x; ${documentedUnused[id]}`)
    continue
  }
  const fam = famOf(id)
  if (!fam) continue
  if (defs.has(id)) continue
  // legacy names
  if (fam === 'D' && /^D[06]$/.test(id) === false && id === 'D0') {
  }
  const legacy = list.filter(({ file, line }) => legacyNotes.test(lines(file)[line - 1]))
  if (fam === 'D' && id === 'D0') {
    for (const r of list) if (!legacyNotes.test(lines(r.file)[r.line - 1])) report('WARN', 'legacy-id', r.file, r.line, `${id} (old design-step name; now DV0)`)
    continue
  }
  if (legacy.length === list.length) {
    for (const r of list) report('WARN', 'legacy-id', r.file, r.line, `${id} appears only in a rename/withdrawn note`)
    continue
  }
  for (const r of list) report('ERROR', 'undefined-id', r.file, r.line, `${id} is referenced but defined in no owner doc`)
}
for (const [id, list] of defs) {
  const fam = famOf(id)
  if (fam === 'CI' || fam === 'GATE' || fam === 'FW') continue
  const uniq = list.filter((d, i) => list.findIndex((e) => e.file === d.file && e.line === d.line) === i)
  if (fam === 'CS') {
    const byFile = new Set(uniq.map((d) => d.file))
    if (byFile.size > 1) report('ERROR', 'duplicate-def', uniq[0].file, uniq[0].line, `${id} defined in ${[...byFile].join(', ')}`)
    continue
  }
  if (uniq.length > 1) report('ERROR', 'duplicate-def', uniq[0].file, uniq[0].line, `${id} defined ${uniq.length}x: ${uniq.map((d) => `${d.file}:${d.line}`).join(', ')}`)
}

// ---------- legacy ids: G1-G7, O1-O14 ----------
for (const f of files) {
  proseLines(f).forEach((l, i) => {
    for (const m of l.matchAll(/(?<![\w-])G([1-7])(?![\w–-])/g)) {
      if (!legacyNotes.test(l)) report('WARN', 'legacy-id', f, i + 1, `G${m[1]} (old CI gate name; now CI-${m[1]})`)
    }
    for (const m of l.matchAll(/(?<![\w-])O(\d{1,2})(?![\w])/g)) {
      if (Number(m[1]) <= 14 && !legacyNotes.test(l) && !/"O1"/.test(l)) report('WARN', 'legacy-id', f, i + 1, `O${m[1]} (old ordering-constraint name; now OC-${m[1]})`)
    }
  })
}

// ---------- links and section references ----------
const headingIndex = {}
for (const f of files) headingIndex[f] = headings(f)
const headingNumber = (t) => {
  const m = t.match(/^([0-9A-Z][0-9A-Za-z.]*?)[.)]?(?=\s|$)/)
  return m ? m[1].replace(/\.$/, '') : null
}
function sectionExists(f, token) {
  const tok = token.replace(/\.$/, '')
  const hs = headingIndex[f] || []
  if (/^[0-9]+(\.[0-9]+)*$/.test(tok) || /^[A-Z]$/.test(tok)) {
    return hs.some((h) => headingNumber(h.text) === tok)
  }
  return hs.some((h) => h.text.toLowerCase().includes(tok.toLowerCase()))
}
for (const f of files) {
  proseLines(f).forEach((l, i) => {
    const ln = i + 1
    for (const m of l.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
      const href = m[2]
      if (/^(https?:|mailto:)/.test(href)) continue
      const [p, anchor] = href.split('#')
      let target = p ? path.resolve(docsDir, p) : path.join(docsDir, f)
      if (p && p.startsWith('findings/')) target = path.join(findingsDir, p.slice('findings/'.length))
      if (p && !fs.existsSync(target)) {
        report('ERROR', 'broken-link', f, ln, `${href} -> missing ${p}`)
        continue
      }
      if (anchor) {
        const tf = path.basename(target)
        if (docs[tf]) {
          const ok = headings(tf).some((h) => slug(h.text) === anchor)
          if (!ok) report('ERROR', 'broken-anchor', f, ln, `${href}: no heading with slug #${anchor}`)
        }
      }
    }
    // section references: "<doc> §x", "[NN](...) §x", bare "§x" (= this doc)
    const re = /(?:\[(\d\d|STATUS|README)\]\([^)]*\)|(?<![\w:/.#-])(\d\d|STATUS|README))?\s?§\s?([0-9]+(?:\.[0-9]+)*|[A-Z](?![a-z])|[A-Za-z][\w-]*)/g
    let lastKey = null
    let lastEnd = -1
    const erRow = /^\| ER-\d\d \|/.test(l)
    const erCellEnd = erRow ? l.split('|').slice(0, 3).join('|').length : -1
    for (const m of l.matchAll(re)) {
      if (erRow && m.index < erCellEnd) continue
      const before = l.slice(0, m.index)
      if (!m[1] && !m[2] && lastKey && /^\s*(,|and|or|\/|–|-)\s*$/.test(l.slice(lastEnd, m.index))) {
        const tf0 = keyToFile[lastKey]
        if (tf0 && !sectionExists(tf0, m[3])) report('ERROR', 'broken-anchor', f, ln, `${lastKey} §${m[3]}: no such heading in ${tf0}`)
        lastEnd = m.index + m[0].length
        continue
      }
      if (/(review:\S*|findings\/\S*|review\s*|\bfindings\s*|\b0[1-8]|[a-z-]+\.md|X\d\d\.\d+)\s*$/i.test(before) && !m[1] && !m[2]) continue
      let key = m[1] || m[2]
      if (!key) {
        // bare §x: skip when an external source precedes on the same clause
        if (/(review:|findings\/|DT|BL|RP|TS|review:[a-z-]+)\s*$/.test(before)) continue
        key = docKey(f)
      }
      if (/^0[1-8]$/.test(key) && /findings|"0\d"|0N/.test(before.slice(-12))) continue
      const tf = keyToFile[key]
      if (!tf) continue
      lastKey = key
      lastEnd = m.index + m[0].length
      const tok = m[3]
      if (['n', 'x', 'triage', 'commands', 'git', 'Node', 'matrix', 'rules', 'runbook', 'harness', 'prerequisites'].includes(tok) && !sectionExists(tf, tok)) {
        report('ERROR', 'broken-anchor', f, ln, `${key} §${tok}: no such heading in ${tf}`)
        continue
      }
      if (!sectionExists(tf, tok)) report('ERROR', 'broken-anchor', f, ln, `${key} §${tok}: no such heading in ${tf}`)
    }
  })
}

// ---------- forbidden text ----------
// patterns are assembled from parts so this file does not itself contain the words it rejects
const J = (...p) => p.join('')
const forbidden = [
  [/~\/mnt/, 'home-relative mount path'],
  [/(^|[\s(`'"])~\//, 'home-directory path'],
  [/\$HOME\/mnt/, 'home-relative mount path'],
  [new RegExp(J('\\/', 'Us', 'ers\\/')), 'absolute local path'],
  [new RegExp(J('\\/', 'pri', 'vate\\/')), 'absolute local path'],
  [new RegExp(J('scr', 'atch', 'pad'), 'i'), 'working-directory name'],
  [new RegExp(J('\\bcl', 'aude\\b|CLA', 'UDE\\.md|anthr', 'opic'), 'i'), 'tool/vendor name'],
  [new RegExp(J('\\b(L', 'LMs?|A', 'I model|A', 'I ag', 'ent)\\b')), 'automation wording'],
  [new RegExp(J('\\bA', 'I\\b')), 'automation wording'],
  [new RegExp(J('(?<!user-|http)\\bag', 'ents?\\b(?!-)'), 'i'), 'automation wording'],
  [/\[ID-NEEDED/, 'unresolved [ID-NEEDED]'],
]
for (const f of files) {
  lines(f).forEach((l, i) => {
    for (const [re, what] of forbidden) {
      if (re.test(l)) report('ERROR', what.startsWith('unresolved') ? 'id-needed' : 'forbidden-text', f, i + 1, `${what}: ${l.trim().slice(0, 120)}`)
    }
    if (/\[VERIFY\]/.test(l)) report('WARN', 'bare-verify', f, i + 1, 'bare [VERIFY] without "what settles it"')
  })
}

// ---------- forbidden text in findings (--scan-findings) ----------
if (args.includes('--scan-findings') && fs.existsSync(findingsDir)) {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  for (const p of walk(findingsDir)) {
    if (!/\.(md|json|txt|ya?ml|csv|log|html?)$/i.test(p)) continue
    const rel = path.join('findings', path.relative(findingsDir, p))
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      for (const [re, what] of forbidden) {
        if (what.startsWith('unresolved')) continue
        if (re.test(l)) report('ERROR', 'forbidden-text', rel, i + 1, `${what}: ${l.trim().slice(0, 120)}`)
      }
    })
  }
}

// ---------- forbidden text in git history (--scan-history <range>) ----------
const histRange = opt('--scan-history', null)
if (histRange) {
  let out = null
  try {
    out = execFileSync('git', ['-C', repo || '.', 'log', '-p', '--format=commit %h%n%B', histRange], { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    report('ERROR', 'usage', 'history', 0, `git log ${histRange} failed (needs --repo)`)
  }
  let commit = ''
  if (out !== null)
    out.split('\n').forEach((l, i) => {
      const c = l.match(/^commit ([0-9a-f]{7,})$/)
      if (c) commit = c[1]
      for (const [re, what] of forbidden) {
        if (what.startsWith('unresolved')) continue
        if (re.test(l)) report('ERROR', 'forbidden-text', `history@${commit}`, i + 1, `${what}: ${l.trim().slice(0, 120)}`)
      }
    })
}

// ---------- Cases clauses (41 §0) ----------
const cellsOf = (l) => l.split(/(?<!\\)\|/).map((s) => s.trim())
const splitClauses = (cell, items = false) => {
  const out = []
  let cur = ''
  let tick = false
  let depth = 0
  let bold = false // quirk cells: a `;` inside **...** does not split
  for (let i = 0; i < cell.length; i++) {
    const ch = cell[i]
    if (items && !tick && ch === '*' && cell[i + 1] === '*') bold = !bold
    // quirk cells (items = true) also split before a top-level (b)...(e) item
    if (items && !tick && depth === 0 && ch === '(' && /^\([b-e]\) /.test(cell.slice(i)) && /\s$/.test(cur) && cur.trim()) {
      out.push(cur.trim())
      cur = ''
    }
    if (ch === '`') tick = !tick
    else if (!tick && ch === '(') depth++
    else if (!tick && ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ';' && !tick && depth === 0 && !(items && bold)) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}
const clauses = {}
if (keyToFile['41'])
  for (const l of lines(keyToFile['41'])) {
    if (!/^\| T-\d{3} \|/.test(l) || /WITHDRAWN/.test(l)) continue
    const c = cellsOf(l)
    clauses[c[1]] = { p: c[2], clauses: splitClauses(c[4] || '') }
  }
const quirkClauses = {}
if (keyToFile['30'])
  for (const l of lines(keyToFile['30'])) {
    const m = l.match(/^\| (Q-\d{3})\b/) // WATCH rows read `| Q-014 **WATCH** |`
    if (!m) continue
    const c = cellsOf(l)
    // 30 §E rows: | ID | Quirk and where | Today (pinned) | ... | Pinned by |; other sections: | ID | Quirk | Where | Pinned by |
    const behaviour = c.length > 6 ? c[3] : c[2]
    quirkClauses[m[1]] = { pinnedBy: c[c.length - 2], clauses: splitClauses(behaviour || '', true) }
  }
if (opt('--cases-out', null)) fs.writeFileSync(opt('--cases-out'), JSON.stringify({ ...clauses, ...quirkClauses }, null, 1) + '\n')

// ---------- test titles (--tests) ----------
if (opt('--tests', null) && keyToFile['41']) {
  const active = new Set(Object.keys(clauses))
  const named = new Map() // T-ID -> Set of clause numbers (0 = no clause given)
  const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : [])
  for (const dir of opt('--tests').split(',')) {
    for (const p of walk(path.resolve(dir))) {
      if (!/\.(m|c)?[jt]sx?$/.test(p)) continue
      fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/\b(?:test|it|describe)(?:\.\w+)?\(\s*['"`](T-\d{3})\b(?:\s+c(\d+)\b)?/g)) {
          if (!active.has(m[1])) {
            report('ERROR', 'unknown-test-id', path.relative(process.cwd(), p), i + 1, `${m[1]} is not an active T row of 41`)
            continue
          }
          const k = m[2] ? Number(m[2]) : 0
          if (k > clauses[m[1]].clauses.length) report('ERROR', 'missing-clause', path.relative(process.cwd(), p), i + 1, `${m[1]} c${k}: row has ${clauses[m[1]].clauses.length} clauses`)
          if (!named.has(m[1])) named.set(m[1], new Set())
          named.get(m[1]).add(k)
        }
      })
    }
  }
  for (const [id, ks] of named) {
    const n = clauses[id].clauses.length
    if (n < 2) continue
    const missing = []
    for (let k = 1; k <= n; k++) if (!ks.has(k)) missing.push(`c${k}`)
    if (missing.length) report('ERROR', 'missing-clause', keyToFile['41'], 0, `${id} has tests but none for ${missing.join(', ')} (41 §0)`)
  }
}

// ---------- harness constants (--constants) ----------
if (args.includes('--constants')) {
  const h = (s) => crypto.createHash('sha256').update(s).digest('hex')
  const f40 = keyToFile['40']
  const f42 = keyToFile['42']
  const t805 = f40 ? lines(f40).find((l) => l.startsWith('**T-805 property list**')) || '' : ''
  const norm = f40 ? tableRowsUnder(f40, /^## 1\. Parity contract/).map((r) => cellsOf(r)[3] || '').join('\n') : ''
  const rule = f42 ? (lines(f42).find((l) => l.startsWith('Default deny:')) || '').match(/^Default deny:.*?one row per \(test, key\)\./) : null
  console.log(JSON.stringify({ t805: h(t805), normalisations: h(norm), adKeyRule: h(rule ? rule[0] : '') }, null, 1))
  process.exit(t805 && norm && rule ? 0 : 1)
}

// ---------- counts ----------
function tableRowsUnder(f, headingRe, stopRe = /^##\s/) {
  const ls = lines(f)
  const start = ls.findIndex((l) => headingRe.test(l))
  if (start < 0) return []
  const rows = []
  for (let i = start + 1; i < ls.length; i++) {
    if (stopRe.test(ls[i]) && i > start) break
    if (/^\|/.test(ls[i]) && !/^\|\s*:?-/.test(ls[i])) rows.push(ls[i])
  }
  return rows.slice(1) // drop header
}
if (keyToFile['10']) {
  const f = keyToFile['10']
  const sev = { Critical: /^## 2\. Critical/, High: /^## 3\. High/, Medium: /^## 4\. Medium/, Low: /^## 5\. Low/ }
  const got = {}
  for (const [k, re] of Object.entries(sev)) {
    const rows = tableRowsUnder(f, re)
    got[k] = { rows: rows.length, silent: rows.filter((r) => /SILENT/.test(r.split('|')[3] || '')).length }
  }
  const counts = tableRowsUnder(f, /^## 6\. Counts/)
  for (const r of counts) {
    const c = r.split('|').map((s) => s.trim().replace(/\*/g, ''))
    if (got[c[1]]) {
      if (Number(c[2]) !== got[c[1]].rows) report('WARN', 'count-mismatch', f, 0, `${c[1]}: stated ${c[2]} rows, table has ${got[c[1]].rows}`)
      if (Number(c[3]) !== got[c[1]].silent) report('WARN', 'count-mismatch', f, 0, `${c[1]}: stated ${c[3]} SILENT, table has ${got[c[1]].silent}`)
    }
  }
  const total = Object.values(got).reduce((a, b) => a + b.rows, 0)
  const rIds = [...docs[f].matchAll(/^\| (R-\d{3}) \|/gm)].length
  if (rIds !== total) report('WARN', 'count-mismatch', f, 0, `row IDs ${rIds} vs section rows ${total}`)
  globalThis.__riskTotal = total
}
if (keyToFile['41']) {
  const f = keyToFile['41']
  const rows = lines(f).filter((l) => /^\| T-\d{3} \|/.test(l))
  const active = rows.filter((r) => !/WITHDRAWN/.test(r))
  const pr = (p) => active.filter((r) => new RegExp(`^\\| T-\\d{3} \\| ${p}`).test(r)).length
  const p0 = pr('P0'),
    p1 = pr('P1'),
    p2 = pr('P2')
  const m = docs[f].match(/P0 (\d+), P1 (\d+), P2 (\d+) = (\d+)/)
  if (m && (Number(m[1]) !== p0 || Number(m[2]) !== p1 || Number(m[3]) !== p2 || Number(m[4]) !== active.length))
    report('WARN', 'count-mismatch', f, 0, `41 §4 states P0 ${m[1]}, P1 ${m[2]}, P2 ${m[3]} = ${m[4]}; rows give P0 ${p0}, P1 ${p1}, P2 ${p2} = ${active.length}`)
  globalThis.__tests = { p0, p1, p2, total: active.length }
}
if (keyToFile['30']) {
  const f = keyToFile['30']
  const qRows = lines(f).filter((l) => /^\| Q-\d{3}/.test(l))
  const watch = qRows.filter((r) => /^\| Q-\d{3} \*\*WATCH\*\*/.test(r)).length
  const m = docs[f].match(/(\d+) quirks/)
  if (m && Number(m[1]) !== qRows.length) report('WARN', 'count-mismatch', f, 0, `30 states ${m[1]} quirks; table has ${qRows.length} rows`)
  const w = docs[f].match(/WATCH (\d+)/)
  if (w && Number(w[1]) !== watch) report('WARN', 'count-mismatch', f, 0, `30 states WATCH ${w[1]}; table has ${watch}`)
}

// ---------- versions outside 02 ----------
if (keyToFile['02']) {
  const v02 = docs[keyToFile['02']]
  for (const f of files) {
    if (docKey(f) === '02') continue
    proseLines(f).forEach((l, i) => {
      for (const m of l.matchAll(/(?<![\w.:/@-])(\d{1,2}\.\d{1,3}\.\d{1,6})(?![\w.])/g)) {
        const v = m[1]
        if (/^(1|2)\.\d\.\d$/.test(v) && /§/.test(l.slice(Math.max(0, m.index - 3), m.index))) continue
        if (!v02.includes(v)) report('WARN', 'version-not-in-02', f, i + 1, `${v}: ${l.trim().slice(0, 100)}`)
      }
    })
  }
}

// ---------- review references ----------
const reviewFile = path.join(findingsDir, 'review-2026-10-19', '00-verified-findings.md')
if (fs.existsSync(reviewFile)) {
  const rv = fs.readFileSync(reviewFile, 'utf8')
  const xids = new Set([...rv.matchAll(/^### (X[0-9A-Z]{2,3}\.\d+)/gm)].map((m) => m[1]))
  for (const f of files) {
    proseLines(f).forEach((l, i) => {
      for (const m of l.matchAll(/(?<![\w-])(X(?:\d{2}|RD|FE)\.\d+)(?![\w])/g)) {
        if (!xids.has(m[1])) report('INFO', 'review-ref', f, i + 1, `${m[1]} not found in review:00`)
      }
      for (const m of l.matchAll(/review:([a-z-]+)(\.verdicts)?/g)) {
        if (m[1] === '00') continue
        const p = path.join(findingsDir, 'review-2026-10-19', `${m[1]}${m[2] || ''}.md`)
        if (!fs.existsSync(p)) report('ERROR', 'broken-link', f, i + 1, `review:${m[1]}${m[2] || ''} has no file ${path.basename(p)}`)
      }
    })
  }
}

// ---------- code citations ----------
if (repo) {
  const top = new Set(['api', 'pages', 'store', 'templates', 'modules', 'utils', 'hooks', 'lib', 'data', 'main', 'kube', '.github', 'public', 'components', 'styles'])
  const rootFiles = new Set(['Dockerfile', 'package.json', 'package-lock.json', 'next.config.js', 'babel.config.js', 'postcss.config.js', 'csp.config.js', 'env.config.js', 'design.config.js', '.gitignore', '.browserslistrc', '.eslintrc.yml', 'stylelint.config.js', 'prettier.config.js', 'README.md', '.npmrc.dist'])
  const cache = new Map()
  const lineCount = (p) => {
    if (cache.has(p)) return cache.get(p)
    let n = null
    try {
      n = execFileSync('git', ['-C', repo, 'show', `${tree}:${p}`], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').length
    } catch {
      n = null
    }
    cache.set(p, n)
    return n
  }
  for (const f of files) {
    proseLines(f).forEach((l, i) => {
      for (const m of l.matchAll(/`([^`\s]+?)(?::(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*))?`/g)) {
        let p = m[1]
        const linesSpec = m[2]
        if (p.includes('*') || p.includes('<') || p.startsWith('../') || p.startsWith('node_modules') || p.startsWith('vendor/')) continue
        const expand = []
        const brace = p.match(/\{([^}]+)\}/)
        if (brace) for (const alt of brace[1].split(',')) expand.push(p.replace(brace[0], alt))
        else expand.push(p)
        for (let q of expand) {
          if (/^aks_(stage_)?deploy\.yml$/.test(q)) q = `.github/workflows/${q}`
          const first = q.split('/')[0]
          if (!(top.has(first) && q.includes('/')) && !rootFiles.has(q)) continue
          if (/\.(new|tsx?|mjs)$/.test(q) && !lineCount(q)) continue
          const n = lineCount(q)
          const designCtx = /design|\.\.\/design|`src\//i.test(l.slice(Math.max(0, m.index - 40), m.index))
          if (n === null) {
            report('INFO', 'code-ref', f, i + 1, `${q} not in tree ${tree} (new file or design path?)`)
            continue
          }
          if (designCtx) continue
          if (linesSpec) {
            const max = Math.max(...linesSpec.split(/[,-]/).map(Number))
            if (max > n) report('WARN', 'code-ref', f, i + 1, `${q}:${linesSpec} beyond ${n - 1} lines`)
          }
        }
      }
    })
  }
}

// ---------- output ----------
const order = { ERROR: 0, WARN: 1, INFO: 2 }
findings.sort((a, b) => order[a.level] - order[b.level] || a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file) || a.line - b.line)
if (asJson) console.log(JSON.stringify(findings, null, 1))
else {
  for (const x of findings) console.log(`${x.level} ${x.kind} ${x.file}:${x.line} ${x.msg}`)
  const c = (lvl) => findings.filter((x) => x.level === lvl).length
  console.log(`\n${files.length} docs, ${defs.size} defined IDs, ${refs.size} referenced IDs; ERROR ${c('ERROR')}, WARN ${c('WARN')}, INFO ${c('INFO')}`)
  if (globalThis.__tests) console.log(`tests: P0 ${globalThis.__tests.p0}, P1 ${globalThis.__tests.p1}, P2 ${globalThis.__tests.p2} = ${globalThis.__tests.total}; risks: ${globalThis.__riskTotal}`)
}
process.exit(findings.some((x) => x.level === 'ERROR') ? 1 : 0)

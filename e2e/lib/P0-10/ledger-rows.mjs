// AD rows of a recorded baseline (42 §8), as plain functions: no Playwright, no file access. The e2e baseline
// hooks (e2e/lib/P0-10/baseline.mjs) call them with the running test's info and the committed ledger; their
// known answers and negative controls run under Jest (test/unit/harness/e2e-ledger-rows.test.js).
// A row of the running test (the T-### id its title starts with) that is in force and whose key names the
// baseline file (`<name>.json` as the spec names it; a composite key names several, separated by `, `) accepts
// exactly one difference: its literal `from` in the baseline as compared becomes its literal `to`, at every
// occurrence. The file stays as recorded (baseline files are never edited), any other difference still fails
// (default deny), and a withdrawn row stops applying. The rows applied are annotated with the number of
// replacements.
export const testIdOf = (info) => (info.title.match(/^T-\d{3}\b/) || [null])[0]

export function ledgerRowsOf(file, info, rows) {
  const id = testIdOf(info)
  return rows.filter(
    (r) =>
      r &&
      r.test === id &&
      !r.withdrawn &&
      String(r.key).split(', ').includes(file)
  )
}

export function applyLedgerRows(text, rows, info) {
  let out = text
  for (const r of rows) {
    const parts = out.split(String(r.from))
    out = parts.join(String(r.to))
    info.annotations.push({
      type: 'ledger',
      description: `${r.id} x${parts.length - 1}`,
    })
  }
  return out
}

// a JSON baseline (the parsed value) with the rows applied to its JSON text; their `from` and `to` hold no quote
// or backslash, so they replace text inside the JSON strings only
export function applyLedgerRowsToJson(baseline, rows, info) {
  for (const r of rows)
    if (/["\\]/.test(`${r.from}${r.to}`))
      throw new Error(
        `${r.id}: from/to of a JSON baseline row hold a quote or backslash`
      )
  return JSON.parse(applyLedgerRows(JSON.stringify(baseline), rows, info))
}

// R-053-a .expect script: a malformed BibTeX answer for the DOI makes the Cite modal throw an Error object
// (TypeError) in render; baseline: the parser throws a string and the console shows only that text.
import { run, control, hydrated } from './R-018-expect-lib.mjs'

const DOI_URL = 'https://doi.org/10.1111/rego.12518'

export default async ({ env, page: seed }) => {
  const rule = await control(env, 'POST', '/rules', {
    urlPrefix: DOI_URL,
    fail: {
      status: 200,
      body: '@article{key, title={x',
      contentType: 'text/x-bibliography',
    },
  })
  try {
    return await run('R-053-a', seed, env, {}, async ({ page, log }) => {
      await page.goto('/works/1001/', { waitUntil: 'domcontentloaded' })
      await hydrated(page)
      await page.locator('button:has-text("Cite")').first().click()
      await page.waitForFunction(
        () => !document.getElementById('__next') || document.getElementById('__next').innerText.length === 0
      )
      await page.waitForTimeout(1000)
      const lines = log.console.filter(
        (m) => m.type === 'error' && /Unterminated value/.test(m.text)
      )
      return lines.length > 0 && lines.every((m) => /^TypeError: Unterminated value/.test(m.text))
    })
  } finally {
    await control(env, 'DELETE', `/rules?id=${rule.id}`)
  }
}

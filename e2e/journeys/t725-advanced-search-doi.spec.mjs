// T-725 (41 H, R-075, R-087): J18, advanced search -> "search by doi" -> `doi:" "` in the focused search
// box -> the panel closes. Until the 2.2 recordings it runs on the harness hand fixture
// test/fixtures/hand/harness-t725 (a search without results; the header search bar still mounts).
import { test, expect } from '../fixtures/guard.mjs'

test('T-725 @P0 J18 advanced search: search by doi prefills doi:" ", focuses the box and closes the panel', async ({
  page,
}) => {
  await page.goto('/search/?q=harnessdoi')
  const box = page.getByRole('combobox', {
    name: /from papers around the world/,
  })
  await expect(box).toHaveValue('harnessdoi')
  const panelText = page.getByText('To refine your searches you can use:')
  await expect(panelText).toBeHidden()
  await page.getByText('How to search?').click()
  await expect(panelText).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'API documentation' })
  ).toHaveAttribute('href', 'https://api.core.ac.uk/docs/v3')
  await expect(
    page.getByRole('button', { name: /^search by (doi|title|oai|issn)$/ })
  ).toHaveCount(4)
  await page.getByRole('button', { name: 'search by doi' }).click()
  await expect(box).toHaveValue('doi:" "')
  await expect(box).toBeFocused()
  await expect(panelText).toBeHidden()
  // prefilling never navigates
  expect(new URL(page.url()).search).toBe('?q=harnessdoi')
})

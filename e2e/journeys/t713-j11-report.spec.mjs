// T-713 (41 H, J11, Q-060, Q-078, Q-082, Q-094, R-037): the report chain of an output page, as it behaves
// today (findings/07 §2.11, §3 J11 with the review:ui-flows §4.1 J11 corrections):
//   - the three modals are design Modals with `hideManually`: no Close X, Esc and a backdrop click do nothing;
//     body overflow is `hidden` while one is open and `unset` afterwards;
//   - "Which issue are you reporting?": Continue disabled until an option card is chosen; Close resets the chain;
//   - "Fill up your request": Q-078 "Repository manager" is highlighted while `report.role` is null, Submit is
//     disabled and Name / Email / Comment are hidden until a role box is clicked; the Comment helper text
//     follows the option;
//   - Submit closes the form and sends E10 once with `{outputId, name, email, message, updateOption, role}`;
//     "Thank you!" (text by option and role); "got it" closes it and resets the store;
//   - Q-082: for "The document should not be published" "got it" never soft-refreshes (asPath `/outputs/2001/`
//     has a trailing slash, the code compares with `/outputs/2001`): no _next/data, no history entry;
//   - Q-060: an E10 failure (500) closes the form and shows nothing (no success modal, no message);
//   - Q-094 (the SPA-hop VERIFY of 30): the client store keeps `report.error`, so a client navigation from that
//     page to /outputs/update/ shows the stored message under the takedown form, which a hard load of
//     /outputs/update/ does not. Observed on the unchanged app: the message is shown (P1-04 issue).
// Fixtures: outputs-2001, hand e10-report (takedown as author: report-ok 201, report-fail 500), req-P1-04
// (issueWithContent as author: report-ok 201), e19-client-nav and members (Q-011: the client navigation to
// /outputs/update/ runs App.getInitialProps in the browser).
import { test } from '../fixtures/guard.mjs'
import { historyLog } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  settle,
  netLog,
  rel,
  navigations,
  buildIdOf,
  routerEvents,
  declareGuard,
  expectConsole,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  API,
} from '../lib/P1-04/page.mjs'

test.use({
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
  cookieState: 'essential',
})
test.describe.configure({ timeout: TEST_TIMEOUT })

const E10_URL = `${API}/internal/outputs/update`
const isE10 = (e) => e.method === 'POST' && e.url === E10_URL
const e10Body = (updateOption, role, message) =>
  JSON.stringify({
    outputId: 2001,
    name: 'Test Reporter',
    email: 'reporter@localhost',
    message,
    updateOption,
    role,
  })
const OUTDATED = 'The document is outdated'
const TAKEDOWN = 'The document should not be published'
const PROVIDER = 'Open Research Online (The Open University)'
const ERROR_MESSAGE =
  'We couldn’t perform the action. For any issue contact theteam@core.science'
const FAILED_500 =
  /^Failed to load resource: the server responded with a status of 500 \(Internal Server Error\)$/

const typeModal = (page) =>
  page.getByRole('dialog', { name: 'Problem-type-modal' })
const formModal = (page) =>
  page.getByRole('dialog', { name: 'Problem-form-modal' })
const successModal = (page) =>
  page.getByRole('dialog', { name: 'Success-type-modal' })

// the option cards of the type modal and the role boxes of the form modal, with their highlight
const optionCards = (modal) =>
  modal.locator('[class*="card-modal-report-type"]').evaluateAll((els) =>
    els.map((e) => ({
      label: e.textContent.trim(),
      active: /card-modal-active/.test(e.className),
    }))
  )
const roleBoxes = (modal) =>
  modal.locator('fieldset [class*="fieldset-box-item"]').evaluateAll((els) =>
    els.map((e) => ({
      label: e.textContent.trim(),
      active: /fieldset-box-item-active/.test(e.className),
    }))
  )
const options = (chosen) =>
  [TAKEDOWN, OUTDATED].map((label) => ({ label, active: label === chosen }))
const roles = (chosen) =>
  ['Repository manager', 'Author', 'Other'].map((label) => ({
    label,
    active: label === chosen,
  }))

const pageState = (page) =>
  page.evaluate(() => ({
    overflow: document.body.style.overflow,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) =>
      d.getAttribute('aria-label')
    ),
  }))

// Esc and a click on the backdrop (beside the dialog, below the header) leave a hideManually modal open
async function expectHideManually(page, modal) {
  await expect(modal.locator('[aria-label="Close"]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(modal).toBeVisible()
  const box = await modal.boundingBox()
  await page.mouse.click(
    Math.max(5, Math.floor(box.x / 2)),
    Math.floor(box.y + box.height / 2)
  )
  await expect(modal).toBeVisible()
}

// option -> Continue -> role -> fields -> Submit
async function submitReport(page, option, role, message) {
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  const type = typeModal(page)
  await expect(type).toBeVisible()
  await type.getByText(option, { exact: true }).click()
  await type.getByRole('button', { name: 'Continue' }).click()
  const form = formModal(page)
  await expect(form).toBeVisible()
  await form.getByText(role, { exact: true }).click()
  await form.getByLabel('Name').fill('Test Reporter')
  await form.getByLabel('Email').fill('reporter@localhost')
  await form.getByLabel('Comment').fill(message)
  await form.getByRole('button', { name: 'Submit' }).click()
}

test.describe('T-713 @P1 J11 report chain', () => {
  test('T-713 @P1 J11 outputs 2001 "The document is outdated" as Author: hideManually modals, Continue gated, Q-078 role highlight, E10 body, Thank you!, got it resets', async ({
    page,
    p2Env,
  }) => {
    const log = netLog(page, p2Env)
    await open(page, '/outputs/2001/')
    const report = page.getByRole('button', { name: 'Report', exact: true })

    // ---- modal 1: Continue disabled, hideManually; Close resets the chosen option ----
    await report.click()
    const type = typeModal(page)
    await expect(type).toBeVisible()
    await expect(type.getByRole('heading', { level: 3 })).toHaveText(
      'Which issue are you reporting?'
    )
    expect(await optionCards(type)).toEqual(options(null))
    await expect(type.getByRole('button')).toHaveText(['Close', 'Continue'])
    await expect(type.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(await pageState(page)).toEqual({
      overflow: 'hidden',
      dialogs: ['Problem-type-modal'],
    })
    await expectHideManually(page, type)
    await type.getByText(OUTDATED, { exact: true }).click()
    expect(await optionCards(type)).toEqual(options(OUTDATED))
    await expect(type.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await type.getByRole('button', { name: 'Close' }).click()
    await expect(type).toHaveCount(0)
    expect(await pageState(page)).toEqual({ overflow: 'unset', dialogs: [] })
    await report.click()
    await expect(type).toBeVisible()
    expect(await optionCards(type)).toEqual(options(null))
    await expect(type.getByRole('button', { name: 'Continue' })).toBeDisabled()

    // ---- modal 2: Q-078 "Repository manager" highlighted, role null: Submit disabled, fields hidden ----
    await type.getByText(OUTDATED, { exact: true }).click()
    await type.getByRole('button', { name: 'Continue' }).click()
    const form = formModal(page)
    await expect(form).toBeVisible()
    await expect(type).toHaveCount(0)
    await expect(form.getByRole('heading', { level: 3 })).toHaveText(
      'Fill up your request'
    )
    expect(await roleBoxes(form)).toEqual(roles('Repository manager'))
    await expect(form.locator('input, textarea')).toHaveCount(0)
    await expect(form.getByRole('button', { name: 'Submit' })).toBeDisabled()
    await expectHideManually(page, form)
    await form.getByText('Author', { exact: true }).click()
    expect(await roleBoxes(form)).toEqual(roles('Author'))
    await expect(form.getByRole('button', { name: 'Submit' })).toBeEnabled()
    // the fields: Name and Email required (Email typed email), Comment with the helper of the option
    expect(
      await form
        .locator('input, textarea')
        .evaluateAll((els) => els.map((e) => [e.name, e.type, e.required]))
    ).toEqual([
      ['contactName', 'text', true],
      ['contactEmail', 'email', true],
      ['contactMessage', 'textarea', false],
    ])
    await expect(form).toContainText('What will you update on this page')
    await form.getByLabel('Name').fill('Test Reporter')
    await form.getByLabel('Email').fill('reporter@localhost')
    await form.getByLabel('Comment').fill('report-ok')
    expect(log.entries.filter(isE10)).toEqual([])
    await form.getByRole('button', { name: 'Submit' }).click()

    // ---- modal 3: one E10 with the documented body; Thank you! ----
    const success = successModal(page)
    await expect(success.getByRole('heading', { level: 3 })).toHaveText(
      'Thank you!'
    )
    await expect(form).toHaveCount(0)
    await expect.poll(() => log.entries.filter(isE10).length).toBe(1)
    expect(
      log.entries.filter(isE10).map((e) => [e.bodyText, e.status])
    ).toEqual([[e10Body('issueWithContent', 'author', 'report-ok'), 201]])
    await expect(success).toContainText('We have received your request.')
    await expect(success).toContainText(
      `We can update the output's record only if the the document was updated at ${PROVIDER}.`
    )
    await expect(success.getByRole('img', { name: 'confirmed' })).toBeVisible()
    await expectHideManually(page, success)
    expect(await pageState(page)).toEqual({
      overflow: 'hidden',
      dialogs: ['Success-type-modal'],
    })

    // ---- got it: closed, store reset (the chain starts empty again) ----
    await success.getByRole('button', { name: 'got it' }).click()
    await expect(success).toHaveCount(0)
    expect(await pageState(page)).toEqual({ overflow: 'unset', dialogs: [] })
    await report.click()
    await expect(type).toBeVisible()
    expect(await optionCards(type)).toEqual(options(null))
    await type.getByRole('button', { name: 'Close' }).click()
    await expect(type).toHaveCount(0)
    expect(log.entries.filter(isE10)).toHaveLength(1)
    expect(rel(p2Env, page.url())).toBe('/outputs/2001/')
  })

  test('T-713 @P1 Q-082 outputs 2001 takedown as Author: "got it" never soft-refreshes (no _next/data, no history entry)', async ({
    page,
    p2Env,
  }) => {
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/outputs/2001/')
    const buildId = await buildIdOf(page)
    await submitReport(page, TAKEDOWN, 'Author', 'report-ok')
    const success = successModal(page)
    await expect(success.getByRole('heading', { level: 3 })).toHaveText(
      'Thank you!'
    )
    await expect(success).toContainText(
      `We can remove the output's record only if the the document was removed at ${PROVIDER}.`
    )
    expect(
      log.entries.filter(isE10).map((e) => [e.bodyText, e.status])
    ).toEqual([[e10Body('takeDownFullText', 'author', 'report-ok'), 201]])
    const m = log.mark()
    const history = (await historyLog(page)).length
    expect(await page.evaluate(() => window.next.router.asPath)).toBe(
      '/outputs/2001/'
    )
    await success.getByRole('button', { name: 'got it' }).click()
    await expect(success).toHaveCount(0)
    await settle(page, tracker)
    // the soft refresh would be router.push('/outputs/2001'): nothing happens
    expect(navigations(log.since(m), p2Env, buildId)).toEqual([])
    expect(log.since(m)).toEqual([])
    expect((await historyLog(page)).length).toBe(history)
    expect(await routerEvents(page)).toEqual([])
    expect(rel(p2Env, page.url())).toBe('/outputs/2001/')
  })

  test('T-713 @P1 Q-060 and Q-094 outputs 2001 E10 500: nothing visible; the client navigation to /outputs/update/ shows the stored error, a hard load does not', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // the failing E10 is logged by Chromium as a failed resource (one console error)
    declareGuard('console')
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/outputs/2001/')
    await submitReport(page, TAKEDOWN, 'Author', 'report-fail')
    await expect
      .poll(() => log.entries.filter(isE10).map((e) => e.status))
      .toEqual([500])
    expect(log.entries.filter(isE10).map((e) => e.bodyText)).toEqual([
      e10Body('takeDownFullText', 'author', 'report-fail'),
    ])
    await settle(page, tracker)
    // Q-060: the form closed, no success modal, no message anywhere on the page
    await expect(formModal(page)).toHaveCount(0)
    await expect(successModal(page)).toHaveCount(0)
    expect(await pageState(page)).toEqual({ overflow: 'unset', dialogs: [] })
    await expect(page.getByText(ERROR_MESSAGE)).toHaveCount(0)
    expectConsole(guardLog, [FAILED_500])

    // ---- Q-094: client navigation to /outputs/update/: the stored report.error is rendered ----
    const m = log.mark()
    await page.evaluate(() => window.next.router.push('/outputs/update/'))
    await expect(page).toHaveURL(`${p2Env.baseURL}/outputs/update/`)
    await settle(page, tracker)
    await expect(
      page.getByRole('heading', { name: 'Article Takedown Request' })
    ).toBeVisible()
    await expect(page.getByText(ERROR_MESSAGE, { exact: true })).toBeVisible()
    await expect(page.getByLabel('CORE URL')).toHaveValue('')
    // Q-011: no gSSP page, App.getInitialProps runs in the browser (E19 x3); no E10
    expect(
      log
        .since(m)
        .filter((e) => e.kind === 'api')
        .map((e) => [e.method, e.url, e.status])
    ).toEqual([
      ['GET', `${API}/internal/statistics`, 200],
      ['GET', `${API}/internal/repositories/formap`, 200],
      ['GET', `${API}/internal/members`, 200],
    ])
    expectConsole(guardLog, [FAILED_500])

    // ---- a hard load of /outputs/update/ starts with an empty store: no message ----
    await open(page, '/outputs/update/')
    await expect(
      page.getByRole('heading', { name: 'Article Takedown Request' })
    ).toBeVisible()
    await expect(page.getByText(ERROR_MESSAGE)).toHaveCount(0)
    expectConsole(guardLog, [FAILED_500])
  })
})

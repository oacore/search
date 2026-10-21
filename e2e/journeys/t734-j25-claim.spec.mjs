// T-734 (41 H, J25, R-028, R-038, R-073): claim rows and modals of /data-providers/{id}/. Pins today's
// behaviour exactly, quirks included:
//   c1  claim rows 1-5 of 41 §2.6, server-rendered page against the settled hydrated page. ClaimCard asks
//       `/account` (E18) from its render; the server never has the answer, so the SSR page always says "Not a
//       member yet" and shows the card for providers without accounts (unless the billing type is "starting");
//       after hydration the badge and the card follow what E18 returns, not the billing type (Q-087);
//   c2  (the five row tests read the SSR stub's wire log of their own render, so they carry @wire and run in the
//       serial wire project, after every other project: a neighbour that loads the same provider adds its calls
//       to the window)
//       E18 counts per 41 §2.2: 1 on the server, 2 in the browser with accounts and 1 without, plus 1 for every
//       ClaimCard re-render (modal state, the e-mail state of a claim attempt; Q-087, Q-027), and a failed
//       claim POST is silent (Q-027);
//   c3  the claim race of the add-provider form (Q-091): the second call aborts the first, whose AbortError lands
//       after the second call's reset() and shows the error message although the second call succeeds.
// Fixtures: provider-86 / 4835 / 3354, logos, e17-claim (86: claim-ok 201, claim-fail 500), e16-claim-form
// (created.example.org) and req-P0-14 (second.example.org). Rows 2, 3 and 5 override E18 (picks.claimRows).
import { test, expect } from '../lib/P0-14/fixtures.mjs'
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  netLog,
  settle,
  trackPage,
  watchRouter,
} from '../lib/P0-14/page.mjs'
import {
  API,
  ROWS,
  browserE18,
  claimState,
  overrideE18,
  stubMark,
  stubWindow,
} from '../lib/P0-14/claim.mjs'

// a hard load of these pages can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.use({ navigationTimeout: NAV_TIMEOUT, actionTimeout: ACTION_TIMEOUT })

const CARD_A = (name) =>
  `Do you manage ${name}? Access insider analytics, issue reports and manage access to outputs from your repository in the CORE Repository Dashboard!👇`
const CARD_B =
  'Do you manage Open Research Online? Become a CORE Member to access insider analytics, issue reports and manage access to outputs from your repository in the CORE Repository Dashboard! 👇'
const NOT_MEMBER = 'Not a member yet'
const SIGN_IN = ['SIGN IN', 'Create account']
const BECOME = ['Become a member']

// the row table of 41 §2.6 as the SSR page and the settled hydrated page show it
const EXPECTED = {
  '1': {
    ssr: {
      university: 'The Open University',
      badge: NOT_MEMBER,
      cardText: CARD_B,
      buttons: BECOME,
    },
    final: {
      university: 'The Open University',
      badge: 'sustaining member',
      cardText: CARD_A('Open Research Online (The Open University)'),
      buttons: SIGN_IN,
    },
  },
  '2': {
    ssr: {
      university: 'Aberystwyth University',
      badge: NOT_MEMBER,
      cardText: CARD_A('Aberystwyth Research Portal'),
      buttons: SIGN_IN,
    },
  },
  '3': {
    ssr: {
      university: 'The Open University',
      badge: NOT_MEMBER,
      cardText: CARD_B,
      buttons: BECOME,
    },
  },
  '4': {
    ssr: {
      university: '',
      badge: NOT_MEMBER,
      cardText: CARD_B,
      buttons: BECOME,
    },
  },
  '5a': {
    ssr: {
      university: 'The Open University',
      badge: NOT_MEMBER,
      cardText: CARD_B,
      buttons: BECOME,
    },
  },
  '5b': {
    ssr: {
      university: 'The Open University',
      badge: NOT_MEMBER,
      cardText: CARD_B,
      buttons: BECOME,
    },
  },
}
// rows whose browser E18 fails: Chromium prints the failed fetch as a console.error, which the guard would
// reject; the test declares it and asserts it itself
const FAILING = {
  '5a': 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
  '5b': 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
}
const declareFailure = (rowKey, guardLog) => {
  if (!FAILING[rowKey]) return () => {}
  test.info().annotations.push({ type: 'guard-expect', description: 'console' })
  return () =>
    expect(guardLog.consoleErrors.map((e) => e.text)).toEqual([FAILING[rowKey]])
}

async function hydratedProvider(page, p2Env, id) {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const res = await page.goto(`/data-providers/${id}/`)
  await watchRouter(page)
  await settle(page, tracker)
  return { log, tracker, status: res.status() }
}

test.describe('T-734 @P0 J25 claim rows', () => {
  // the claim tests override E18 on the stack's SSR stub (global to the stack): run them one after the other
  test.describe.configure({ mode: 'default', timeout: TEST_TIMEOUT })

  for (const key of Object.keys(ROWS)) {
    const row = ROWS[key]
    test(`T-734 c1 @P0 claim row ${key} (provider ${row.id}${
      row.answer
        ? `, E18 ${row.answer.status} ${row.answer.body}`
        : ', recorded E18'
    }): SSR page against the settled page`, async ({
      page,
      p2Env,
      guardLog,
      jsOffContext,
    }) => {
      const verify = declareFailure(key, guardLog)
      const cleanup = await overrideE18(page, p2Env, row)
      try {
        // the server-rendered page: JavaScript off, so nothing past the server's HTML
        const ssrPage = await jsOffContext.newPage()
        const res = await ssrPage.goto(`/data-providers/${row.id}/`)
        expect(res.status()).toBe(200)
        const ssr = await claimState(ssrPage)
        await hydratedProvider(page, p2Env, row.id)
        const final = await claimState(page)
        const want = EXPECTED[key]
        expect(ssr, `row ${key} SSR`).toEqual(want.ssr)
        // rows whose E18 has no accounts keep the SSR page; row 1 flips to the member view (Q-087)
        expect(final, `row ${key} final`).toEqual(want.final || want.ssr)
        verify()
      } finally {
        await cleanup()
      }
    })
  }

  for (const key of Object.keys(ROWS)) {
    const row = ROWS[key]
    test(`T-734 c2 @P0 @wire claim row ${key} (provider ${
      row.id
    }): /account counts, 1 on the server and ${
      key === '1' ? 2 : 1
    } in the browser`, async ({ page, p2Env, guardLog }) => {
      const verify = declareFailure(key, guardLog)
      const cleanup = await overrideE18(page, p2Env, row)
      try {
        const mark = await stubMark(p2Env, `t734-c2-${key}`)
        const seen = browserE18(page, row.id)
        await hydratedProvider(page, p2Env, row.id)
        const allServer = await stubWindow(p2Env, mark.seq)
        const server = allServer.filter(
          (r) => r.path === `/internal/data-providers/${row.id}/account`
        )
        // 41 §2.2: the server asks once (un-awaited, last of its calls: E11, E12, E13, then E18); the browser
        // asks once in the first render and once more after the answer flipped the card (accounts only: Q-087)
        expect(server.map((r) => [r.method, r.status])).toEqual([
          ['GET', row.answer ? row.answer.status : 200],
        ])
        expect(
          allServer
            .filter((r) => r.path.includes(`/data-providers/${row.id}`))
            .map((r) => r.path)
        ).toEqual([
          `/v3/data-providers/${row.id}?t=undefined`,
          `/v3/data-providers/${row.id}/stats`,
          `/v3/data-providers/${row.id}/outputs?q=&offset=0&limit=10&sort=recency`,
          `/internal/data-providers/${row.id}/account`,
        ])
        const withAccounts = key === '1'
        expect(seen.map((e) => [e.method, e.status])).toEqual(
          Array.from({ length: withAccounts ? 2 : 1 }, () => [
            'GET',
            row.answer ? row.answer.status : 200,
          ])
        )
        // the first button only opens a new window (dashboard or membership page): no ClaimCard state, no
        // further /account request
        await page.evaluate(() => {
          window.__opened = []
          window.open = (...a) => {
            window.__opened.push(a)
            return null
          }
        })
        const first =
          withAccounts || key === '2' ? 'SIGN IN' : 'Become a member'
        await page.getByRole('button', { name: first }).click()
        expect(await page.evaluate(() => window.__opened)).toEqual([
          [
            first === 'SIGN IN'
              ? 'https://dashboard.core.ac.uk/'
              : 'https://core.ac.uk/membership',
            '_blank',
          ],
        ])
        expect(seen).toHaveLength(withAccounts ? 2 : 1)
        verify()
      } finally {
        await cleanup()
      }
    })
  }

  test('T-734 c2 @P0 row 1 modals: +1 /account per ClaimCard re-render, a failed claim POST is silent (Q-027, Q-087)', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // the failed claim POST is a 500 answer: Chromium logs it, the test declares and asserts it
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const row = ROWS[1]
    const seen = browserE18(page, row.id)
    const posts = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().startsWith(API))
        posts.push({
          url: r.url(),
          body: r.postData(),
          contentType: r.headers()['content-type'],
        })
    })
    const { tracker } = await hydratedProvider(page, p2Env, row.id)
    const count = () => seen.length
    // load: first render + the render after the answer
    expect(count()).toBe(2)
    await page.evaluate(() => {
      window.__opened = []
      window.open = (...a) => {
        window.__opened.push(a)
        return null
      }
    })
    // SIGN IN opens the dashboard in a new window: no ClaimCard state, no request
    await page.getByRole('button', { name: 'SIGN IN' }).click()
    expect(await page.evaluate(() => window.__opened)).toEqual([
      ['https://dashboard.core.ac.uk/', '_blank'],
    ])
    expect(count()).toBe(2)
    // Create account: ClaimCard state changes, one more render, one more E18
    await page.getByRole('button', { name: 'Create account' }).click()
    const modal = page.getByRole('dialog', {
      name: 'Create Repository Dashboard Account',
    })
    await expect(modal).toBeVisible()
    await settle(page, tracker)
    expect(count()).toBe(3)
    // required fields empty: Continue only focuses them, nothing is sent and ClaimCard does not render
    await modal.getByRole('button', { name: 'Continue' }).click()
    await settle(page, tracker)
    expect(posts).toEqual([])
    expect(count()).toBe(3)
    // typing is state of the modal's own hook, not ClaimCard's
    await modal.getByLabel('Name').fill('Test Claimant')
    await modal.getByLabel('Email').fill('claimant@localhost')
    await modal.locator('#contactRationale-control').fill('claim-fail')
    expect(count()).toBe(3)
    // claim attempt 1: setNewEmail re-renders ClaimCard (+1), the POST answers 500, the error is swallowed
    // (api/claim.js throws, getClaim returns): no message, no success modal, the edit modal stays
    await modal.getByRole('button', { name: 'Continue' }).click()
    await expect.poll(() => posts.length, { timeout: NAV_TIMEOUT }).toBe(1)
    await settle(page, tracker)
    // an object body: api/index.js stringifies it and sets the JSON Content-Type (unlike E16's string body)
    expect(posts[0]).toEqual({
      url: `${API}/internal/data-providers/86/claim`,
      body: '{"name":"Test Claimant","email":"claimant@localhost","rationale":"claim-fail","repositoryHasAccount":true}',
      contentType: 'application/json',
    })
    expect(count()).toBe(4)
    await expect(modal).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'Claim success modal' })
    ).toHaveCount(0)
    expect(guardLog.consoleErrors.map((e) => e.text)).toEqual([
      'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
    ])
    // claim attempt 2: the same e-mail state (no extra render), the success modal opens (+1)
    await modal.locator('#contactRationale-control').fill('claim-ok')
    await modal.getByRole('button', { name: 'Continue' }).click()
    const success = page.getByRole('dialog', { name: 'Claim success modal' })
    await expect(success).toBeVisible({ timeout: NAV_TIMEOUT })
    await settle(page, tracker)
    expect(posts.map((p) => p.body)).toEqual([
      '{"name":"Test Claimant","email":"claimant@localhost","rationale":"claim-fail","repositoryHasAccount":true}',
      '{"name":"Test Claimant","email":"claimant@localhost","rationale":"claim-ok","repositoryHasAccount":true}',
    ])
    expect(count()).toBe(5)
    await expect(success).toContainText(
      'We sent your request to the registered repository manager for approval.'
    )
    // Close: the three modal flags are reset in one handler, one render, one more E18
    await success.locator('button', { hasText: /^Close$/ }).click()
    await expect(success).toHaveCount(0)
    await expect(modal).toHaveCount(0)
    await settle(page, tracker)
    expect(count()).toBe(6)
    expect(seen.every((e) => e.method === 'GET' && e.status === 200)).toBe(true)
  })
})

test.describe('T-734 @P0 J25 claim race (Q-091)', () => {
  test.describe.configure({ mode: 'default', timeout: TEST_TIMEOUT })

  test('T-734 c3 @P0 Q-091: the aborted first call lands after the second call started and its error hides the second success', async ({
    page,
    p2Env,
  }) => {
    // The plan names the stub's latency; the claim POST (E16) is made by the browser, which the fixture
    // resolver answers (40 §2.4), not the SSR stub (its control API delays server-side calls only). The
    // delay is therefore applied to the browser's request: each E16 waits at a gate, then continues to the
    // guard's resolver route, which answers the recorded fixture.
    const gates = []
    const arrivals = []
    const contentTypes = []
    await page.route(
      (u) => u.href === `${API}/internal/data-providers`,
      async (route) => {
        const gate = {}
        gate.open = new Promise((resolve) => {
          gate.release = resolve
        })
        gates.push(gate)
        arrivals.push(route.request().postData())
        contentTypes.push(route.request().headers()['content-type'])
        await gate.open
        // a request the page aborted can no longer continue; its handler just ends
        await route.fallback().catch(() => {})
      }
    )
    const { tracker } = await (async () => {
      const t = trackPage(page)
      await page.goto('/data-providers/?action=ADD')
      await watchRouter(page)
      await settle(page, t)
      return { tracker: t }
    })()
    const field = page.getByLabel('Data provider URL')
    const finish = page.getByRole('button', { name: 'Finish' })
    const errorText = page.getByText(
      'We cannot detect a repository or a journal at this address.'
    )
    const createdText = (name) =>
      page.getByText(`We found ${name} under the entered address`)
    const states = []
    const snap = async (name) =>
      states.push({
        state: name,
        requests: arrivals.length,
        error: await errorText.count(),
        created1: await createdText('Example Repository').count(),
        created2: await createdText('Second Repository').count(),
        finishEnabled: await finish.isEnabled(),
      })
    try {
      // call 1: first value, held at its gate (the progress state: no helper text, Finish disabled)
      await field.fill('https://created.example.org/')
      await expect.poll(() => arrivals.length, { timeout: NAV_TIMEOUT }).toBe(1)
      await snap('call 1 in flight')
      // call 2: the second value; retrieve() aborts call 1 first. The AbortError of call 1 lands after
      // call 2's reset() and isLoading = true: the error message shows while call 2 is still held
      await field.fill('https://second.example.org/')
      await expect.poll(() => arrivals.length, { timeout: NAV_TIMEOUT }).toBe(2)
      await expect(errorText).toBeVisible({ timeout: NAV_TIMEOUT })
      await snap('call 2 in flight, call 1 aborted')
      // call 2 answers: created is set, but error > created: the error message stays, Finish enables
      gates[1].release()
      await expect(finish).toBeEnabled({ timeout: NAV_TIMEOUT })
      await settle(page, tracker)
      await snap('call 2 answered')
      // call 1's held request ends without effect
      gates[0].release()
      await settle(page, tracker)
      await snap('call 1 released')
    } finally {
      for (const g of gates) g.release()
    }
    // the body is a string, so fetch labels it text/plain (Q-019, R-028)
    expect(contentTypes).toEqual([
      'text/plain;charset=UTF-8',
      'text/plain;charset=UTF-8',
    ])
    expect(arrivals).toEqual([
      '{"uri":"https://created.example.org/"}',
      '{"uri":"https://second.example.org/"}',
    ])
    expect(states).toEqual([
      {
        state: 'call 1 in flight',
        requests: 1,
        error: 0,
        created1: 0,
        created2: 0,
        finishEnabled: false,
      },
      {
        state: 'call 2 in flight, call 1 aborted',
        requests: 2,
        error: 1,
        created1: 0,
        created2: 0,
        finishEnabled: false,
      },
      {
        state: 'call 2 answered',
        requests: 2,
        error: 1,
        created1: 0,
        created2: 0,
        finishEnabled: true,
      },
      {
        state: 'call 1 released',
        requests: 2,
        error: 1,
        created1: 0,
        created2: 0,
        finishEnabled: true,
      },
    ])
  })
})

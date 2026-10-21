// P0-13 journey recorder: one object per page that records, per step, the URL, the DOM view, the browser
// request log, the history log (the guard's init script), the router events and the loading-bar log of that
// step (the task brief: "URL, DOM and request log asserted per step").
import { expect, historyLog } from '../../fixtures/guard.mjs'
import {
  NAV_TIMEOUT,
  trackPage,
  watchRouter,
  settle,
  flushTasks,
  routerEvents,
  installLoadingBarLog,
  loadingBarEvents,
  historySince,
  netLog,
  isE2,
  isDocument,
  isLogo,
  e2Queries,
  nextDataOf,
  buildIdOf,
} from './page.mjs'
import { searchView } from './view.mjs'

export class Journey {
  constructor(page, p2Env) {
    this.page = page
    this.p2Env = p2Env
    this.tracker = trackPage(page)
    this.net = netLog(page, p2Env)
    this.buildId = null
  }

  // a hard load; the loading-bar log is installed before the first script runs. The filters bar calls the
  // aggregation endpoint (E2) once after hydration, from an effect, so the load is settled only after it.
  static async open(page, p2Env, path, { e2 = 1 } = {}) {
    const j = new Journey(page, p2Env)
    await installLoadingBarLog(page)
    const m = j.net.mark()
    const response = await page.goto(path)
    await settle(page, j.tracker)
    await watchRouter(page)
    await j.settleE2(m, e2)
    j.buildId = await buildIdOf(page)
    await page.evaluate(() => {
      window.__p13marker = 'kept'
    })
    j.response = response
    j.first = await j.record('load', { net: m, hist: 0, router: 0, bar: 0 })
    return j
  }

  // the DOM view once two reads 300 ms apart agree (a render queued by the last response, e.g. the filters'
  // data after the E2 answer, has then run: settled states only, 40 §5)
  async stableView() {
    let last = null
    let view = null
    await expect
      .poll(
        async () => {
          view = await searchView(this.page)
          const sig = JSON.stringify(view)
          const same = sig === last
          last = sig
          return same
        },
        { timeout: NAV_TIMEOUT, intervals: [300] }
      )
      .toBe(true)
    return view
  }

  async marks() {
    return {
      net: this.net.mark(),
      hist: (await historyLog(this.page)).length,
      router: ((await routerEvents(this.page)) || []).length,
      bar: ((await loadingBarEvents(this.page)) || []).length,
    }
  }

  async record(name, m) {
    const { page, p2Env } = this
    const entries = this.net.since(m.net)
    const apiOther = entries.filter(
      (e) => e.kind === 'api' && !isE2(e) && !isLogo(e)
    )
    return {
      name,
      view: await this.stableView(),
      scrollY: await page.evaluate(() => window.scrollY),
      marker: await page.evaluate(() => window.__p13marker || null),
      requests: {
        documents: entries.filter(isDocument).length,
        nextData: nextDataOf(entries, this.buildId || ''),
        e2: e2Queries(entries),
        e2Aggregations: entries
          .filter(isE2)
          .map((e) => JSON.parse(e.bodyText).aggregations),
        apiOther: apiOther.map((e) => `${e.method} ${e.url}`),
      },
      history: await historySince(page, p2Env, m.hist),
      router: ((await routerEvents(page)) || []).slice(m.router),
      bar: ((await loadingBarEvents(page)) || []).slice(m.bar),
    }
  }

  // settled, after `e2` aggregation calls of the step have been issued (the call starts in an effect after the
  // render; on a loaded machine it can come later than two quiet polls), and after the queued tasks ran
  async settleE2(m, e2) {
    await settle(this.page, this.tracker)
    if (e2 > 0) {
      await expect
        .poll(() => this.net.since(m.net).filter(isE2).length, {
          timeout: NAV_TIMEOUT,
        })
        .toBeGreaterThanOrEqual(e2)
      await settle(this.page, this.tracker)
    }
    await flushTasks(this.page)
  }

  // an action that ends on `url` (relative to the stack origin) and a settled page; `e2` is the number of
  // filters calls the action causes (41 §2.2: a new q, filter or year 1, Clear all 2, page or sort 0)
  async act(name, fn, { url, e2 = 0 } = {}) {
    const m = await this.marks()
    await fn()
    if (url !== undefined)
      await expect(this.page).toHaveURL(`${this.p2Env.baseURL}${url}`, {
        timeout: NAV_TIMEOUT,
      })
    await this.settleE2(m, e2)
    return this.record(name, m)
  }
}

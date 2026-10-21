// P0-13 DOM views of the search page (T-703..T-706): one plain object per settled step, built inside the page
// from roles, text and the class stems of the CSS modules. A class stem is a class token without its hash
// (`styles_bar-item-active__20zrH` -> `styles_bar-item-active`), so the views survive a rebuild but fail
// when a CSS-module class is lost (R-001: `class=""`).
export const searchView = (page) =>
  page
    .evaluate(() => {
      const stem = (c) => c.replace(/__[\w-]{5}$/, '')
      const stems = (el) =>
        [...el.classList].map(stem).filter((c) => /^styles_/.test(c))
      const text = (el) => (el ? el.textContent.trim() : null)
      const input = document.querySelector('#select-app-bar-search')
      const hits = [...document.querySelectorAll('p')]
        .map((p) => p.textContent)
        .find((t) => /research outputs found/.test(t))
      const cards = [
        ...document.querySelectorAll('[id^="work-search-output-"]'),
      ]
      // the filters bar: the list whose items are the six facet pills
      const bar = [...document.querySelectorAll('ul')].find(
        (u) =>
          u.querySelector(':scope > li > div[role="presentation"] > p') &&
          /^styles_bar$/.test(stems(u)[0] || '')
      )
      const pills = bar
        ? [...bar.querySelectorAll(':scope > li')]
            .filter((li) =>
              li.querySelector(':scope > div[role="presentation"]')
            )
            .map((li) => {
              const head = li.querySelector(':scope > div[role="presentation"]')
              const box = li.querySelector(':scope > ul')
              return {
                label: text(head.querySelector('p')),
                active: stems(head).includes('styles_bar-item-active'),
                open: Boolean(box),
              }
            })
        : null
      const clear = [...document.querySelectorAll('button')].some((b) =>
        /^Clear all filters$/.test(b.textContent.trim())
      )
      const sort = [...document.querySelectorAll('span')].find((s) =>
        /^Sort by/.test(s.textContent.trim())
      )
      // the pagination list: the list of buttons with the dots item
      const pager = [...document.querySelectorAll('ul')].find(
        (u) =>
          u.querySelector(':scope > li > button') &&
          stems(u).includes('styles_pagination')
      )
      const pagination = pager
        ? [...pager.querySelectorAll(':scope > li')].map((li) => {
            const b = li.querySelector('button')
            if (!b) return { dots: li.textContent.trim() }
            const s = stems(b)
            return {
              label: b.textContent.trim() || '(icon)',
              active: s.includes('styles_pagination-item-active'),
              disabledClass: s.includes('styles_pagination-item-disabled'),
              disabledAttr: b.disabled,
              pointerEvents: getComputedStyle(b).pointerEvents,
            }
          })
        : null
      return {
        pathname: location.pathname,
        search: location.search,
        title: document.title,
        input: input ? input.value : null,
        hits: hits || null,
        ids: cards.map((c) => c.id.replace('work-search-output-', '')),
        cardClassStems: cards.length ? stems(cards[0]) : [],
        pills,
        clear,
        sort: sort ? sort.textContent.trim().replace(/\s+/g, ' ') : null,
        pagination,
        noResults:
          (
            [...document.querySelectorAll('h1,h2,h3')].find((h) =>
              /find any results/.test(h.textContent)
            ) || {}
          ).textContent || null,
      }
    })
    .then((v) => ({ ...v, url: `${v.pathname}${v.search}` }))

// the items of the open facet box of a pill: label text (as in the DOM; CSS capitalises it), count text,
// checked radio, the `disabled` class (pointer-events:none, Q-083) and the `Search` field value
export const facetItems = (page, label) =>
  page.evaluate((pillLabel) => {
    const stem = (c) => c.replace(/__[\w-]{5}$/, '')
    const stems = (el) => [...el.classList].map(stem)
    const li = [...document.querySelectorAll('ul > li')].find((x) => {
      const head = x.querySelector(':scope > div[role="presentation"] > p')
      return head && head.textContent.trim() === pillLabel
    })
    const box = li && li.querySelector(':scope > ul')
    if (!box) return null
    const field = box.querySelector('input[type="text"]')
    return {
      search: field ? field.value : null,
      items: [...box.querySelectorAll(':scope > li')]
        .filter((x) => x.querySelector('input[type="radio"]'))
        .map((x) => ({
          text: x.querySelector('label p').textContent,
          count: x.querySelector('label span').textContent,
          checked: x.querySelector('input[type="radio"]').checked,
          disabled: stems(x).includes('styles_disabled'),
          pointerEvents: getComputedStyle(x).pointerEvents,
        })),
    }
  }, label)

// the facts of every result card: id, title and its link, the author links, the metadata values by label,
// whether an abstract is shown, the thumbnail link and image
export const cardFacts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[id^="work-search-output-"]')].map((c) => {
      const title = c.querySelector('h3 a')
      const meta = {}
      for (const g of c.querySelectorAll('dl > div'))
        meta[g.querySelector('dt').textContent] =
          g.querySelector('dd').textContent
      const abstract = c.querySelector('[itemprop="abstract"]')
      const authors = [...c.querySelectorAll('ol[aria-label="Author"] a')]
      return {
        id: c.id.replace('work-search-output-', ''),
        title: title.textContent,
        titleHref: title.getAttribute('href'),
        authorHrefs: authors.map((a) => a.getAttribute('href')),
        authorNames: authors.map((a) => a.textContent),
        meta,
        abstract: abstract ? abstract.textContent : null,
      }
    })
  )

// the open box of the "year" pill: the quick ranges (label, count, checked, `filter-box-item-active`
// pointer-events:none, Q-083), the "Custom range" row, the Histoslider (labels, bars, any NaN in its markup:
// R-012 drops its defaultProps) and the two selects (hidden on desktop, shown until 767 px)
export const yearView = (page) =>
  page.evaluate(() => {
    const stem = (c) => c.replace(/__[\w-]{5}$/, '')
    const stems = (el) => [...el.classList].map(stem)
    const li = [...document.querySelectorAll('ul > li')].find((x) => {
      const head = x.querySelector(':scope > div[role="presentation"] > p')
      return head && head.textContent.trim() === 'year'
    })
    const box = li && li.querySelector(':scope > ul')
    if (!box) return null
    const rows = [...box.querySelectorAll(':scope > li')]
    const quick = rows
      .filter((x) => x.querySelector('input[type="radio"]'))
      .map((x) => ({
        text: x.querySelector('label p').textContent,
        count: x.querySelector('label span').textContent,
        checked: x.querySelector('input[type="radio"]').checked,
        activeClass: stems(x).includes('styles_filter-box-item-active'),
        pointerEvents: getComputedStyle(x).pointerEvents,
      }))
    const custom = rows.find((x) => /Custom range/.test(x.textContent))
    const slider = box.querySelector('[class*="histoslider-histoslider"]')
    const svgs = slider ? [...slider.querySelectorAll('svg')] : []
    return {
      quick,
      custom: custom
        ? {
            count: custom.querySelector('span').textContent,
            check: Boolean(custom.querySelector('svg')),
            activeText: stems(custom.querySelector('p')).includes(
              'styles_label-text-active'
            ),
          }
        : null,
      slider: slider
        ? {
            labels: [
              slider.querySelector('[class*="label-left"]').textContent,
              slider.querySelector('[class*="label-right"]').textContent,
            ],
            bars: slider.querySelectorAll('rect[class*="histogram-item"]')
              .length,
            handles: slider.querySelectorAll('g[tabindex="0"]').length,
            nan: svgs.some((s) => /NaN/.test(s.outerHTML)),
            // width x height attributes of the histogram and of the handle track (R-012: both come from the
            // Histoslider's defaultProps merged with the app's props)
            svgs: svgs.map(
              (s) => `${s.getAttribute('width')}x${s.getAttribute('height')}`
            ),
            width: slider.style.width,
          }
        : null,
      selects: [...box.querySelectorAll('select')].map((s) => ({
        visible: s.getClientRects().length > 0,
        value: s.value,
        options: s.options.length,
        first: s.options[0].value,
        last: s.options[s.options.length - 1].value,
      })),
    }
  })

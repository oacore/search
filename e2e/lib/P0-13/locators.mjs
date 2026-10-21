// P0-13 locators: roles, labels and text first (README errata ER-24); a CSS-module class is read only through
// the stems of view.mjs. Pills and facet boxes are `role="presentation"` elements without a role of their own
// (no keyboard path, findings/07 §2.2), so they are found by their text inside the filters bar.

// the header search input (role combobox; its label is "Search <N> from papers around the world", where <N>
// depends on the statistics data, Q-004)
export const headerSearch = (page) =>
  page.getByRole('combobox', { name: /from papers around the world$/ })

// the filters bar: the list holding the six facet pills
export const filtersBar = (page) =>
  page
    .getByRole('list')
    .filter({ has: page.getByText('publisher', { exact: true }) })
    .first()

// one pill: its list item (the pill head and, while open, its facet box)
export const pill = (page, label) =>
  filtersBar(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(label, { exact: true }) })

export const pillHead = (page, label) =>
  pill(page, label).getByText(label, { exact: true }).first()

// the open facet box of a pill
export const facetBox = (page, label) => pill(page, label).getByRole('list')

// a value in an open facet box (the text of its label, not its count)
export const facetItem = (page, label, value) =>
  facetBox(page, label).getByText(value, { exact: true })

// the numbered pagination: its list (the one with numbered or first/last buttons; the filters bar holds only
// the "Clear all filters" button), then the icon-only previous and next buttons (no accessible name)
export const pager = (page) =>
  page
    .getByRole('list')
    .filter({ has: page.getByRole('button', { name: /^(\d+|first|last)$/ }) })
    .first()

export const pagerPrev = (page) => pager(page).getByRole('button').first()
export const pagerNext = (page) => pager(page).getByRole('button').last()

// the sort box
export const sortBox = (page) => page.getByText('Sort by')

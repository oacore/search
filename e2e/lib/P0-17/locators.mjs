// P0-17 locators: roles, labels and text first (README errata ER-24); a CSS-module class is read only through
// the stems below (the hash suffix differs per build, the stem does not). Pills and facet boxes are
// `role="presentation"` elements without a role of their own (no keyboard path, findings/07 §2.2), so they are
// found by their text inside the filters bar.

// the header search input (role combobox; its label is "Search <N> from papers around the world", where <N>
// depends on the statistics data, Q-004)
export const headerSearch = (page) =>
  page.getByRole('combobox', { name: /from papers around the world$/ })

// the collapsed header search of the works and outputs pages: an icon button
export const headerSearchIcon = (page) =>
  page.getByRole('banner').getByRole('button', { name: 'Search icon' })

// the "How to search?" link text of the header search (opens the advanced-search panel)
export const howToSearch = (page) => page.getByText('How to search?')

// below 768 px "How to search?" is hidden; an info button appears in the focused input instead
export const infoButton = (page) =>
  page.locator('[class*="select-info-append-button"]')

// the advanced-search panel
export const advancedPanel = (page) =>
  page.getByText('To refine your searches you can use:')

// <=767 px: the filters bar sits behind a full-width "Filters" button
export const filtersToggle = (page) =>
  page.getByRole('button', { name: 'Filters', exact: true })

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

// the open facet boxes of the page (CSS-module stem `filter-box`)
export const openFacetBoxes = (page) => page.locator('[class*="filter-box__"]')

// the "Clear all filters" button (found by its text, not its role: below 768 px the bar is hidden until the
// "Filters" button opens it, and role queries skip hidden elements)
export const clearAll = (page) =>
  page.locator('button').filter({ hasText: 'Clear all filters' })

// the pills that carry the highlight class (a facet with a checked value)
export const activePills = (page) =>
  page.locator('[class*="bar-item-active__"]')

// the results header: the two icon buttons (no accessible name: download CSV, copy URL) and the sort box
export const downloadButton = (page) =>
  page.locator('[class*="action-button__"]').nth(0)
export const copyButton = (page) =>
  page.locator('[class*="action-button__"]').nth(1)
export const sortBox = (page) => page.locator('[class*="sort-box__"]')

// the sort menu while open: its option items
export const sortMenu = (page) => page.locator('[class*="sort-box-menu__"]')

// the CSV modal
export const csvTitle = (page) =>
  page.getByRole('heading', { name: 'Download results in CSV' })
export const csvOption = (page, text) => page.getByText(text, { exact: false })
export const csvCancel = (page) => page.getByRole('button', { name: 'Cancel' })

// the copy-URL toast
export const toast = (page) => page.getByText('Link copied', { exact: true })

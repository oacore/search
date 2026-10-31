import React, { useMemo, useState } from 'react'

import reportStyles from './report/styles.module.css'
import styles from './styles.module.css'
import thumbnailStyles from './thumbnail-card.module.css'

import useHydrated from 'hooks/use-hydrated'

// An element of a design card that shows `keptClass` instead of the card's own
// classes while it is set, without leaving the DOM.
const kept =
  (Tag) =>
  ({ keptClass, className, ...passProps }) => (
    <Tag className={keptClass ?? className} {...passProps} />
  )

export const KeptDiv = kept('div')
export const KeptP = kept('p')

const PLAIN = {
  license: { keptClass: styles.licenseWrapper },
  report: {},
  map: {},
}

// The full text card used to be an <a> around <a> buttons (Q-072). The parser
// split it up, and on a page load the next cards of the sidebar were hydrated
// on the wrong server elements and kept those elements' classes and ids,
// which is how the page looks today. Client navigations render the plain
// classes. The card is no longer an anchor, so these are now set after mount,
// on a page load of a card that used to be one. The report card leaves them
// at its first update.
const repairedLook = ({ id, hasReader, hasVersions, useOtherVersions }) => {
  const bodyId = `full-text-thumbnail-${id}-body`
  if (useOtherVersions) {
    if (!hasReader) return PLAIN
    return {
      ...PLAIN,
      license: hasVersions ? { className: styles.boxes } : { keptClass: '' },
    }
  }
  if (hasReader) {
    return {
      license: { className: styles.card },
      map: {},
      report: {
        id: bodyId,
        card: { keptClass: thumbnailStyles.body },
        footer: { keptClass: '' },
      },
    }
  }
  return {
    license: { className: reportStyles.reportCard },
    map: { id: bodyId },
    report: {
      card: { className: styles.card },
      description: { keptClass: '' },
    },
  }
}

export const useRepairedSidebar = ({
  id,
  fulltextStatus,
  readerUrl,
  outputs,
  useOtherVersions,
}) => {
  const hydrated = useHydrated()
  const [look] = useState(() =>
    !hydrated && fulltextStatus !== 'disabled'
      ? repairedLook({
          id,
          hasReader: Boolean(readerUrl),
          hasVersions: outputs?.length > 0,
          useOtherVersions,
        })
      : PLAIN
  )
  return useMemo(() => (hydrated ? look : PLAIN), [hydrated, look])
}

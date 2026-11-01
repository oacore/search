import { useMemo, useState } from 'react'

import { REPORT_CARD_CLASS } from './report/report-card'
import styles from './styles.module.css'
import { THUMBNAIL_BODY_CLASS } from './thumbnail-card'

import useHydrated from 'hooks/use-hydrated'

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
const repairedLook = ({ id, hasReader }) => {
  const bodyId = `full-text-thumbnail-${id}-body`
  if (hasReader) {
    return {
      license: { className: styles.card },
      map: {},
      report: {
        id: bodyId,
        card: { keptClass: THUMBNAIL_BODY_CLASS },
        footer: { keptClass: '' },
      },
    }
  }
  return {
    license: { className: REPORT_CARD_CLASS },
    map: { id: bodyId },
    report: {
      card: { className: styles.card },
      description: { keptClass: null },
    },
  }
}

const useRepairedSidebar = ({
  id,
  fulltextStatus,
  readerUrl,
  useOtherVersions,
}) => {
  const hydrated = useHydrated()
  const [look] = useState(() =>
    !hydrated && !useOtherVersions && fulltextStatus !== 'disabled'
      ? repairedLook({ id, hasReader: Boolean(readerUrl) })
      : PLAIN
  )
  return useMemo(() => (hydrated ? look : PLAIN), [hydrated, look])
}

export default useRepairedSidebar

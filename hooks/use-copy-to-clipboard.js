import React from 'react'

const useCopyToClipboard = (text, notifyTimeout = 2500) => {
  const [copyStatus, setCopyStatus] = React.useState('inactive')
  const copy = React.useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setCopyStatus('copied'),
      () => setCopyStatus('failed')
    )
  }, [text])

  React.useEffect(() => {
    if (copyStatus === 'inactive') return

    const timeoutId = setTimeout(() => setCopyStatus('inactive'), notifyTimeout)

    // eslint-disable-next-line consistent-return
    return () => clearTimeout(timeoutId)
  }, [copyStatus])

  return [copyStatus, copy]
}

export default useCopyToClipboard

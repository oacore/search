import React from 'react'

// const useCopyToClipboard = (text) => {
//   const copyToClipboard = (str) => {
//     const el = document.createElement('textarea')
//     el.value = str
//     el.setAttribute('readonly', '')
//     el.style.position = 'absolute'
//     el.style.left = '-9999px'
//     document.body.appendChild(el)
//     const selected =
//       document.getSelection().rangeCount > 0
//         ? document.getSelection().getRangeAt(0)
//         : false
//     el.select()
//     const success = document.execCommand('copy')
//     document.body.removeChild(el)
//     if (selected) {
//       document.getSelection().removeAllRanges()
//       document.getSelection().addRange(selected)
//     }
//     return success
//   }

//   const [copied, setCopied] = React.useState(false)

//   const copy = React.useCallback(() => {
//     if (!copied) setCopied(copyToClipboard(text))
//   }, [text])
//   React.useEffect(() => () => setCopied(false), [text])

//   return { copied, copy }
// }

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

/* eslint-disable react/no-array-index-key */
import katex from 'katex'
import { Fragment } from 'react'

const latexify = (string, options) => {
  const regularExpression =
    /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\]|\\\([\s\S]+?\\\)|\$[^$\\]*(?:\\.[^$\\]*)*\$/g
  const blockRegularExpression = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\]/g

  const stripDollars = (stringToStrip) =>
    stringToStrip[0] === '$' && stringToStrip[1] !== '$'
      ? stringToStrip.slice(1, -1)
      : stringToStrip.slice(2, -2)

  const getDisplay = (stringToDisplay) =>
    stringToDisplay.match(blockRegularExpression) ? 'block' : 'inline'

  const renderLatexString = (s, t) => {
    let renderedString
    try {
      const opts = Object.create(options)
      if (t === 'block') opts.displayMode = true

      renderedString = katex.renderToString(s, opts)
    } catch (err) {
      console.error('couldn`t convert string', s)
      return s
    }
    return renderedString
  }

  const result = []

  const latexMatch = string.match(regularExpression)
  const stringWithoutLatex = string.split(regularExpression)

  if (latexMatch) {
    stringWithoutLatex.forEach((s, index) => {
      result.push({
        string: s,
        type: 'text',
      })
      if (latexMatch[index]) {
        result.push({
          string: stripDollars(latexMatch[index]),
          type: getDisplay(latexMatch[index]),
        })
      }
    })
  } else {
    result.push({
      string,
      type: 'text',
    })
  }

  const processResult = (resultToProcess) =>
    resultToProcess.map((r, rootIdx) => {
      if (r.type === 'text') {
        if (options.breakLine) {
          const arr = r.string.split('\n\n')
          return (
            <Fragment key={`breakLine-${rootIdx}`}>
              {arr.map((s, idx) => (
                <Fragment key={`breakLine-${r}-${idx}`}>
                  {s}
                  {idx !== arr.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </Fragment>
          )
        }
        return (
          <Fragment key={`noBreakLine-${r}-${rootIdx}`}>{r.string}</Fragment>
        )
      }
      return (
        <span
          key={`formula-${rootIdx}`}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: renderLatexString(r.string, r.type),
          }}
        />
      )
    })

  return processResult(result)
}

export default latexify

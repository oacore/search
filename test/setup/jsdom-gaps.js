// Browser APIs jsdom does not implement, stubbed deterministically for the dom
// project (40 §2.1). matchMedia: react-slick (via @oacore/design Carousel)
// calls it at import. Plain width conditions are evaluated against
// window.innerWidth (jsdom: 1024); every other media feature does not match.
const evaluate = (query) => {
  const width = window.innerWidth
  return String(query)
    .split(',')
    .some((part) => {
      const conds = part.match(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/g)
      if (
        !conds ||
        part.replace(
          /\((min|max)-width:\s*\d+(?:\.\d+)?px\)|\band\b|screen|all|only|\s/g,
          ''
        ) !== ''
      )
        return false
      return conds.every((c) => {
        const [, kind, px] = c.match(/\((min|max)-width:\s*(\d+(?:\.\d+)?)px\)/)
        return kind === 'min' ? width >= Number(px) : width <= Number(px)
      })
    })
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: evaluate(query),
    media: String(query),
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })
}

module.exports = { evaluate }

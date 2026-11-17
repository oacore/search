// CSS-module transform (40 §2.1): parse the module with postcss and export its
// local names the way css-loader does with Next's `exportLocalsConvention:
// 'asIs'`: each name as written, mapping to itself (CS-CSS-3 removed the
// camelCase patch of next.config.js; camelCase stays exported for T-012).
// Unknown keys are undefined (a plain object, never a proxy). It cannot see the
// build-time no-op behind R-001 (T-605, T-003, T-801 do).
const crypto = require('crypto')

const postcss = require('postcss')

// camelcase 6.2, as bundled in next/dist/compiled/css-loader (used by its
// camelCase convention)
const preserveCamelCase = (input, locale) => {
  let string = input
  let isLastCharLower = false
  let isLastCharUpper = false
  let isLastLastCharUpper = false
  for (let i = 0; i < string.length; i++) {
    const character = string[i]
    if (isLastCharLower && /[\p{Lu}]/u.test(character)) {
      string = `${string.slice(0, i)}-${string.slice(i)}`
      isLastCharLower = false
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper = true
      i++
    } else if (
      isLastCharUpper &&
      isLastLastCharUpper &&
      /[\p{Ll}]/u.test(character)
    ) {
      string = `${string.slice(0, i - 1)}-${string.slice(i - 1)}`
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper = false
      isLastCharLower = true
    } else {
      isLastCharLower =
        character.toLocaleLowerCase(locale) === character &&
        character.toLocaleUpperCase(locale) !== character
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper =
        character.toLocaleUpperCase(locale) === character &&
        character.toLocaleLowerCase(locale) !== character
    }
  }
  return string
}
const postProcess = (input, locale) =>
  input
    .replace(/[_.\- ]+([\p{Alpha}\p{N}_]|$)/gu, (_, identifier) =>
      identifier.toLocaleUpperCase(locale)
    )
    .replace(/\d+([\p{Alpha}\p{N}_]|$)/gu, (m) => m.toLocaleUpperCase(locale))

const camelCase = (input) => {
  let s = input.trim()
  if (s.length === 0) return ''
  if (s.length === 1) return s.toLocaleLowerCase()
  if (s !== s.toLocaleLowerCase()) s = preserveCamelCase(s)
  s = s.replace(/^[_.\- ]+/, '').toLocaleLowerCase()
  return postProcess(s)
}

// local class names and keyframes of a CSS module (`:global(...)` and `:global`
// blocks excluded)
const localNames = (css, from) => {
  const names = []
  const add = (n) => {
    if (!names.includes(n)) names.push(n)
  }
  const root = postcss.parse(css, { from })
  root.walkRules((rule) => {
    if (
      rule.parent &&
      rule.parent.type === 'atrule' &&
      /keyframes$/i.test(rule.parent.name)
    )
      return
    for (const selector of rule.selectors) {
      // drop :global(...) groups and everything after a bare :global
      const local = selector
        .replace(/:global\((?:[^()]|\([^()]*\))*\)/g, ' ')
        .replace(/:global\b[\s\S]*$/, ' ')
      for (const m of local.matchAll(
        /\.(-?[_a-zA-Z\u00A0-\uFFFF][_a-zA-Z0-9\u00A0-\uFFFF-]*)/g
      ))
        add(m[1])
    }
  })
  root.walkAtRules(/keyframes$/i, (at) => {
    const name = at.params.trim()
    if (name && !/^:global/.test(name))
      add(name.replace(/^:local\((.*)\)$/, '$1'))
  })
  return names
}

const exportsFor = (css, from) => {
  const out = {}
  for (const name of localNames(css, from)) out[name] = name
  return out
}

module.exports = {
  process(sourceText, sourcePath) {
    return {
      code: `module.exports = ${JSON.stringify(
        exportsFor(sourceText, sourcePath)
      )};`,
    }
  },
  getCacheKey(sourceText, sourcePath) {
    return crypto
      .createHash('sha256')
      .update('css-module-v2\0')
      .update(sourcePath)
      .update('\0')
      .update(sourceText)
      .digest('hex')
  },
  // exported for T-012
  camelCase,
  localNames,
  exportsFor,
}

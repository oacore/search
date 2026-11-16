import React from 'react'
import PropTypes from 'prop-types'

import utils from './utils'

// React 19 ignores defaultProps on function components: the same defaults are applied here (undefined props only).
const applyDefaults = (props, defaults) => {
  const out = { ...props }
  Object.keys(defaults).forEach((key) => {
    if (out[key] === undefined) out[key] = defaults[key]
  })
  return out
}

const defaultProps = {
  children: null,
  displayMode: false,
  output: 'htmlAndMathml',
  leqno: false,
  fleqn: false,
  throwOnError: true,
  errorColor: '#cc0000',
  minRuleThickness: 0,
  colorIsTextColor: false,
  strict: 'warn',
  trust: false,
  enforceOutput: false,
  breakLine: false,
}

const MathMarkdown = (props) => {
  const { children, ...rest } = applyDefaults(props, defaultProps)

  if (
    !rest.enforceOutput &&
    rest.output === 'mathml' &&
    !utils.hasMathMLSupport()
  )
    rest.output = 'htmlAndMathml'

  if (
    children === null ||
    children === undefined ||
    typeof children !== 'string'
  )
    return <span />

  const renderUs = utils.latexify(children, rest)
  return <span>{renderUs}</span>
}

export default MathMarkdown

MathMarkdown.propTypes = {
  children: PropTypes.string,
  displayMode: PropTypes.bool,
  leqno: PropTypes.bool,
  fleqn: PropTypes.bool,
  throwOnError: PropTypes.bool,
  errorColor: PropTypes.string,
  minRuleThickness: PropTypes.number,
  colorIsTextColor: PropTypes.bool,
  maxSize: PropTypes.number,
  maxExpand: PropTypes.number,
  strict: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.string,
    PropTypes.func,
  ]),
  trust: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),
  output: PropTypes.oneOf(['html', 'mathml', 'htmlAndMathml']),
  enforceOutput: PropTypes.bool,
  breakLine: PropTypes.bool,
}

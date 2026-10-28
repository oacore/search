import React, { forwardRef, useContext } from 'react'
import PropTypes from 'prop-types'

import { Heading } from '../elements'
import Context from './context'

const SectionHeading = forwardRef(
  ({ children, id: forceId, level: forceLevel, ...passProps }, ref) => {
    const parentContext = useContext(Context)
    const level = forceLevel ?? parentContext.level ?? 1
    const id = forceId ?? parentContext.headingId

    return (
      <Heading ref={ref} id={id} level={level} {...passProps}>
        {children}
      </Heading>
    )
  }
)

SectionHeading.propTypes = {
  /**
   * A local level to force the current heading heading level over the one
   * passed via the context from the parent sectioning element.
   *
   * If `null` or no value (`undefined`) is passed, the prop is ignored.
   * Otherwise, it forces the current Heading to use the passed level.
   *
   * In contrast to the forced `level` in the Section, this one impacts
   * only the current heading and will not have effect on nested sections.
   *
   * The prop is created to provide the full control over the component if
   * the automatic system does not work. However, we recommend avoid using it.
   */
  level: PropTypes.oneOf([undefined, null, 1, 2, 3, 4, 5, 6]),
}

export default SectionHeading

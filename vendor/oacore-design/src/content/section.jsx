import React, { forwardRef, useContext } from 'react'
import PropTypes from 'prop-types'

import Context from './context'

const Section = forwardRef(
  (
    { children, id, level: forceLevel, tag: Tag = 'section', ...restProps },
    ref
  ) => {
    const parentContext = useContext(Context)

    const level = forceLevel ?? parentContext.level + 1
    const headingId = `${id}-title`

    const ariaProps = {
      'aria-labelledby': headingId,
    }

    const currentContext = {
      level,
      id,
      headingId,
    }

    return (
      <Tag ref={ref} {...ariaProps} {...restProps}>
        <Context.Provider value={currentContext}>{children}</Context.Provider>
      </Tag>
    )
  }
)

Section.propTypes = {
  /**
   * A section level to force the current section heading level over the one
   * passed via the context.
   *
   * If `null` or no value (`undefined`) is passed, the prop is ignored.
   * Otherwise, it forces descendent Heading to use the passed level.
   *
   * Be aware, forcing the section level impacts not only the current section
   * heading but all descendent sections too.
   *
   * The prop is created to provide the full control over the component if
   * the automatic system does not work. However, we recommend avoid using it.
   */
  level: PropTypes.oneOf([undefined, null, 1, 2, 3, 4, 5, 6]),
}

export default Section

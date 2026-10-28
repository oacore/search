import PropTypes from 'prop-types'
import { forwardRef } from 'react'

import Icon from '../icon'
import styles from './link.css'

/**
 * The BaseLink component reflects WHATWG <a> element specification,
 * i.e. removes extra attributes if there is no href passed.
 *
 * See more: https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element
 */
const BaseLink = forwardRef(
  (
    {
      children,
      href,
      target,
      download,
      ping,
      rel,
      hrefLang,
      type,
      referrerPolicy,
      itemProp,
      ...restProps
    },
    ref
  ) => {
    const linkProps = {
      href,
      target,
      download,
      ping,
      rel,
      hrefLang,
      type,
      referrerPolicy,
      itemProp,
    }

    const props = {
      ...(href == null ? {} : linkProps),
      ...restProps,
    }

    return (
      <a ref={ref} {...props}>
        {children}
      </a>
    )
  }
)

const StyledLink = forwardRef(
  ({ children, external = false, icon = external, ...restProps }, ref) => {
    const ownProps = {}

    if (external) {
      ownProps.target = '_blank'
      ownProps.rel = 'noopener noreferrer'
    }

    return (
      <BaseLink ref={ref} {...ownProps} {...restProps}>
        {children}
        {external && icon && (
          <Icon className={styles.icon} src="#open-in-new" aria-hidden />
        )}
      </BaseLink>
    )
  }
)

StyledLink.propTypes = {
  href: PropTypes.string,

  /**
   * Indicates whether link is external or not.
   *
   * External links contain additional icon and add additional attributes to
   * the link: `target="_blank" rel="noopener noreferrer"`.
   * See more: [Links to cross-origin destinations are
   * unsafe](https://web.dev/external-anchors-use-rel-noopener/).
   */
  external: PropTypes.bool,
  /**
   * Indicates whether the external icon should be shown or not.
   * Applies only when link is external and its default
   * reflects external prop.
   */
  icon: PropTypes.bool,
}

export default StyledLink
export { BaseLink, StyledLink }

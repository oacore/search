import PropTypes from 'prop-types'

import iconClassNames from './icon.css'
import config from '../../config'
import { classNames } from '../../utils'

const resolve = (url) =>
  config.iconsPublicPath != null && url && url.toString().charAt() === '#'
    ? `${config.iconsPublicPath}${url}`
    : url

/**
 * The component creates an inline SVG image based on
 * `src` and `alt` attributes.
 */
const Icon = ({ src, alt, className, ...restProps }) => (
  <svg
    className={classNames.use(iconClassNames.icon).join(className)}
    role="img"
    aria-label={alt}
    width="24"
    height="24"
    {...restProps}
  >
    <use href={resolve(src)} />
  </svg>
)

Icon.propTypes = {
  /**
   * Icon location
   *
   * It can be either an icon reference to a sprite, e.g. `#alert`
   * or full icon path for any other icon.
   */
  src: PropTypes.string.isRequired,
  /**
   * Alternative text for accessibility
   */
  alt: PropTypes.string,
}

export default Icon

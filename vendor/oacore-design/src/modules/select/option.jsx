import { memo } from 'react'
import PropTypes from 'prop-types'

import styles from './select.css'
import { Icon } from '../../elements'
import { classNames } from '../../utils'

const Option = memo(
  ({ id, children, selected, icon, className, customValue, ...restProps }) => (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className={classNames
        .use({
          [styles.option]: true,
          [styles.optionSelected]: selected,
        })
        .join(className)}
      tabIndex="-1"
      {...restProps}
    >
      {icon && (
        <span className={styles.optionIcon}>
          <Icon src={icon} />
        </span>
      )}
      <span className={styles.optionValue}>{children}</span>
    </li>
  )
)

Option.displayName = 'SelectOption'

Option.propTypes = {
  /* Unique ID of option */
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /* Custom classname applied on option */
  className: PropTypes.string,
  /* Icon to prepend before option value */
  icon: PropTypes.string,
  /* Indicates whether option is selected or not. This props gets overridden
   * by select component
   */
  selected: PropTypes.bool,
  /* Use this prop for clean select */
  customValue: PropTypes.bool,
}

export default Option

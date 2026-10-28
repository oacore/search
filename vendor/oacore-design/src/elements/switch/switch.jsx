/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react'
import PropTypes from 'prop-types'

import styles from './switch.css'
import { classNames } from '../../utils'

const Switch = ({
  variant = 'normal',
  id,
  name = id,
  checked,
  onChange,
  // eslint-disable-next-line react/prop-types
  nonActive = false,
  label,
  className,
  ...props
}) => {
  const useStyles = (defaultClass) =>
    classNames.use(defaultClass, {
      [styles[variant]]: variant,
    })

  return (
    <div className={classNames.use(styles.container).join(className)}>
      <input
        name={name}
        onChange={onChange}
        type="checkbox"
        checked={checked}
        id={id}
        className={useStyles(styles.checkbox)}
        {...props}
      />
      <label
        className={classNames.use(useStyles(styles.box), {
          [styles.active]: checked,
          [styles.nonActive]: nonActive,
        })}
        htmlFor={name}
      >
        <span className={useStyles(styles.button)} />
      </label>

      {label && <div className={useStyles(styles.label)}>{label}</div>}
    </div>
  )
}

Switch.propTypes = {
  id: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  name: PropTypes.string,
  variant: PropTypes.oneOf(['normal', 'small', 'big']),
}
export default Switch

import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

const progressValues = (value, max, { radius = 9 } = {}) => {
  if (value == null) return null

  const length = Math.round(2 * Math.PI * radius)
  const filled = Math.min(Math.round((value / max) * length), length)
  const empty = length - filled
  return [filled, empty].join(' ')
}

const ProgressSpinner = forwardRef(
  ({ children, className, value, max = 1.0, ...htmlProps }, ref) => (
    <svg
      ref={ref}
      className={classNames
        .use(styles.spinner, value == null && styles.indeterminate)
        .join(className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...htmlProps}
    >
      <circle
        strokeWidth="2"
        strokeLinecap="butt"
        strokeDasharray={progressValues(value, max)}
        cx="12"
        cy="12"
        r="9"
      />
      {children}
    </svg>
  )
)

export default ProgressSpinner

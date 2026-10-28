import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

const FormControl = forwardRef(
  (
    { type: controlType, children, className, focus, value, ...htmlProps },
    ref
  ) => {
    const Tag = ['select', 'textarea'].includes(controlType)
      ? controlType
      : 'input'
    const type = Tag === 'input' ? controlType : undefined

    return (
      <Tag
        ref={ref}
        type={type}
        value={value}
        className={classNames
          .use(styles.control, (focus || value) && styles.focus)
          .join(className)}
        {...htmlProps}
      >
        {children}
      </Tag>
    )
  }
)

export default FormControl

import React from 'react'
import { Select as UISelect } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Select = ({ children, className, ...passProps }) => (
  <UISelect
    className={classNames.use(styles.select, className).toString()}
    {...passProps}
  >
    {children}
  </UISelect>
)

Select.Option = UISelect.Option

export default Select

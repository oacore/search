import React from 'react'

import styles from './group.css'
import { classNames } from '../../utils'

const LogoGroup = ({ children, className }) => (
  <div className={classNames.use(styles.group).join(className)}>{children}</div>
)

export default LogoGroup

import React from 'react'
import { Card } from '@oacore/design'

import styles from './styles.module.css'

const RegistrationLayout = ({ children, tag: Tag = Card }) => (
  <Tag className={styles.layout}>{children}</Tag>
)

export default RegistrationLayout

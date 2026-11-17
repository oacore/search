import React from 'react'

import styles from './styles.module.css'

const Notification = ({ text }: any) => (
  <span className={styles.notification}>{text}</span>
)

export default Notification

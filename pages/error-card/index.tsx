import React from 'react'
import { Button } from '@oacore/design/lib'

import broken from '../../public/static/images/errorCard.svg'
import styles from './styles.module.css'

const ErrorCard = () => (
  <div className={styles['container-inner']}>
    <img src={broken} alt="img" />
    <h3 className={styles['error-title']}>
      This page is not available now. Try again in a few minutes.
    </h3>
    <span className={styles['error-description']}>
      Our team is already working to resolve this issue as soon as possible.
    </span>
    <Button variant="contained" href="/">
      Try again
    </Button>
  </div>
)
export default ErrorCard

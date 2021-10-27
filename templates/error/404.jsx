import React from 'react'
import { Button } from '@oacore/design'

import styles from './404.module.css'

import Loader from 'modules/loader'

const Error404 = ({ errorStatus }) => {
  if (!errorStatus) return <Loader />

  return (
    <article className={styles.errorContainer}>
      <section className={styles.error}>
        <h1>Uh-oh</h1>
        <p>{errorStatus.message}</p>
        <div className={styles.buttons}>
          <Button variant="contained" href="/" tag="a">
            Go to homepage
          </Button>
          <Button variant="outlined" href="/contact" tag="a">
            Contact us
          </Button>
        </div>
      </section>
    </article>
  )
}

export default Error404

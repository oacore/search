import React from 'react'
import { Button } from '@oacore/design'

import styles from './styles.module.css'

import Loader from 'modules/loader'

const Error404 = ({ error }) => {
  if (!error) return <Loader />

  return (
    <article className={styles.errorContainer}>
      <section className={styles.error}>
        <h1>Uh-oh</h1>
        <p>{error.message}</p>
        <div className={styles.buttons}>
          <Button
            variant="contained"
            href={error.prevHistoryUrl || '/'}
            tag="a"
          >
            {error.prevHistoryUrl ? 'Go back' : 'Go to homepage'}
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

import React from 'react'
import { Button } from '@oacore/design'

import styles from './404.module.css'

import Loader from 'modules/loader/loader'

const Error404 = ({ articleId, status }) => {
  if (!status) return <Loader />

  return (
    <article className={styles.errorContainer}>
      <section className={styles.error}>
        <h1>Uh-oh</h1>
        {articleId && status === 410 ? (
          <p>The article with ID {articleId} has been disabled.</p>
        ) : (
          <p>The page you were looking for could not be found.</p>
        )}
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

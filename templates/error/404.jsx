import React from 'react'
import { useRouter } from 'next/router'
import { Button } from '@oacore/design'

import styles from './404.module.css'

const Error404 = ({ status }) => {
  const router = useRouter()

  const { id: articleId } = router.query

  return (
    <article className={styles.errorContainer}>
      <section className={styles.error}>
        <h1>Uh-oh</h1>
        {articleId && status === 410 ? (
          <p>The article with id:{articleId} has been disabled.</p>
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

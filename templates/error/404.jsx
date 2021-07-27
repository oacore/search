import React from 'react'
import { useRouter } from 'next/router'
import { Button } from '@oacore/design'

import styles from './404.module.css'

const Error404 = () => {
  const router = useRouter()
  const { id } = router.query

  return (
    <article>
      <h1>Uh-oh</h1>
      <section>
        <p>The article with id:{id} does not exists.</p>
        <div className={styles.buttons}>
          <Button variant="contained" href="/" tag="a">
            Go to homepage
          </Button>
        </div>
      </section>
    </article>
  )
}

export default Error404

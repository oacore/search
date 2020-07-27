import { Message, Button } from '@oacore/design'
import React from 'react'
import Link from 'next/link'

import styles from './styles.module.css'

const SuccessMessage = ({ oaiPmhUrl }) => (
  <>
    <Message className={styles.message} variant="success">
      Data provider {oaiPmhUrl} has been successfully added to our DB. The
      harvesting process will start soon.
    </Message>
    <Link href="/data-providers/data-provider">
      <Button className={styles.resetButton} variant="contained">
        Add another data provider
      </Button>
    </Link>
  </>
)

export default SuccessMessage

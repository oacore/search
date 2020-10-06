import React from 'react'
import { Card, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimCard = ({ name }) => (
  <Card className={classNames.use(styles.card, styles.claimCard)}>
    <div>
      <b>Are you {name}&apos;s manager?</b> Access insider analytics, issue
      reports and manage access to documents from your repository in the CORE
      Dashboard! 👇
    </div>
    <div className={styles.claimCardActions}>
      <Button variant="contained" className={styles.claimCardAction} disabled>
        Gain access now
      </Button>
      <Button className={styles.claimCardAction} disabled>
        More details
      </Button>
    </div>
  </Card>
)

export default ClaimCard

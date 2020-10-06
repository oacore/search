import React from 'react'
import { Card, Button } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ClaimCard = ({ name }) => (
  <Card tag="section" className={classNames.use(styles.card, styles.claimCard)}>
    <div>
      <b>Do you manage {name}?</b> Access insider analytics, issue reports and
      manage access to outputs from your repository in
      the&nbsp;CORE&nbsp;Dashboard!&nbsp;
      <span aria-hidden="true" role="img">
        👇
      </span>
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

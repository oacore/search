import { Card } from '@oacore/design'
import React from 'react'

import styles from './styles.module.css'

import CopyableInput from 'modules/copyable-input'

const ApiCard = () => (
  <Card className={styles.card}>
    <Card.Title>Explore CORE API</Card.Title>
    Access this scientific work through our open API at api.core.ac.uk/v3
    <CopyableInput
      id="endpoint"
      value="curl https://api.core.ac.uk/v3/works..."
    />
  </Card>
)

export default ApiCard

import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Map from 'modules/map'

const MapCard = ({ metadata }) => (
  <Card variant="outlined" className={classNames.use(styles.card)}>
    <Map
      className={styles.map}
      locations={[
        {
          name: metadata.name,
          latitude: metadata.location?.latitude,
          longitude: metadata.location?.longitude,
        },
      ]}
      zoom={10}
    />
    <p>
      This paper was published in <b>{metadata.name}</b>.
    </p>
  </Card>
)

export default MapCard

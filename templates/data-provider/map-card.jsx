import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Map from 'modules/map'

const MapCard = ({ metadata }) => (
  <Card className={classNames.use(styles.card, styles.mapCard)}>
    <Map
      className={styles.map}
      locations={[
        {
          name: metadata.name,
          latitude: metadata.location?.latitude,
          longitude: metadata.location?.longitude,
        },
      ]}
    />
    <div>{metadata.name}</div>
  </Card>
)

export default MapCard

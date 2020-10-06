import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Map from 'modules/map'

const MapCard = ({
  children,
  className,
  name,
  latitude,
  longitude,
  ...restProps
}) => (
  <Card
    className={classNames.use(styles.card, styles.mapCard).join(className)}
    tag="figure"
    {...restProps}
  >
    <Map className={styles.map} locations={[{ name, latitude, longitude }]} />
    <figcaption className={styles.mapCaption}>{children}</figcaption>
  </Card>
)

export default MapCard

import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Map from 'modules/map'

const isCoordinate = (value) =>
  value !== null && value !== '' && Number.isFinite(Number(value))

const MapCard = ({ metadata }) => {
  const latitude = metadata.location?.latitude
  const longitude = metadata.location?.longitude
  // Providers without a location would crash Leaflet (Invalid LatLng)
  const hasLocation = isCoordinate(latitude) && isCoordinate(longitude)

  return (
    <Card variant="outlined" className={classNames.use(styles.card)}>
      {hasLocation && (
        <Map
          className={styles.map}
          locations={[{ name: metadata.name, latitude, longitude }]}
          zoom={10}
        />
      )}
      <p>
        This paper was published in{' '}
        <a href={metadata.hrefDataProvider} target="_blank" rel="noreferrer">
          <b>{metadata.name}</b>
        </a>
        .
      </p>
    </Card>
  )
}

export default MapCard

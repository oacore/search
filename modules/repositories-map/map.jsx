import React, { useRef, useEffect } from 'react'
import L from 'leaflet'
import { MarkerClusterGroup } from 'leaflet.markercluster'

import styles from './styles.module.css'

import { getAssetsPath } from 'utils/helpers'

// somewhere in the middle of North Atlantic ocean
const centerPosition = new L.LatLng(26.523257520856546, -43.10211013159716)

const markerIcon = L.icon({
  iconUrl: getAssetsPath('/static/map/marker.svg'),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const CustomMap = ({ dataProviders }) => {
  const mapContainerRef = useRef(null)
  const map = useRef(null)

  useEffect(() => {
    const coverLayer = L.tileLayer(
      'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '<a href="https://wikimediafoundation.org/wiki/Maps_Terms_of_Use">Wikimedia</a>',
        minZoom: 2,
        maxZoom: 12,
      }
    )

    map.current = L.map(mapContainerRef.current, {
      center: centerPosition,
      zoom: 2,
      maxBounds: [
        [-90, -180],
        [90, 180],
      ],
      layers: [coverLayer],
      scrollWheelZoom: false,
    })
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    const markers = new MarkerClusterGroup({
      chunkedLoading: true,
      icon: markerIcon,
    })

    dataProviders
      .filter(
        ({ name, repositoryLocation }) =>
          repositoryLocation != null &&
          repositoryLocation.latitude != null &&
          repositoryLocation.longitude != null &&
          name
      )
      .forEach(({ name, repositoryLocation }) => {
        const marker = L.marker(
          new L.LatLng(
            repositoryLocation.latitude,
            repositoryLocation.longitude
          ),
          {
            title: name,
            icon: markerIcon,
          }
        )
        marker.bindPopup(name)
        markers.addLayer(marker)
      })

    map.current.addLayer(markers)
    return () => map.current.removeLayer(markers)
  }, [dataProviders])

  return <div ref={mapContainerRef} className={styles.map} />
}

export default CustomMap

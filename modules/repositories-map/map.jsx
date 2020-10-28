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
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: `
          <a href="https://www.openstreetmap.org">OpenStreetMap</a> under
          <a href="https://creativecommons.org/licenses/by-sa/2.0">CC-BY-SA</a>
        `,
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
        ({ name, dataProviderLocation }) =>
          dataProviderLocation != null &&
          dataProviderLocation.latitude != null &&
          dataProviderLocation.longitude != null &&
          name
      )
      .forEach(({ id, name, dataProviderLocation }) => {
        const marker = L.marker(
          new L.LatLng(
            dataProviderLocation.latitude,
            dataProviderLocation.longitude
          ),
          {
            title: name,
            icon: markerIcon,
          }
        )
        marker.bindPopup(
          `<a
               href="https://core.ac.uk/search?q=repositories.id:(${id})"
               target="_blank"
               rel="noopener noreferrer"
           >
            ${name}
           </a>`
        )
        markers.addLayer(marker)
      })

    map.current.addLayer(markers)
    return () => map.current.removeLayer(markers)
  }, [dataProviders])

  return <div ref={mapContainerRef} className={styles.map} />
}

export default CustomMap

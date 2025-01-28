import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

import 'leaflet.markercluster'
import styles from './styles.module.css'

import { getAssetsPath } from 'utils/helpers'

const centerPosition = new L.LatLng(26.523257520856546, -43.10211013159716)

const markerIcon = L.icon({
  iconUrl: getAssetsPath('/static/images/map/marker.svg'),
  iconSize: [18, 18],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const CustomMap = ({ locations }) => {
  const mapRef = useRef(null)
  const markerClusterGroupRef = useRef(null)

  // Initialize the map only once
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map', {
        center: centerPosition,
        zoom: 2,
        minZoom: 1,
        maxZoom: 12,
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        ],
      })

      markerClusterGroupRef.current = new L.MarkerClusterGroup()
      mapRef.current.addLayer(markerClusterGroupRef.current)
    }
  }, [])

  // Update markers when locations change
  useEffect(() => {
    if (markerClusterGroupRef.current) {
      markerClusterGroupRef.current.clearLayers()
      locations.forEach(({ name, href, latitude, longitude }) => {
        const marker = L.marker([latitude, longitude], {
          icon: markerIcon,
        }).bindPopup(
          href ? `<a href=${href} target="_blank">${name}</a>` : name
        )
        markerClusterGroupRef.current.addLayer(marker)
      })
    }
  }, [locations])

  return <div id="map" className={styles.map} />
}

export default CustomMap

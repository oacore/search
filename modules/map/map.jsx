import React, { useRef, useEffect } from 'react'
import L from 'leaflet'

import styles from './styles.module.css'

import { getAssetsPath } from 'utils/helpers'

// somewhere in the middle of North Atlantic ocean
const centerPosition = new L.LatLng(26.523257520856546, -43.10211013159716)

const markerIcon = L.icon({
  iconUrl: getAssetsPath('/static/images/map/marker.svg'),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const CustomMap = ({ locations }) => {
  const markersData = locations

  const mapRef = useRef(null)

  useEffect(() => {
    // Initialize the map
    if (!mapRef.current) {
      mapRef.current = L.map('map', {
        center: [50, 10], // Default center of the map
        zoom: 3, // Default zoom level
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        ],
      })
    }

    // Create and add markers
    const markers = markersData.map((markerData) => {
      const { name, href, latitude, longitude } = markerData
      const latLng = new L.LatLng(latitude, longitude)
      const marker = L.marker(latLng).addTo(mapRef.current)
      if (href) {
        marker.bindPopup(
          `<a
               href=${href}
               target="_blank"
               rel="noopener noreferrer"
           >
            ${name}
           </a>`
        )
      } else marker.bindPopup(name)

      // marker.bindPopup(name);
      return marker
    })

    return () => {
      // Cleanup the map and markers
      markers.forEach((marker) => marker.remove())
      mapRef.current.remove()
      mapRef.current = null
    }
  }, [markersData])

  return <div id="map" style={{ height: '100vh', width: '100%' }} />
}

export default CustomMap

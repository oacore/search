import React, { useRef, useEffect } from 'react'
import L from 'leaflet'

import { getAssetsPath } from 'utils/helpers'

// const centerPosition = new L.LatLng(26.523257520856546, -43.10211013159716)
const centerPosition = new L.LatLng(50, 10)

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
        center: centerPosition,
        zoom: 7,
        minZoom: 1,
        maxZoom: 12,
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
      const marker = L.marker(latLng, {
        title: name,
        icon: markerIcon,
      }).addTo(mapRef.current)
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

  return <div id="map" style={{ height: '40vh', width: '100%' }} />
}

export default CustomMap

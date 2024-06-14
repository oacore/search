import React, { useRef, useEffect, useState } from 'react'
import L from 'leaflet'

import 'leaflet.markercluster'
import styles from './styles.module.css'

import { getAssetsPath } from 'utils/helpers'

const KEY_MOVE = 'moveend'

const centerPosition = new L.LatLng(26.523257520856546, -43.10211013159716)

const markerIcon = L.icon({
  iconUrl: getAssetsPath('/static/images/map/marker.svg'),
  iconSize: [18, 18],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const CustomMap = ({ locations }) => {
  const [visibleMarkers, setVisibleMarkers] = useState([])
  // const [mapLoaded, setMapLoaded] = useState(false)

  const mapRef = useRef(null)

  const loadVisibleMarkers = () => {
    const bounds = mapRef.current.getBounds()
    const inViewMarkers = locations.filter((loc) =>
      bounds.contains(new L.LatLng(loc.latitude, loc.longitude))
    )
    setVisibleMarkers(inViewMarkers)
  }

  useEffect(() => {
    // Initialize the map
    if (locations.length > 0 && !mapRef.current) {
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
      // Handle map movements to load new markers
      mapRef.current.on(KEY_MOVE, loadVisibleMarkers)
    }

    // Initialize marker cluster group
    const markerClusterGroup = new L.MarkerClusterGroup()
    mapRef.current.addLayer(markerClusterGroup)

    return () => {
      // Cleanup the map and markers
      mapRef.current.off(KEY_MOVE, loadVisibleMarkers)
      mapRef.current.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const markerClusterGroup = new L.MarkerClusterGroup()
    // Create and add markers
    visibleMarkers.forEach(({ name, href, latitude, longitude }) => {
      const marker = L.marker([latitude, longitude], {
        icon: markerIcon,
      }).bindPopup(href ? `<a href=${href} target="_blank">${name}</a>` : name)
      markerClusterGroup.addLayer(marker)
    })

    mapRef.current.addLayer(markerClusterGroup)

    return () => markerClusterGroup.clearLayers()
  }, [visibleMarkers])

  return <div id="map" className={styles.map} />
}

export default CustomMap

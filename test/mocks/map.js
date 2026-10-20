// modules/map/map stub (40 §2.1): Leaflet needs a real layout engine; T-414
// tests the real map.
const React = require('react')

const MapStub = ({ locations }) =>
  React.createElement('div', {
    'data-testid': 'map-stub',
    'data-markers': Array.isArray(locations) ? locations.length : undefined,
  })

module.exports = { __esModule: true, default: MapStub }

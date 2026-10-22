// T-414 (41 E, R-047): the repositories map with the real Leaflet 1.9 and
// leaflet.markercluster in jsdom (modules/map/map.jsx; the harness stub of
// `modules/map/map` is switched off for this file). Q-058: c1 zero locations
// is a TypeError at the `addLayer` of a map that was never created, c3 the
// `zoom` prop is ignored, c4 the popup link is built as an unquoted attribute.
//
// jsdom has no layout, so the container reports 1000 x 500 px (Leaflet reads
// clientWidth and clientHeight); at the fixed zoom 2 that view spans latitudes
// -51.6..74.8 and longitudes -219.0..132.5 around the fixed centre. The map
// instance is read from the return value of `L.map`; markers and clusters are
// read from the DOM Leaflet draws; the string given to `bindPopup` is read at
// the call.
import React from 'react'
import L from 'leaflet'

import { render, act, fireEvent, waitFor, within } from '../../../utils/render'

jest.unmock('../../../../modules/map/map')
const CustomMap = require('../../../../modules/map/map').default
const RepositoriesMap = require('../../../../modules/map').default

// the constants of map.jsx:11,35-46
const CENTER = { lat: 26.523257520856546, lng: -43.10211013159716 }
const TILE_URL =
  /^https:\/\/[abc]\.tile\.openstreetmap\.org\/(\d+)\/\d+\/\d+\.png$/

const size = { width: 1000, height: 500 }
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return size.width
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return size.height
    },
  })
})
afterAll(() => {
  delete HTMLElement.prototype.clientWidth
  delete HTMLElement.prototype.clientHeight
})

let mapSpy
let popupSpy
let errorSpy
beforeEach(() => {
  mapSpy = jest.spyOn(L, 'map')
  popupSpy = jest.spyOn(L.Layer.prototype, 'bindPopup')
})
afterEach(() => {
  jest.restoreAllMocks()
  errorSpy = undefined
})

// React and jsdom report an error thrown in an effect on the console
const quiet = () => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
}

const lastMap = () => mapSpy.mock.results[mapSpy.mock.results.length - 1].value

const place = (name, latitude, longitude, href) => ({
  name,
  href,
  latitude,
  longitude,
})

// 25 markers 55 degrees of longitude (about 156 px) and 22 to 38 degrees of
// latitude (110 px) apart, all inside the view, so none of them is clustered
// at zoom 2 (the cluster radius is 80 px) ...
const COLUMNS = [-110, -55, 0, 55, 110]
const ROWS = [69.9, 51.62, 21.29, -16.64, -48.46]
const spread = () =>
  ROWS.flatMap((lat, r) =>
    COLUMNS.map((lng, c) =>
      place(`P${r}${c}`, lat, lng, `/data-providers/${100 + r * 5 + c}`)
    )
  )
// ... and 5 markers within 0.04 degrees of each other
const group = () =>
  [0, 1, 2, 3, 4].map((i) =>
    place(`G${i}`, 30 + i * 0.01, -175 + i * 0.01, `/data-providers/${200 + i}`)
  )

const singles = (container) => [
  ...container.querySelectorAll('img.leaflet-marker-icon'),
]
const clusters = (container) => [
  ...container.querySelectorAll('div.marker-cluster'),
]
const clusterCounts = (container) =>
  clusters(container)
    .map((c) => Number(c.textContent))
    .sort((a, b) => a - b)
const tileLevels = (container) =>
  [...container.querySelectorAll('img.leaflet-tile')].map((t) =>
    Number(t.getAttribute('src').match(TILE_URL)[1])
  )

const mount = (locations, props = {}) => {
  const view = render(<CustomMap locations={locations} {...props} />)
  return { view, map: lastMap(), container: view.container }
}

describe('T-414 @P1 map', () => {
  describe('T-414 c1 @P1 0, 1 and 30 locations (Q-058 c1)', () => {
    test('T-414 c1 @P1 Q-058 c1 0 locations: the mount throws a TypeError from addLayer of null; no Leaflet map is created and nothing stays in the page', () => {
      quiet()
      let error
      try {
        render(<CustomMap locations={[]} />)
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(TypeError)
      expect(error.message).toMatch(/null.*addLayer|addLayer.*null/)
      // thrown by map.jsx, the effect that adds the cluster group (map.jsx:53)
      expect(error.stack).toContain('modules/map/map.jsx')
      expect(mapSpy).not.toHaveBeenCalled()
      expect(document.getElementById('map')).toBeNull()
      expect(document.querySelector('.leaflet-container')).toBeNull()
      // the error leaves React: both reports of jsdom and both of React
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0)
    })

    test('T-414 c1 @P1 Q-058 c1 the throw happens for any empty list, also when `locations` is an empty array of a real page', () => {
      quiet()
      for (const locations of [[], Array.from({ length: 0 })]) {
        expect(() => render(<CustomMap locations={locations} />)).toThrow(
          TypeError
        )
      }
      expect(mapSpy).not.toHaveBeenCalled()
    })

    test('T-414 c1 @P1 1 location: one Leaflet map on #map with the fixed options, one marker, no cluster', () => {
      const { map, container } = mount([
        place('Birkbeck', 51.52, -0.13, '/data-providers/8'),
      ])
      expect(mapSpy).toHaveBeenCalledTimes(1)
      const [target, options] = mapSpy.mock.calls[0]
      expect(target).toBe('map')
      expect(Object.keys(options).sort()).toEqual([
        'center',
        'layers',
        'maxZoom',
        'minZoom',
        'zoom',
      ])
      expect(options.zoom).toBe(2)
      expect(options.minZoom).toBe(1)
      expect(options.maxZoom).toBe(12)
      expect(options.center.lat).toBe(CENTER.lat)
      expect(options.center.lng).toBe(CENTER.lng)
      expect(options.layers).toHaveLength(1)

      const el = container.querySelector('#map')
      expect(el).not.toBeNull()
      expect(el.className.split(' ')).toEqual(
        expect.arrayContaining(['map', 'leaflet-container'])
      )
      expect(map.getContainer()).toBe(el)
      expect(map.getMinZoom()).toBe(1)
      expect(map.getMaxZoom()).toBe(12)

      const markers = singles(container)
      expect(markers).toHaveLength(1)
      const [marker] = markers
      expect(marker.getAttribute('src')).toMatch(
        /\/static\/images\/map\/marker\.svg$/
      )
      expect(marker.getAttribute('alt')).toBe('Marker')
      expect(marker.getAttribute('role')).toBe('button')
      expect(marker.style.width).toBe('18px')
      expect(marker.style.height).toBe('18px')
      // iconAnchor [16, 32]
      expect(marker.style.marginLeft).toBe('-16px')
      expect(marker.style.marginTop).toBe('-32px')
      expect(clusters(container)).toHaveLength(0)
      expect(popupSpy).toHaveBeenCalledTimes(1)
    })

    test('T-414 c1 @P1 1 location: tiles from openstreetmap at zoom 2, the OpenStreetMap attribution and the zoom control', () => {
      const { container } = mount([place('A', 51.52, -0.13)])
      const levels = tileLevels(container)
      expect(levels.length).toBeGreaterThan(0)
      expect(new Set(levels)).toEqual(new Set([2]))
      const attribution = container.querySelector(
        '.leaflet-control-attribution'
      )
      const link = attribution.querySelector(
        'a[href="https://www.openstreetmap.org/copyright"]'
      )
      expect(link.textContent).toBe('OpenStreetMap')
      expect(attribution.textContent).toContain('OpenStreetMap contributors')
      expect(
        within(container).getByRole('button', { name: 'Zoom in' })
      ).toBeTruthy()
      expect(
        within(container).getByRole('button', { name: 'Zoom out' })
      ).toBeTruthy()
    })

    test('T-414 c1 @P1 30 locations: 25 markers and one cluster of 5, every location drawn once, a popup bound for each', () => {
      const locations = [...spread(), ...group()]
      expect(locations).toHaveLength(30)
      const { container } = mount(locations)
      expect(singles(container)).toHaveLength(25)
      expect(clusterCounts(container)).toEqual([5])
      const [cluster] = clusters(container)
      expect(cluster.className).toContain('marker-cluster-small')
      // 25 markers + the 5 inside the cluster
      expect(
        singles(container).length +
          clusterCounts(container).reduce((a, b) => a + b, 0)
      ).toBe(30)
      expect(popupSpy).toHaveBeenCalledTimes(30)
      expect(mapSpy).toHaveBeenCalledTimes(1)
    })

    test('T-414 c1 @P1 30 locations on top of each other: one cluster counting 30, no marker', () => {
      const same = Array.from({ length: 30 }, (_, i) =>
        place(`S${i}`, 48.85 + i * 0.001, 2.35, `/data-providers/${i}`)
      )
      const { container } = mount(same)
      expect(singles(container)).toHaveLength(0)
      expect(clusterCounts(container)).toEqual([30])
    })

    test('T-414 c1 @P1 only the locations inside the view at mount are drawn; the others are neither markers nor in a cluster', () => {
      const inside = spread()
      const outside = [
        place('East', 20, 150, '/data-providers/301'),
        place('North', 80, -40, '/data-providers/302'),
        place('West', 0, -230, '/data-providers/303'),
      ]
      const { map, container } = mount([...inside, ...outside])
      const bounds = map.getBounds()
      expect(bounds.getEast()).toBeCloseTo(132.5, 0)
      expect(bounds.getWest()).toBeCloseTo(-219, 0)
      expect(bounds.getNorth()).toBeCloseTo(74.8, 0)
      expect(bounds.getSouth()).toBeCloseTo(-51.6, 0)
      expect(singles(container)).toHaveLength(25)
      expect(clusters(container)).toHaveLength(0)
      // a popup is bound only for the markers that are created
      expect(popupSpy).toHaveBeenCalledTimes(25)
    })

    test('T-414 c1 @P1 a move of the view draws the markers of the new view (moveend): new markers for the 4 columns now inside plus the one in the east, none re-used', () => {
      const east = place('East', 20, 150, '/data-providers/301')
      const { map, container } = mount([...spread(), east])
      expect(singles(container)).toHaveLength(25)
      expect(popupSpy).toHaveBeenCalledTimes(25)
      act(() => {
        map.setView([20, 100], 2, { animate: false })
      })
      // the view now spans longitudes -75.9..275.6: the column at -110 is
      // outside, the east marker inside; the old markers are cleared
      expect(map.getBounds().getWest()).toBeCloseTo(-75.9, 1)
      expect(map.getBounds().getEast()).toBeCloseTo(275.6, 1)
      expect(singles(container)).toHaveLength(21)
      expect(clusters(container)).toHaveLength(0)
      expect(popupSpy).toHaveBeenCalledTimes(25 + 21)
      expect(
        popupSpy.mock.calls.filter(([html]) => html.includes('>East<'))
      ).toHaveLength(1)
    })

    test('T-414 c1 @P1 locations are read at mount: a new `locations` prop does not move or add anything', () => {
      const first = [place('One', 51.52, -0.13, '/data-providers/1')]
      const { view, container } = mount(first)
      expect(singles(container)).toHaveLength(1)
      view.rerender(
        <CustomMap
          locations={[
            place('Two', 10, 10, '/data-providers/2'),
            place('Three', 20, 20, '/data-providers/3'),
          ]}
        />
      )
      expect(singles(container)).toHaveLength(1)
      expect(popupSpy).toHaveBeenCalledTimes(1)
      expect(mapSpy).toHaveBeenCalledTimes(1)
    })

    test('T-414 c1 @P1 unmount removes the map, empties the container and does not throw', () => {
      const { view, map, container } = mount([place('A', 51.52, -0.13)])
      const el = container.querySelector('#map')
      expect(map.getContainer()).toBe(el)
      expect(() => view.unmount()).not.toThrow()
      expect(document.getElementById('map')).toBeNull()
      // Leaflet detached its panes
      expect(el.querySelector('.leaflet-pane')).toBeNull()
      expect(el.children).toHaveLength(0)
    })

    test('T-414 c1 @P1 Q-058 c2 a location without coordinates throws "Invalid LatLng" while the view is read (blank page, T-730)', () => {
      quiet()
      let error
      try {
        render(
          <CustomMap
            locations={[
              { name: 'A', latitude: undefined, longitude: undefined },
            ]}
          />
        )
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe(
        'Invalid LatLng object: (undefined, undefined)'
      )
      expect(mapSpy).toHaveBeenCalledTimes(1)
      expect(document.getElementById('map')).toBeNull()
    })

    test('T-414 c1 @P1 the lazily loaded wrapper renders its own container with the className and then the map', async () => {
      const view = render(
        <RepositoriesMap
          className="extra"
          locations={[place('A', 51.52, -0.13, '/data-providers/1')]}
        />
      )
      const wrapper = view.container.firstChild
      expect(wrapper.tagName).toBe('DIV')
      expect(wrapper.className.split(' ')).toEqual(['container', 'extra'])
      await waitFor(() =>
        expect(view.container.querySelector('#map')).not.toBeNull()
      )
      expect(wrapper.contains(view.container.querySelector('#map'))).toBe(true)
      expect(singles(view.container)).toHaveLength(1)
    })
  })

  describe('T-414 c2 @P1 zoom is ignored (Q-058 c3)', () => {
    test.each([undefined, 1, 5, 10, 12, 18])(
      'T-414 c2 @P1 Q-058 c3 zoom=%p: the view stays at zoom 2 on the fixed centre',
      (zoom) => {
        const { map, container } = mount(
          [place('Birkbeck', 51.52, -0.13, '/data-providers/8')],
          { zoom }
        )
        expect(map.getZoom()).toBe(2)
        expect(map.getCenter().lat).toBeCloseTo(CENTER.lat, 10)
        expect(map.getCenter().lng).toBeCloseTo(CENTER.lng, 10)
        expect(mapSpy.mock.calls[0][1].zoom).toBe(2)
        expect(new Set(tileLevels(container))).toEqual(new Set([2]))
      }
    )

    test('T-414 c2 @P1 Q-058 c3 the single location is not the centre either: the view never follows the data', () => {
      const { map } = mount([place('Tokyo', 35.68, 139.69)], { zoom: 10 })
      expect(map.getCenter().lat).toBeCloseTo(CENTER.lat, 10)
      expect(map.getCenter().lng).toBeCloseTo(CENTER.lng, 10)
      expect(map.getZoom()).toBe(2)
    })

    test('T-414 c2 @P1 Q-058 c3 through the wrapper, as the output page passes zoom={10}: still zoom 2', async () => {
      const view = render(
        <RepositoriesMap
          zoom={10}
          locations={[place('A', 51.52, -0.13, '/data-providers/1')]}
        />
      )
      await waitFor(() =>
        expect(view.container.querySelector('#map')).not.toBeNull()
      )
      expect(lastMap().getZoom()).toBe(2)
      expect(new Set(tileLevels(view.container))).toEqual(new Set([2]))
    })

    test('T-414 c2 @P1 Q-058 c3 the zoom control still works: the user can zoom within 1..12', () => {
      const { map } = mount([place('A', 51.52, -0.13)])
      act(() => {
        map.setZoom(5, { animate: false })
      })
      expect(map.getZoom()).toBe(5)
      act(() => {
        map.setZoom(30, { animate: false })
      })
      expect(map.getZoom()).toBe(12)
      act(() => {
        map.setZoom(-3, { animate: false })
      })
      expect(map.getZoom()).toBe(1)
    })
  })

  describe('T-414 c3 @P1 the popup link is an unquoted attribute (Q-058 c4)', () => {
    const popupOf = (html) => {
      const holder = document.createElement('div')
      holder.innerHTML = html
      return holder
    }

    test('T-414 c3 @P1 Q-058 c4 the string given to bindPopup: href unquoted, target quoted, the name as it is', () => {
      mount([
        place('Open Research Online', 52.03, -0.7, '/data-providers/86'),
        place('No link', 1, 1),
        place('Empty link', 2, 2, ''),
        place('Null link', 3, 3, null),
      ])
      expect(popupSpy.mock.calls.map(([html]) => html)).toEqual([
        '<a href=/data-providers/86 target="_blank">Open Research Online</a>',
        'No link',
        'Empty link',
        'Null link',
      ])
    })

    test('T-414 c3 @P1 Q-058 c4 a click on the marker opens the popup with the link: href and target, nothing else', () => {
      const { container } = mount([
        place('Open Research Online', 52.03, -0.7, '/data-providers/86'),
      ])
      expect(container.querySelector('.leaflet-popup')).toBeNull()
      fireEvent.click(singles(container)[0])
      const content = container.querySelector('.leaflet-popup-content')
      const anchor = content.querySelector('a')
      expect(anchor.getAttributeNames().sort()).toEqual(['href', 'target'])
      expect(anchor.getAttribute('href')).toBe('/data-providers/86')
      expect(anchor.getAttribute('target')).toBe('_blank')
      expect(anchor.textContent).toBe('Open Research Online')
      expect(content.children).toHaveLength(1)
    })

    test('T-414 c3 @P1 Q-058 c4 a location without href opens a popup with the plain name and no link', () => {
      const { container } = mount([place('Just a name', 52.03, -0.7)])
      fireEvent.click(singles(container)[0])
      const content = container.querySelector('.leaflet-popup-content')
      expect(content.textContent).toBe('Just a name')
      expect(content.querySelector('a')).toBeNull()
    })

    test('T-414 c3 @P1 Q-058 c4 an href with a space ends at the space: the rest becomes an attribute of its own', () => {
      const { container } = mount([
        place('Spaced', 52.03, -0.7, '/data-providers/a b'),
      ])
      fireEvent.click(singles(container)[0])
      const anchor = container.querySelector('.leaflet-popup-content a')
      expect(anchor.getAttribute('href')).toBe('/data-providers/a')
      expect(anchor.getAttributeNames()).toEqual(['href', 'b', 'target'])
      expect(anchor.getAttribute('b')).toBe('')
    })

    test('T-414 c3 @P1 Q-058 c4 text after a space in an href is parsed as attributes: an attribute can be injected', () => {
      const { container } = mount([
        place('Injected', 52.03, -0.7, '/x data-injected=1'),
      ])
      fireEvent.click(singles(container)[0])
      const anchor = container.querySelector('.leaflet-popup-content a')
      // the unquoted value ends at the space, then a new attribute starts
      expect(anchor.getAttribute('href')).toBe('/x')
      expect(anchor.getAttribute('data-injected')).toBe('1')
      expect(anchor.getAttribute('target')).toBe('_blank')
    })

    test('T-414 c3 @P1 Q-058 c4 the name is inserted as HTML: markup in a name becomes elements', () => {
      const { container } = mount([
        place('<b>Bold</b> name', 52.03, -0.7, '/data-providers/1'),
      ])
      fireEvent.click(singles(container)[0])
      const content = container.querySelector('.leaflet-popup-content')
      expect(content.querySelector('a b').textContent).toBe('Bold')
      expect(content.textContent).toBe('Bold name')
      expect(
        popupOf(popupSpy.mock.calls[0][0]).querySelector('b')
      ).not.toBeNull()
    })
  })
})

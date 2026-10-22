// P1-05: the popup lifecycle of the Leaflet maps (modules/map/map.jsx). A marker click opens a popup and Leaflet
// pans the map to fit it; every move rebuilds the markers from state, which removes the popup again. The window
// between the two is a few frames, so a test records the popup nodes the map adds and removes (MutationObserver)
// instead of looking for the popup.

// start recording on the map `#map`: window.__popups = [['added', <popup content html>], ['removed'], ...]
export const recordPopups = (page) =>
  page.evaluate(() => {
    window.__popups = []
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue
          const popup = n.matches('.leaflet-popup')
            ? n
            : n.querySelector('.leaflet-popup')
          if (popup)
            window.__popups.push([
              'added',
              popup.querySelector('.leaflet-popup-content').innerHTML,
            ])
        }
        for (const n of r.removedNodes) {
          if (n.nodeType !== 1) continue
          if (n.matches('.leaflet-popup') || n.querySelector('.leaflet-popup'))
            window.__popups.push(['removed'])
        }
      }
    }).observe(document.querySelector('#map'), {
      subtree: true,
      childList: true,
    })
  })

export const popupLog = (page) => page.evaluate(() => window.__popups)

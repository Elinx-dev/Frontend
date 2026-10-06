import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { PinIcon } from '../../icons'
import { coordLabel } from './surveyorShared'

/**
 * OpenStreetMap preview of the GPS point. Draws the captured polygon once it has three
 * vertices; until then, a dashed square of the measured extent around the point.
 */
export function SurveyMap({ lat, lon, areaM2, polygon }: { lat: number | null; lon: number | null; areaM2: number | null; polygon: [number, number][] }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const hasPoint = lat != null && lon != null

  useEffect(() => {
    if (!hasPoint || host.current == null) return
    const m = L.map(host.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    layers.current = L.layerGroup().addTo(m)
    map.current = m
    const timer = window.setTimeout(() => m.invalidateSize(), 50)
    return () => {
      window.clearTimeout(timer)
      m.remove()
      map.current = null
      layers.current = null
    }
  }, [hasPoint])

  useEffect(() => {
    const m = map.current
    const group = layers.current
    if (m == null || group == null || lat == null || lon == null) return
    group.clearLayers()
    let bounds = L.latLngBounds([lat, lon], [lat, lon])
    if (polygon.length >= 3) {
      bounds = L.polygon(polygon, { color: '#1f7a4d', weight: 2, fillOpacity: 0.18 }).addTo(group).getBounds()
    } else if (areaM2 != null && areaM2 > 0) {
      const half = Math.sqrt(areaM2) / 2
      const dLat = half / 111320
      const dLon = half / (111320 * Math.cos((lat * Math.PI) / 180))
      bounds = L.rectangle([[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]], {
        color: '#b8923d', weight: 2, dashArray: '6 4', fillOpacity: 0.15,
      }).addTo(group).getBounds()
    }
    L.circleMarker([lat, lon], { radius: 7, color: '#0f2a4a', weight: 2, fillColor: '#b8923d', fillOpacity: 0.9 }).addTo(group)
    m.fitBounds(bounds.pad(0.6), { maxZoom: 18 })
  }, [lat, lon, areaM2, polygon])

  if (!hasPoint) {
    return (
      <div className="sv-map-empty">
        <PinIcon />
        <strong>Enter GPS coordinates</strong>
        <small>The map preview appears once latitude and longitude are valid.</small>
      </div>
    )
  }
  return (
    <>
      <div className="sv-map" ref={host} />
      <div className="sv-map-caption">
        <span>
          <PinIcon /> {coordLabel(lat, lon)}
          {polygon.length >= 3 ? <b className="ok"> · {polygon.length} vertices</b> : <em> · estimated boundary</em>}
        </span>
        <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer">Open in Maps ↗</a>
      </div>
      {polygon.length >= 3 ? <p className="sv-ok">Boundary polygon: {polygon.length} vertices plotted</p> : null}
    </>
  )
}

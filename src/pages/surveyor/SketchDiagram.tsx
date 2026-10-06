import { lengthInMetres, LENGTH_UNITS } from './surveyorShared'
import type { MeasurementRow } from './surveyorShared'

const W = 520
const H = 360
const PAD = 56

/**
 * Draws the parcel from the measurement table: each side follows the previous one,
 * turning by 360°/n, so four sides give the top, right, bottom and left edges.
 */
export function SketchDiagram({ rows }: { rows: MeasurementRow[] }) {
  const sides = rows
    .map((r) => ({ ...r, length: Number(r.value) }))
    .filter((r) => Number.isFinite(r.length) && r.length > 0)
  if (sides.length < 3) {
    return (
      <div className="sv-map-empty">
        <strong>Sketch diagram</strong>
        <small>Enter at least three measurements to draw the parcel sketch.</small>
      </div>
    )
  }

  const n = sides.length
  const pts: [number, number][] = [[0, 0]]
  sides.forEach((s, i) => {
    const angle = (i * 2 * Math.PI) / n
    const [x, y] = pts[pts.length - 1]
    const len = lengthInMetres(s.length, s.unit)
    pts.push([x + len * Math.cos(angle), y + len * Math.sin(angle)])
  })
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const scale = Math.min((W - 2 * PAD) / (Math.max(...xs) - minX || 1), (H - 2 * PAD) / (Math.max(...ys) - minY || 1))
  const screen = pts.map(([x, y]) => [PAD + (x - minX) * scale, PAD + (y - minY) * scale] as [number, number])
  const cx = screen.slice(0, n).reduce((s, p) => s + p[0], 0) / n
  const cy = screen.slice(0, n).reduce((s, p) => s + p[1], 0) / n

  const perimeter = sides.reduce((s, r) => s + lengthInMetres(r.length, r.unit), 0)
  const gap = Math.hypot(pts[n][0] - pts[0][0], pts[n][1] - pts[0][1])
  const closes = gap <= perimeter * 0.01
  const ring = pts.slice(0, n)
  const area = Math.abs(ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % n]
    return s + p[0] * q[1] - q[0] * p[1]
  }, 0)) / 2

  return (
    <div className="sv-sketch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parcel sketch diagram">
        <defs>
          <pattern id="sv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#e6eaef" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#sv-grid)" />
        <polygon points={screen.slice(0, n).map((p) => p.join(',')).join(' ')} fill="rgba(184,146,61,0.14)" stroke="#0f2a4a" strokeWidth="2" />
        {closes ? null : (
          <line x1={screen[n][0]} y1={screen[n][1]} x2={screen[0][0]} y2={screen[0][1]} stroke="#c0392b" strokeDasharray="5 4" strokeWidth="1.5" />
        )}
        {sides.map((s, i) => {
          const [x1, y1] = screen[i]
          const [x2, y2] = screen[i + 1]
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const d = Math.hypot(mx - cx, my - cy) || 1
          const unit = LENGTH_UNITS.find((u) => u.code === s.unit)?.label ?? s.unit
          return (
            <text key={`side-${i}`} x={mx + ((mx - cx) / d) * 18} y={my + ((my - cy) / d) * 18 + 4} textAnchor="middle" className="sv-sketch-len">
              {s.length} {unit}
            </text>
          )
        })}
        {screen.slice(0, n).map(([x, y], i) => {
          const d = Math.hypot(x - cx, y - cy) || 1
          return (
            <g key={`pt-${i}`}>
              <circle cx={x} cy={y} r="4" fill="#b8923d" stroke="#0f2a4a" />
              <text x={x + ((x - cx) / d) * 14} y={y + ((y - cy) / d) * 14 + 4} textAnchor="middle" className="sv-sketch-pt">
                {String.fromCharCode(65 + i)}
              </text>
            </g>
          )
        })}
        <g transform={`translate(${W - 28}, 30)`}>
          <path d="M0 -14 L6 6 L0 2 L-6 6 Z" fill="#0f2a4a" />
          <text y="20" textAnchor="middle" className="sv-sketch-pt">N</text>
        </g>
      </svg>
      <div className="sv-sketch-legend">
        <span>{n} sides · perimeter {perimeter.toFixed(1)} m</span>
        <span>Sketch area ≈ {(area * 10.7639).toFixed(0)} sq.ft ({(area / 4046.8564224).toFixed(3)} acres)</span>
        {closes ? <span className="ok">Sides close the boundary</span> : <span className="warn">Closure gap {gap.toFixed(1)} m (dashed red)</span>}
      </div>
      <ul className="sv-sketch-sides">
        {sides.map((s, i) => (
          <li key={`l-${i}`}>
            <b>{String.fromCharCode(65 + i)}–{String.fromCharCode(65 + ((i + 1) % n))}</b> {s.from} → {s.to}: {s.length} {LENGTH_UNITS.find((u) => u.code === s.unit)?.label ?? s.unit}
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'

import { get, post } from '../../api'
import { Banner } from '../../ui'
import { CheckCircleIcon, ListIcon, PinIcon } from '../../icons'
import { errorText } from '../vao/useVao'
import { todayIso } from '../vao/vaoShared'
import { SketchDiagram } from './SketchDiagram'
import { SurveyMap } from './SurveyMap'
import {
  AREA_UNITS,
  areaUnitCode,
  areaUnitLabel,
  convertArea,
  DIRECTIONS,
  isPartition,
  LENGTH_UNITS,
  num,
  toSquareMetres,
  vertex,
} from './surveyorShared'
import type { MeasurementRow, PolygonRow, SurveyorDetail, SurveyorRecord } from './surveyorShared'

type LeftTab = 'gps' | 'measurements' | 'boundaries' | 'polygon' | 'notes'
type RightTab = 'map' | 'sketch'

const LEFT_TABS: [LeftTab, string][] = [
  ['gps', 'GPS & Area'],
  ['measurements', 'Measurements'],
  ['boundaries', 'Boundaries'],
  ['polygon', 'Polygon'],
  ['notes', 'Notes'],
]

const EMPTY_POINT: PolygonRow = { lat: '', latDir: 'N', lon: '', lonDir: 'E' }

interface SubmitResult {
  routedTo: string
  withinTolerance: boolean
  variancePct: number
}

function nextDirection(from: string): string {
  const i = DIRECTIONS.indexOf(from)
  return DIRECTIONS[(i + 1) % 4] ?? 'North'
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

/** The Survey Verification Form: GPS, area, measurements, boundaries, polygon and notes, with live map and sketch. */
export function SurveyForm({ record, onClose, onSubmitted }: { record: SurveyorRecord; onClose: () => void; onSubmitted: (message: string) => void }) {
  const [leftTab, setLeftTab] = useState<LeftTab>('gps')
  const [rightTab, setRightTab] = useState<RightTab>('map')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [extent, setExtent] = useState('')
  const [unit, setUnit] = useState(areaUnitCode(record.extent_unit) ?? 'SQ_FT')
  const [segments, setSegments] = useState<MeasurementRow[]>([{ from: 'North', to: 'East', value: '', unit: 'FT' }])
  const [boundaries, setBoundaries] = useState({ north: '', south: '', east: '', west: '' })
  const [points, setPoints] = useState<PolygonRow[]>([{ ...EMPTY_POINT }])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (record.submission_id == null) return
    let cancelled = false
    void get<SurveyorDetail>(`/api/surveyor/records/${encodeURIComponent(record.txn_ref)}`).then((detail) => {
      const last = detail.submissions[0]
      if (cancelled || last == null) return
      setLat(text(last.centroid_lat))
      setLon(text(last.centroid_lon))
      setExtent(text(last.measured_extent))
      setUnit(areaUnitCode(text(last.extent_unit)) ?? unit)
      setBoundaries({ north: text(last.boundary_north), south: text(last.boundary_south), east: text(last.boundary_east), west: text(last.boundary_west) })
      setNotes(text(last.site_notes))
      if ((detail.segments ?? []).length > 0) {
        setSegments((detail.segments ?? []).map((s) => ({ from: text(s.from_point), to: text(s.to_point), value: text(s.length_value), unit: text(s.length_unit) || 'FT' })))
      }
      if ((detail.boundary_points ?? []).length > 0) {
        setPoints((detail.boundary_points ?? []).map((p) => {
          const pLat = Number(p.latitude)
          const pLon = Number(p.longitude)
          return { lat: String(Math.abs(pLat)), latDir: pLat < 0 ? 'S' : 'N', lon: String(Math.abs(pLon)), lonDir: pLon < 0 ? 'W' : 'E' }
        }))
      }
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
    // Prefill once from the latest submission when re-surveying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.txn_ref, record.submission_id])

  const latNum = num(lat)
  const lonNum = num(lon)
  const gpsEntered = lat.trim() !== '' || lon.trim() !== ''
  const gpsValid = latNum != null && lonNum != null && Math.abs(latNum) <= 90 && Math.abs(lonNum) <= 180
  const extentNum = num(extent)
  const recorded = num(record.extent_value)
  const tolerance = Number(record.tolerance_pct ?? 0)
  const measuredInRecord = extentNum == null ? null : convertArea(extentNum, unit, record.extent_unit)
  const variance = measuredInRecord == null || recorded == null || recorded === 0 ? null : (Math.abs(measuredInRecord - recorded) / recorded) * 100
  const conflict = variance != null && variance > tolerance
  const areaM2 = extentNum == null ? null : toSquareMetres(extentNum, unit)
  const polygon = useMemo(() => points.map(vertex).filter((p): p is [number, number] => p != null), [points])
  const filledSegments = segments.filter((s) => (num(s.value) ?? 0) > 0)
  const partition = isPartition(record)

  function updateSegment(i: number, patch: Partial<MeasurementRow>) {
    setSegments((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function updatePoint(i: number, patch: Partial<PolygonRow>) {
    setPoints((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function submit() {
    setError('')
    if (!gpsValid) {
      setLeftTab('gps')
      setError('Enter valid GPS latitude and longitude for the site.')
      return
    }
    if (extentNum == null || extentNum <= 0) {
      setLeftTab('gps')
      setError('Enter the measured extent.')
      return
    }
    const partial = points.filter((p) => (p.lat.trim() !== '' || p.lon.trim() !== '') && vertex(p) == null)
    if (partial.length > 0 || (polygon.length > 0 && polygon.length < 3)) {
      setLeftTab('polygon')
      setError('Each polygon vertex needs both latitude and longitude, and a polygon needs at least 3 vertices.')
      return
    }
    setBusy(true)
    try {
      const result = await post<SubmitResult>(
        `/api/surveyor/records/${encodeURIComponent(record.txn_ref)}/survey`,
        {
          measuredExtent: extentNum,
          extentUnit: unit,
          surveyDate: todayIso(),
          centroidLat: latNum,
          centroidLon: lonNum,
          boundaryNorth: boundaries.north.trim() || null,
          boundarySouth: boundaries.south.trim() || null,
          boundaryEast: boundaries.east.trim() || null,
          boundaryWest: boundaries.west.trim() || null,
          siteNotes: notes.trim() || null,
          segments: filledSegments.map((s) => ({ fromPoint: s.from, toPoint: s.to, lengthValue: Number(s.value), lengthUnit: s.unit })),
          boundaryPoints: polygon.map(([pLat, pLon], i) => ({ pointLabel: `P${i + 1}`, latitude: pLat, longitude: pLon })),
        },
        true,
      )
      onSubmitted(result.withinTolerance
        ? `Survey for ${record.ulpin ?? record.txn_ref} saved and forwarded to the VAO for verification (variance ${Number(result.variancePct).toFixed(2)}%).`
        : `Survey for ${record.ulpin ?? record.txn_ref} saved with a conflict flag (variance ${Number(result.variancePct).toFixed(2)}%). It is routed for survey correction review.`)
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vao-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="sv-modal" role="dialog" aria-modal="true" aria-label="Survey Verification Form" onClick={(e) => e.stopPropagation()}>
        <header className="vao-modal-head">
          <div>
            <h2>Survey Verification Form</h2>
            <small className="sv-sub">{record.ulpin ?? record.property_ref} · {record.txn_ref} · S.No. {record.survey_no ?? '—'}{record.subdivision_no ? `/${record.subdivision_no}` : ''} · {record.village_name ?? record.village_code ?? '—'}</small>
          </div>
          <button className="vao-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="sv-body">
          <div className="sv-left">
            <nav className="sv-tabs">
              {LEFT_TABS.map(([key, label]) => (
                <button key={key} className={leftTab === key ? 'active' : ''} onClick={() => setLeftTab(key)}>{label}</button>
              ))}
            </nav>
            <div className="sv-pane">
              {leftTab === 'gps' ? (
                <>
                  <section className="sv-section">
                    <h3><PinIcon /> GPS Coordinates (On-Site)</h3>
                    <div className="sv-grid2">
                      <label><span>Latitude</span><input type="number" step="any" placeholder="e.g. 12.9675" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
                      <label><span>Longitude</span><input type="number" step="any" placeholder="e.g. 79.9419" value={lon} onChange={(e) => setLon(e.target.value)} /></label>
                    </div>
                    {gpsEntered ? (
                      gpsValid ? <p className="sv-ok">GPS valid - map preview updated</p> : <p className="sv-err">Latitude must be within ±90 and longitude within ±180.</p>
                    ) : <p className="sv-hint">Capture the coordinates at the parcel centre.</p>}
                  </section>
                  <section className="sv-section">
                    <h3><ListIcon /> Extent Area</h3>
                    <p className="sv-hint">Token record: <b>{record.extent_value ?? '—'} {areaUnitLabel(record.extent_unit)}</b></p>
                    <div className="sv-grid-extent">
                      <label><span>Measured extent</span><input type="number" step="any" min="0" value={extent} onChange={(e) => setExtent(e.target.value)} /></label>
                      <label><span>Unit</span>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                          {AREA_UNITS.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
                        </select>
                      </label>
                    </div>
                    {extentNum == null ? null : variance == null ? (
                      <p className="sv-err">This unit cannot be compared with the token record's unit.</p>
                    ) : conflict ? (
                      <p className="sv-err">Area differs by {variance.toFixed(2)}% from the token record (tolerance {tolerance}%). The survey will be flagged as a conflict.</p>
                    ) : (
                      <p className="sv-ok">Area within {tolerance}% ({variance.toFixed(2)}%) - will forward to the VAO for verification.</p>
                    )}
                  </section>
                </>
              ) : null}

              {leftTab === 'measurements' ? (
                <section className="sv-section">
                  <div className="sv-section-head">
                    <h3><ListIcon /> Site Measurements</h3>
                    <button className="sv-add" onClick={() => setSegments((rows) => {
                      const last = rows[rows.length - 1]
                      const from = last?.to ?? 'North'
                      return [...rows, { from, to: nextDirection(from), value: '', unit: last?.unit ?? 'FT' }]
                    })}>+ Add Row</button>
                  </div>
                  <p className="sv-hint">Enter each side in order around the parcel. The sketch is drawn from these lengths.</p>
                  <div className="sv-rows">
                    <div className="sv-row head measure"><span>From</span><span>To</span><span>Length</span><span>Unit</span><span /></div>
                    {segments.map((s, i) => (
                      <div key={i} className="sv-row measure">
                        <select aria-label={`Row ${i + 1} from`} value={s.from} onChange={(e) => updateSegment(i, { from: e.target.value })}>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select>
                        <select aria-label={`Row ${i + 1} to`} value={s.to} onChange={(e) => updateSegment(i, { to: e.target.value })}>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select>
                        <input aria-label={`Row ${i + 1} length`} type="number" step="any" min="0" value={s.value} onChange={(e) => updateSegment(i, { value: e.target.value })} />
                        <select aria-label={`Row ${i + 1} unit`} value={s.unit} onChange={(e) => updateSegment(i, { unit: e.target.value })}>{LENGTH_UNITS.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}</select>
                        <button className="sv-del" aria-label={`Delete row ${i + 1}`} disabled={segments.length === 1} onClick={() => setSegments((rows) => rows.filter((_, j) => j !== i))}>🗑</button>
                      </div>
                    ))}
                  </div>
                  {filledSegments.length > 0 ? <p className="sv-ok">{filledSegments.length} measurement{filledSegments.length === 1 ? '' : 's'} entered - sketch diagram updated</p> : null}
                </section>
              ) : null}

              {leftTab === 'boundaries' ? (
                <section className="sv-section">
                  <h3><PinIcon /> Boundary Details</h3>
                  <p className="sv-hint">Describe what adjoins the parcel on each side (survey number, owner, road, channel…).</p>
                  {(['north', 'south', 'east', 'west'] as const).map((side) => (
                    <label key={side} className="sv-field">
                      <span>{side[0].toUpperCase() + side.slice(1)} boundary</span>
                      <input value={boundaries[side]} placeholder={`e.g. S.No. 142/2 - ${side === 'east' ? 'panchayat road' : 'adjoining land'}`} onChange={(e) => setBoundaries((b) => ({ ...b, [side]: e.target.value }))} />
                    </label>
                  ))}
                </section>
              ) : null}

              {leftTab === 'polygon' ? (
                <section className="sv-section">
                  <div className="sv-section-head">
                    <h3><PinIcon /> Parcel Boundary Polygon</h3>
                    <button className="sv-add" onClick={() => setPoints((rows) => [...rows, { ...EMPTY_POINT, latDir: rows[rows.length - 1]?.latDir ?? 'N', lonDir: rows[rows.length - 1]?.lonDir ?? 'E' }])}>+ Add Point</button>
                  </div>
                  <p className="sv-hint">Enter GPS coordinates for each boundary vertex in order (minimum 3). Map updates live.</p>
                  {partition ? (
                    <div className="sv-note">
                      <b>Partition transaction:</b> The polygon you define here represents the boundary of the <b>portion being transferred to the buyer</b>. This will become the new token&apos;s map boundary after Tahsildar approval.
                    </div>
                  ) : null}
                  <div className="sv-rows">
                    <div className="sv-row head poly"><span /><span>Latitude</span><span /><span>Longitude</span><span /><span /></div>
                    {points.map((p, i) => (
                      <div key={i} className="sv-row poly">
                        <span className="sv-idx">{i + 1}</span>
                        <input aria-label={`Point ${i + 1} latitude`} type="number" step="any" min="0" max="90" value={p.lat} onChange={(e) => updatePoint(i, { lat: e.target.value })} />
                        <select aria-label={`Point ${i + 1} N/S`} value={p.latDir} onChange={(e) => updatePoint(i, { latDir: e.target.value as 'N' | 'S' })}><option>N</option><option>S</option></select>
                        <input aria-label={`Point ${i + 1} longitude`} type="number" step="any" min="0" max="180" value={p.lon} onChange={(e) => updatePoint(i, { lon: e.target.value })} />
                        <select aria-label={`Point ${i + 1} E/W`} value={p.lonDir} onChange={(e) => updatePoint(i, { lonDir: e.target.value as 'E' | 'W' })}><option>E</option><option>W</option></select>
                        <button className="sv-del" aria-label={`Delete point ${i + 1}`} disabled={points.length === 1} onClick={() => setPoints((rows) => rows.filter((_, j) => j !== i))}>🗑</button>
                      </div>
                    ))}
                  </div>
                  {polygon.length >= 3 ? (
                    <p className="sv-ok">{polygon.length} vertices entered - polygon boundary shown on map</p>
                  ) : (
                    <p className="sv-hint">{polygon.length} of 3 vertices entered.</p>
                  )}
                </section>
              ) : null}

              {leftTab === 'notes' ? (
                <section className="sv-section">
                  <h3><ListIcon /> Site Notes</h3>
                  <textarea rows={8} value={notes} placeholder="Observations at site: encroachments, boundary stones, crops, structures, disputes…" onChange={(e) => setNotes(e.target.value)} />
                </section>
              ) : null}
            </div>
            <footer className="sv-footer">
              <Banner kind="error" message={error} />
              {conflict ? (
                <div className="sv-conflict">
                  <b>Area conflict:</b> measured {extent} {areaUnitLabel(unit)} vs token record {record.extent_value} {areaUnitLabel(record.extent_unit)} ({variance?.toFixed(2)}% &gt; {tolerance}%). Submitting will flag this record for survey correction review.
                </div>
              ) : null}
              <button className={conflict ? 'sv-submit conflict' : 'sv-submit'} disabled={busy} onClick={() => void submit()}>
                <CheckCircleIcon /> {conflict ? 'Submit with Conflict Flag' : 'Submit Survey & Forward to VAO'}
              </button>
            </footer>
          </div>
          <div className="sv-right">
            <nav className="sv-tabs right">
              <button className={rightTab === 'map' ? 'active' : ''} onClick={() => setRightTab('map')}>Map View</button>
              <button className={rightTab === 'sketch' ? 'active' : ''} onClick={() => setRightTab('sketch')}>Sketch Diagram</button>
              <em>Updates live as you type</em>
            </nav>
            <div className="sv-preview">
              {rightTab === 'map'
                ? <SurveyMap lat={gpsValid ? latNum : null} lon={gpsValid ? lonNum : null} areaM2={areaM2} polygon={polygon} />
                : <SketchDiagram rows={segments} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

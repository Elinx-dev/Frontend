import { useEffect, useMemo, useState } from 'react'

import { get, post } from '../../api'
import { Banner } from '../../ui'
import { CheckCircleIcon, ListIcon, PinIcon } from '../../icons'
import { errorText } from '../vao/useVao'
import { todayIso } from '../vao/vaoShared'
import { SketchDiagram } from './SketchDiagram'
import { SurveyMap } from './SurveyMap'
import { useOptionSet } from '../propertyShared'
import {
  areaUnitCode,
  areaUnitLabel,
  convertArea,
  num,
  toSquareMetres,
  vertex,
} from './surveyorShared'
import type { MeasurementRow, PolygonRow, SurveyorDetail, SurveyorRecord } from './surveyorShared'

type LeftTab = 'gps' | 'measurements' | 'boundaries' | 'polygon' | `property-${number}` | 'notes'
type RightTab = 'map' | 'sketch'

const LEFT_TABS: [LeftTab, string][] = [
  ['gps', 'GPS & Area'],
  ['measurements', 'Measurements'],
  ['boundaries', 'Boundaries'],
  ['polygon', 'Polygon'],
  ['notes', 'Notes'],
]

interface ParcelDraft {
  surveyNo: string
  subdivisionNo: string
  extent: string
  unit: string
  north: string
  south: string
  east: string
  west: string
  northSouth: string
  eastWest: string
  propertyRef: string
  side: string
  owners: string
  tokenRef: string
}

const SIDES = ['north', 'south', 'east', 'west'] as const

function partySideLabel(side: unknown): string {
  return side === 'SIDE_2' ? 'Buyer' : 'Seller'
}

const EMPTY_POINT: PolygonRow = { lat: '', latDir: 'N', lon: '', lonDir: 'E' }

interface SubmitResult {
  routedTo: string
  withinTolerance: boolean
  variancePct: number
}

function nextDirection(from: string, directions: string[]): string {
  const i = directions.indexOf(from)
  return directions[(i + 1) % 4] ?? from
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

/** The Survey Verification Form: GPS, area, measurements, boundaries, polygon and notes, with live map and sketch. */
export function SurveyForm({ record, onClose, onSubmitted }: { record: SurveyorRecord; onClose: () => void; onSubmitted: (message: string) => void }) {
  const areaUnits = useOptionSet('EXTENT_UNIT')
  const lengthUnits = useOptionSet('LENGTH_UNIT')
  const directionOptions = useOptionSet('DIRECTION')
  const directions = directionOptions.map((d) => d.value)
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
  const [parcels, setParcels] = useState<ParcelDraft[]>([])
  const subdivision = parcels.length > 0
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void get<SurveyorDetail>(`/api/surveyor/records/${encodeURIComponent(record.txn_ref)}`).then((detail) => {
      if (cancelled) return
      const lastParcels = detail.parcels ?? []
      setParcels((detail.childProperties ?? []).map((cp) => {
        const pc = lastParcels.find((row) => row.child_property_ref === cp.property_ref) ?? cp
        return {
          surveyNo: text(pc.survey_no),
          subdivisionNo: text(pc.official_subdivision_no ?? pc.subdivision_no),
          extent: text(pc.extent_value),
          unit: areaUnitCode(text(pc.extent_unit)) ?? 'SQ_FT',
          north: text(pc.boundary_north),
          south: text(pc.boundary_south),
          east: text(pc.boundary_east),
          west: text(pc.boundary_west),
          northSouth: '',
          eastWest: '',
          propertyRef: text(cp.property_ref),
          side: text(cp.allotted_side),
          owners: text(cp.owners),
          tokenRef: text(cp.token_ref),
        }
      }))
      const last = detail.submissions[0]
      if (record.submission_id == null || last == null) return
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
  const areaM2 = extentNum == null ? null : toSquareMetres(extentNum, unit)
  const polygon = useMemo(() => points.map(vertex).filter((p): p is [number, number] => p != null), [points])
  const filledSegments = segments.filter((s) => (num(s.value) ?? 0) > 0)
  const partitionDeed = record.deed_type_code === 'PARTITION'
  const propertyTabs = parcels.map((_pc, i): [LeftTab, string] => [`property-${i}`, `Property ${i + 1}`])
  const leftTabs = subdivision ? LEFT_TABS.flatMap((t) => (t[0] === 'notes' ? [...propertyTabs, t] : [t])) : LEFT_TABS
  const activeParcel = leftTab.startsWith('property-') ? Number(leftTab.slice('property-'.length)) : -1
  const parcelTotal = parcels.reduce<number | null>((sum, pc) => {
    const value = num(pc.extent)
    if (sum == null || value == null) return sum
    const converted = convertArea(value, pc.unit, unit)
    return converted == null ? null : sum + converted
  }, 0)

  function updateParcel(i: number, patch: Partial<ParcelDraft>) {
    setParcels((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function parcelError(): [string, number] {
    if (!subdivision) return ['', 0]
    const seen = new Set<string>()
    const parentKey = `${text(record.survey_no).trim()}/${text(record.subdivision_no).trim()}`.toUpperCase()
    for (const [i, pc] of parcels.entries()) {
      const label = pc.propertyRef || `Property ${i + 1}`
      if (pc.surveyNo.trim() === '') return [`Enter the new survey number of ${label}.`, i]
      const key = `${pc.surveyNo.trim()}/${pc.subdivisionNo.trim()}`.toUpperCase()
      if (key === parentKey) return [`${label} has the parent property's survey number ${record.survey_no ?? ''}${record.subdivision_no ? `/${record.subdivision_no}` : ''}; enter the new survey / subdivision number.`, i]
      if (seen.has(key)) return [`${label} repeats survey number ${pc.surveyNo}${pc.subdivisionNo ? `/${pc.subdivisionNo}` : ''}.`, i]
      seen.add(key)
      if ((num(pc.extent) ?? 0) <= 0) return [`Enter the extent of ${label}.`, i]
      if (SIDES.some((side) => pc[side].trim() === '')) return [`Enter the north, south, east and west boundaries of ${label}.`, i]
    }
    return ['', 0]
  }

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
    const [subdivisionError, errorParcel] = extentNum == null || extentNum <= 0 ? ['', 0] : parcelError()
    if (subdivisionError) {
      setLeftTab(`property-${errorParcel}`)
      setError(subdivisionError)
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
      await post<SubmitResult>(
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
          parcels: subdivision
            ? parcels.map((pc) => ({
                surveyNo: pc.surveyNo.trim(),
                officialSubdivisionNo: pc.subdivisionNo.trim() || null,
                extentValue: Number(pc.extent),
                extentUnit: pc.unit,
                boundaryNorth: pc.north.trim(),
                boundarySouth: pc.south.trim(),
                boundaryEast: pc.east.trim(),
                boundaryWest: pc.west.trim(),
                propertyRef: pc.propertyRef,
                segments: [['North', 'South', pc.northSouth], ['East', 'West', pc.eastWest]]
                  .filter(([, , v]) => (num(v) ?? 0) > 0)
                  .map(([from, to, v]) => ({ fromPoint: from, toPoint: to, lengthValue: Number(v), lengthUnit: 'FT' })),
              }))
            : [],
        },
        true,
      )
      onSubmitted(`Survey for ${record.ulpin ?? record.txn_ref} saved; the surveyed extent and boundaries are now on the ${subdivision ? 'new properties' : 'property'}. Forwarded to the ${subdivision && !partitionDeed ? 'Tahsildar for approval' : 'VAO for verification'}.`)
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
              {leftTabs.map(([key, label]) => (
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
                    <p className="sv-hint">Recorded extent: <b>{record.extent_value ?? '—'} {areaUnitLabel(record.extent_unit, areaUnits)}</b></p>
                    <div className="sv-grid-extent">
                      <label><span>Measured extent</span><input type="number" step="any" min="0" value={extent} onChange={(e) => setExtent(e.target.value)} /></label>
                      <label><span>Unit</span>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                          {areaUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="sv-hint">The surveyed value is final and replaces the recorded extent{subdivision ? ' of each new property' : ''}.</p>
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
                      return [...rows, { from, to: nextDirection(from, directions), value: '', unit: last?.unit ?? 'FT' }]
                    })}>+ Add Row</button>
                  </div>
                  <p className="sv-hint">Enter each side in order around the parcel. The sketch is drawn from these lengths.</p>
                  <div className="sv-rows">
                    <div className="sv-row head measure"><span>From</span><span>To</span><span>Length</span><span>Unit</span><span /></div>
                    {segments.map((s, i) => (
                      <div key={i} className="sv-row measure">
                        <select aria-label={`Row ${i + 1} from`} value={s.from} onChange={(e) => updateSegment(i, { from: e.target.value })}>{directionOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
                        <select aria-label={`Row ${i + 1} to`} value={s.to} onChange={(e) => updateSegment(i, { to: e.target.value })}>{directionOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
                        <input aria-label={`Row ${i + 1} length`} type="number" step="any" min="0" value={s.value} onChange={(e) => updateSegment(i, { value: e.target.value })} />
                        <select aria-label={`Row ${i + 1} unit`} value={s.unit} onChange={(e) => updateSegment(i, { unit: e.target.value })}>{lengthUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select>
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
                  {partitionDeed && subdivision ? (
                    <div className="sv-note">
                      <b>Partition transaction:</b> Registration created one new property per partition schedule. Draw the outer boundary of the parent parcel here, then record the measured extent, official subdivision number and boundaries of each new property in its tab.
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

              {activeParcel >= 0 && subdivision ? (
                <>
                  <section className="sv-section">
                    <h3><PinIcon /> New property {activeParcel + 1} of {parcels.length} created at registration</h3>
                    <p className="sv-hint">Parent {record.property_ref} · S.No. {record.survey_no ?? '—'}{record.subdivision_no ? `/${record.subdivision_no}` : ''} · {record.extent_value ?? '—'} {areaUnitLabel(record.extent_unit, areaUnits)} (now inactive). Owners come from the transaction and can't be changed here. Update the survey number, subdivision, extent and boundaries of this property.</p>
                    {parcels.map((pc, i) => i !== activeParcel ? null : (
                      <div key={pc.propertyRef} className="sv-parcel">
                        <div className="sv-section-head">
                          <h4>Property {i + 1} · {pc.propertyRef}{pc.surveyNo ? ` · S.No. ${pc.surveyNo}${pc.subdivisionNo ? `/${pc.subdivisionNo}` : ''}` : ''}</h4>
                          <span className={`sv-side ${pc.side === 'SIDE_2' ? 'buyer' : 'seller'}`}>{partySideLabel(pc.side)}</span>
                        </div>
                        <p className="sv-hint">Owner: <b>{pc.owners || '—'}</b>{pc.tokenRef ? ` · Token ${pc.tokenRef}` : ''}</p>
                        <div className="sv-grid4">
                          <label><span>Survey no</span><input value={pc.surveyNo} onChange={(e) => updateParcel(i, { surveyNo: e.target.value })} /></label>
                          <label><span>Subdivision no</span><input value={pc.subdivisionNo} placeholder="e.g. 2A" onChange={(e) => updateParcel(i, { subdivisionNo: e.target.value })} /></label>
                          <label><span>Extent</span><input type="number" step="any" min="0" value={pc.extent} onChange={(e) => updateParcel(i, { extent: e.target.value })} /></label>
                          <label><span>Unit</span>
                            <select value={pc.unit} onChange={(e) => updateParcel(i, { unit: e.target.value })}>
                              {areaUnits.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="sv-grid4">
                          {SIDES.map((side) => (
                            <label key={side}><span>{side[0].toUpperCase() + side.slice(1)}</span><input value={pc[side]} onChange={(e) => updateParcel(i, { [side]: e.target.value })} /></label>
                          ))}
                        </div>
                        <div className="sv-grid4">
                          <label><span>North → South length (ft)</span><input type="number" step="any" min="0" value={pc.northSouth} onChange={(e) => updateParcel(i, { northSouth: e.target.value })} /></label>
                          <label><span>East → West length (ft)</span><input type="number" step="any" min="0" value={pc.eastWest} onChange={(e) => updateParcel(i, { eastWest: e.target.value })} /></label>
                        </div>
                        <p className="sv-hint">These values replace the new property's extent, boundaries and measurements. Leave the lengths blank to keep the measurements copied from the parent.</p>
                      </div>
                    ))}
                    <div className="sv-parcel-total">
                      <span>New properties total: <b>{parcelTotal == null ? '—' : `${Number(parcelTotal.toFixed(4))} ${areaUnitLabel(unit, areaUnits)}`}</b> · measured {extentNum ?? '—'} {areaUnitLabel(unit, areaUnits)}</span>
                    </div>
                  </section>
                </>
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
              <button className="sv-submit" disabled={busy} onClick={() => void submit()}>
                <CheckCircleIcon /> {subdivision && !partitionDeed ? 'Submit Survey & Forward to Tahsildar' : 'Submit Survey & Forward to VAO'}
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

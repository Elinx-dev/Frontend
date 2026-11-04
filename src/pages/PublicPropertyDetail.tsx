import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import type { Row } from '../types'
import { Banner } from '../ui'
import PropertyDetailsView from './PropertyDetailsView'

/** Citizen view: the public record only (no Aadhaar, PAN, mobile, address or consideration). */
export default function PublicPropertyDetail() {
  const { propertyRef = '' } = useParams()
  const [property, setProperty] = useState<Row | null>(null)
  const [history, setHistory] = useState<Row[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const row = await get<Row>(`/api/public/properties/${encodeURIComponent(propertyRef)}`)
        const owners = Array.isArray(row.registered_owners) ? (row.registered_owners as Row[]) : []
        setProperty({ ...row, status: row.property_status, registeredOwners: owners.map((owner) => ({ owner_name: owner.name })) })
        if (row.token_ref) setHistory(await get<Row[]>(`/api/public/tokens/${encodeURIComponent(String(row.token_ref))}/history`))
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e))
      }
    })()
  }, [propertyRef])

  if (property === null) return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  return <PropertyDetailsView property={property} history={history} publicView backTo="/public" backLabel="← Back to search" />
}

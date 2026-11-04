import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner } from '../ui'
import PropertyDetailsView from './PropertyDetailsView'

export default function PropertyDetail() {
  const { propertyRef = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [property, setProperty] = useState<Row | null>(null)
  const [lineage, setLineage] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setProperty(await get<Row>(`/api/properties/${encodeURIComponent(propertyRef)}`))
      setLineage(await get<Row>(`/api/lineage?propertyRef=${encodeURIComponent(propertyRef)}`).catch(() => null))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [propertyRef])

  useEffect(() => {
    void load()
  }, [load])

  if (property === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }
  const canCreate = user?.permissions.includes('TXN_CREATE') === true && property.status === 'ACTIVE'
  return (
    <PropertyDetailsView
      property={property}
      lineage={lineage}
      actions={canCreate ? (
        <button type="button" className="primary" onClick={() => navigate(`/transactions/new?propertyRef=${encodeURIComponent(propertyRef)}`)}>Initiate transaction</button>
      ) : undefined}
    />
  )
}

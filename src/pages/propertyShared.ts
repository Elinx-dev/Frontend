import { useEffect, useState } from 'react'

import { str, type Bootstrap, type Row } from '../types'

export type SelectOption = { value: string; label: string }

export const labelFor = (options: SelectOption[], code: string) => options.find((option) => option.value === code)?.label ?? code

export function jurisdictionOptions(
  rows: Row[],
  codeKey: string,
  labelKey: string,
  matches: Array<(row: Row) => boolean>,
): SelectOption[] {
  const seen = new Set<string>()
  const options: SelectOption[] = []
  rows.forEach((row) => {
    if (!matches.every((match) => match(row))) return
    const value = str(row, codeKey)
    if (value.length === 0 || seen.has(value)) return
    seen.add(value)
    options.push({ value, label: str(row, labelKey) || value })
  })
  return options
}

export type OwnerFormKind = 'INDIVIDUAL' | 'DEFAULT' | 'COMPANY' | 'PARTNERSHIP_FIRM' | 'HUF' | 'LLP' | 'TRUST'
export interface OwnerLayout {
  nameLabel: string
  panLabel: string
  addressLabel: string
  aadhaar: boolean
  mobile: boolean
  registration?: { label: string; kind: 'CIN' | 'LLPIN' | 'TEXT'; placeholder?: string }
  representative?: { title: string; designation: boolean; mobile: boolean }
}
export interface OwnerTypeOption { value: string; label: string; allowMultipleOwners: boolean }
export const ownerTypes: Array<OwnerTypeOption & { form: OwnerFormKind }> = [
  { value: 'INDIVIDUAL', label: 'Individual', form: 'INDIVIDUAL', allowMultipleOwners: true },
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'PARTNERSHIP_FIRM', label: 'Partnership Firm', form: 'PARTNERSHIP_FIRM', allowMultipleOwners: false },
  { value: 'HUF', label: 'HUF', form: 'HUF', allowMultipleOwners: false },
  { value: 'LLP', label: 'LLP', form: 'LLP', allowMultipleOwners: false },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'ONE_PERSON_COMPANY', label: 'One Person Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'TRUST', label: 'Trust', form: 'TRUST', allowMultipleOwners: false },
  { value: 'SOCIETY', label: 'Society / Co-operative Society', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'AOP_BOI', label: 'Association of Persons / Body of Individuals', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'GOVERNMENT', label: 'Government / Government Department / Local Authority', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'OTHER_LEGAL_ENTITY', label: 'Other Legal Entity', form: 'DEFAULT', allowMultipleOwners: true },
]
export const ownerLayouts: Record<OwnerFormKind, OwnerLayout> = {
  INDIVIDUAL: { nameLabel: 'Name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: true, mobile: true },
  DEFAULT: { nameLabel: 'Name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: true, mobile: true },
  COMPANY: {
    nameLabel: 'Company name', panLabel: 'PAN', addressLabel: 'Registered address', aadhaar: false, mobile: false,
    registration: { label: 'CIN', kind: 'CIN', placeholder: 'U12345TN2020PTC123456' },
    representative: { title: 'Authorised signatory', designation: true, mobile: true },
  },
  PARTNERSHIP_FIRM: {
    nameLabel: 'Firm name', panLabel: 'Firm PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    registration: { label: 'Registration no.', kind: 'TEXT' },
    representative: { title: 'Authorised partner', designation: false, mobile: true },
  },
  HUF: {
    nameLabel: 'HUF name', panLabel: 'HUF PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    representative: { title: 'Karta', designation: false, mobile: false },
  },
  LLP: {
    nameLabel: 'LLP name', panLabel: 'PAN', addressLabel: 'Registered address', aadhaar: false, mobile: false,
    registration: { label: 'LLPIN', kind: 'LLPIN', placeholder: 'AAA-1234' },
    representative: { title: 'Authorised partner', designation: false, mobile: true },
  },
  TRUST: {
    nameLabel: 'Trust name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    registration: { label: 'Registration no.', kind: 'TEXT' },
    representative: { title: 'Trustee / Authorised trustee', designation: false, mobile: true },
  },
}
export const ownerLayout = (ownerTypeCode: string) => ownerLayouts[ownerTypes.find((type) => type.value === ownerTypeCode)?.form ?? 'DEFAULT']

export const CITY_CENTER = { latitude: 13.0827, longitude: 80.2707 }

export const boundaryPoints = [
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
  { value: 'EAST', label: 'East' },
  { value: 'WEST', label: 'West' },
  { value: 'NORTH_EAST', label: 'North-east' },
  { value: 'NORTH_WEST', label: 'North-west' },
  { value: 'SOUTH_EAST', label: 'South-east' },
  { value: 'SOUTH_WEST', label: 'South-west' },
]

export type MapLocation = typeof CITY_CENTER
export type MapStatus = 'fallback' | 'loading' | 'located'

export const mapEmbedUrl = ({ latitude, longitude }: MapLocation) => {
  const west = longitude - 0.025
  const east = longitude + 0.025
  const south = latitude - 0.018
  const north = latitude + 0.018
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${latitude}%2C${longitude}`
}

export const propertyTypeFallback: SelectOption[] = [{ value: 'LAND', label: 'Land Parcel' }, { value: 'HOUSE_SITE', label: 'House Site' }, { value: 'BUILDING', label: 'Building' }, { value: 'APARTMENT_UNIT', label: 'Apartment / Flat' }, { value: 'AGRICULTURAL', label: 'Agricultural Land' }, { value: 'COMMERCIAL', label: 'Commercial' }, { value: 'INDUSTRIAL', label: 'Industrial' }, { value: 'PLOT_SITE', label: 'Plot / Site' }]
export const natureOfTitleOptions: SelectOption[] = [{ value: 'FREEHOLD', label: 'Freehold' }, { value: 'LEASEHOLD', label: 'Leasehold' }]
export const landTypeOptions: SelectOption[] = [{ value: 'RURAL', label: 'Rural' }, { value: 'URBAN', label: 'Urban' }]
export const classificationOptions: SelectOption[] = [{ value: 'Dry', label: 'Dry' }, { value: 'Wet', label: 'Wet' }]
export const extentUnitFallback: SelectOption[] = [{ value: 'SQ_FT', label: 'Square Feet' }, { value: 'SQ_M', label: 'Square Metres' }, { value: 'CENT', label: 'Cent' }, { value: 'ACRE', label: 'Acre' }, { value: 'HECTARE', label: 'Hectare' }]

export function optionsFrom(bootstrap: Bootstrap | null | undefined, key: string, fallback: SelectOption[]): SelectOption[] {
  const rows = bootstrap?.optionSets[key] ?? []
  const mapped = rows.map((row) => ({ value: String(row.code ?? row.value ?? ''), label: String(row.name ?? row.label ?? row.code ?? row.value ?? '') })).filter((row) => row.value)
  return mapped.length > 0 ? mapped : fallback
}

export function usePropertyMap({ doorNo, street, village, taluk, district }: { doorNo: string; street: string; village: string; taluk: string; district: string }) {
  const [mapLocation, setMapLocation] = useState<MapLocation>(CITY_CENTER)
  const [mapStatus, setMapStatus] = useState<MapStatus>('fallback')
  const [mapLocationName, setMapLocationName] = useState('Chennai, Tamil Nadu')

  useEffect(() => {
    const hasLocationDetails = [village, taluk, street, doorNo]
      .some((value) => value.trim().length > 0)
    if (!hasLocationDetails) {
      setMapLocation(CITY_CENTER)
      setMapLocationName('Chennai, Tamil Nadu')
      setMapStatus('fallback')
      return
    }

    const query = [
      doorNo,
      street,
      village,
      taluk,
      district,
      'Tamil Nadu',
      'India',
    ].filter((part) => part.trim().length > 0).join(', ')
    const controller = new AbortController()
    setMapStatus('loading')
    const timeout = window.setTimeout(() => {
      void fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Location search failed')
          return await response.json() as Array<{ lat: string; lon: string; display_name: string }>
        })
        .then((results) => {
          const result = results[0]
          if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
            setMapLocation(CITY_CENTER)
            setMapLocationName('Chennai, Tamil Nadu')
            setMapStatus('fallback')
            return
          }
          setMapLocation({ latitude: Number(result.lat), longitude: Number(result.lon) })
          setMapLocationName(result.display_name)
          setMapStatus('located')
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          setMapLocation(CITY_CENTER)
          setMapLocationName('Chennai, Tamil Nadu')
          setMapStatus('fallback')
        })
    }, 1000)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [district, doorNo, street, taluk, village])

  return { mapLocation, mapLocationName, mapStatus }
}

export const displayValue = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value))

export const maskAadhaar = (value: unknown) => {
  const digits = value === null || value === undefined ? '' : String(value)
  return /^\d{12}$/.test(digits) ? `XXXX XXXX ${digits.slice(8)}` : displayValue(value)
}

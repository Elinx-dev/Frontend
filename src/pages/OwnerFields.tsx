import type { Row } from '../types'
import { Field } from '../ui'
import {
  digits, displayValue, maskAadhaarLast4, panValue,
  type OwnerField, type OwnerFieldErrors, type OwnerForm, type OwnerLayout,
} from './propertyShared'

const noop = () => undefined

/** Editable owner / party fields for the selected owner type, as on the Mint Property owner tab. */
export function OwnerFields({
  layout,
  owner,
  errors,
  onChange,
}: {
  layout: OwnerLayout
  owner: OwnerForm
  errors?: OwnerFieldErrors
  onChange: (field: OwnerField, value: string) => void
}) {
  const error = (field: OwnerField) => errors?.[field] ? <span className="field-error">{errors[field]}</span> : null
  const registration = layout.registration
  const representative = layout.representative
  return <>
    <div className="owner-fields">
      <div><Field label={layout.nameLabel} value={owner.ownerName} onChange={(v) => onChange('ownerName', v)} required />{error('ownerName')}</div>
      {registration ? <div><Field label={registration.label} value={owner.registrationNo} onChange={(v) => onChange('registrationNo', registration.kind === 'TEXT' ? v : v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, registration.kind === 'CIN' ? 21 : 8))} placeholder={registration.placeholder} required />{error('registrationNo')}</div> : null}
      {layout.aadhaar ? <div><Field label="Aadhaar (12 digits)" value={owner.aadhaarNumber} onChange={(v) => onChange('aadhaarNumber', digits(v, 12))} required />{error('aadhaarNumber')}</div> : null}
      <div><Field label={layout.panLabel} value={owner.pan} onChange={(v) => onChange('pan', panValue(v))} placeholder="ABCDE1234F" required />{error('pan')}</div>
      {layout.mobile ? <div><Field label="Mobile" type="tel" value={owner.mobile} onChange={(v) => onChange('mobile', digits(v, 10))} required />{error('mobile')}</div> : null}
      <div><Field label={layout.addressLabel} value={owner.address} onChange={(v) => onChange('address', v)} required />{error('address')}</div>
    </div>
    {representative ? <div className="owner-representative">
      <h4>{representative.title}</h4>
      <div className="owner-fields">
        <div><Field label="Name" value={owner.repName} onChange={(v) => onChange('repName', v)} required />{error('repName')}</div>
        {representative.designation ? <div><Field label="Designation" value={owner.repDesignation} onChange={(v) => onChange('repDesignation', v)} required />{error('repDesignation')}</div> : null}
        <div><Field label="Aadhaar (12 digits)" value={owner.repAadhaar} onChange={(v) => onChange('repAadhaar', digits(v, 12))} required />{error('repAadhaar')}</div>
        <div><Field label="PAN" value={owner.repPan} onChange={(v) => onChange('repPan', panValue(v))} placeholder="ABCDE1234F" required />{error('repPan')}</div>
        {representative.mobile ? <div><Field label="Mobile" type="tel" value={owner.repMobile} onChange={(v) => onChange('repMobile', digits(v, 10))} required />{error('repMobile')}</div> : null}
      </div>
    </div> : null}
  </>
}

/** Read-only transaction party, labelled by its owner (buyer) type. */
export function PartyDetailsView({ layout, party, relationship }: { layout: OwnerLayout; party: Row; relationship?: string }) {
  const view = (label: string, value: unknown) => <Field label={label} value={displayValue(value)} onChange={noop} readOnly />
  const representative = layout.representative
  return <>
    <div className="owner-fields">
      {view(layout.nameLabel, party.name)}
      {layout.registration ? view(layout.registration.label, party.registration_no) : null}
      {layout.aadhaar ? view('Aadhaar', maskAadhaarLast4(party.aadhaar_number, party.aadhaar_last4)) : null}
      {view(layout.panLabel, party.pan)}
      {layout.mobile ? view('Mobile', party.mobile) : null}
      {view(layout.addressLabel, party.address)}
      {relationship !== undefined ? view('Relationship', relationship) : null}
    </div>
    {representative ? <div className="owner-representative">
      <h4>{representative.title}</h4>
      <div className="owner-fields">
        {view('Name', party.representative_name ?? party.karta_name)}
        {representative.designation ? view('Designation', party.representative_designation) : null}
        {view('Aadhaar', maskAadhaarLast4(party.representative_aadhaar, party.representative_aadhaar_last4))}
        {view('PAN', party.representative_pan)}
        {representative.mobile ? view('Mobile', party.representative_mobile) : null}
      </div>
    </div> : null}
  </>
}

import { useAuth } from '../auth'
import { DataTable, Panel } from '../ui'

export default function Profile() {
  const { user } = useAuth()
  if (user === null) return null
  return (
    <>
      <Panel title="My profile">
        <dl className="kv">
          <dt>Username</dt>
          <dd>{user.username}</dd>
          <dt>Name</dt>
          <dd>{user.fullName}</dd>
          <dt>Designation</dt>
          <dd>{user.designation ?? '—'}</dd>
          <dt>Department</dt>
          <dd>{user.department ?? '—'}</dd>
          <dt>Email</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt>Mobile</dt>
          <dd>{user.mobile ?? '—'}</dd>
          <dt>State</dt>
          <dd>{user.stateCode}</dd>
          <dt>Roles</dt>
          <dd>{user.roles.join(', ')}</dd>
        </dl>
      </Panel>
      <Panel title="Jurisdictions">
        <DataTable
          rows={user.jurisdictions ?? []}
          columns={[
            { key: 'district_code', label: 'District' },
            { key: 'taluk_code', label: 'Taluk' },
            { key: 'village_code', label: 'Village' },
            { key: 'sro_code', label: 'SRO' },
          ]}
          empty="No jurisdiction assignments."
        />
      </Panel>
      <Panel title="Permissions">
        <p className="chips">
          {user.permissions.map((p) => (
            <span className="chip" key={p}>
              {p}
            </span>
          ))}
        </p>
      </Panel>
    </>
  )
}

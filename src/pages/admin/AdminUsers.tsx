import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { get, post, put } from '../../api'
import { useAuth } from '../../auth'
import { Banner, Panel, StatusPill } from '../../ui'
import { DEPARTMENTS, errorText, humanize, useAdminSnapshot } from './adminConfig'
import { AdminHeader, SearchBox, Segmented, StatCard, Switch } from './shared'

interface AdminUser {
  id: number
  username: string
  full_name: string
  email?: string | null
  mobile?: string | null
  designation?: string | null
  department: string
  status: string
  mfa_required: boolean
  roles: string[]
}

interface Role {
  code: string
  name: string
  department: string
  description?: string | null
}

interface UserForm {
  username: string
  fullName: string
  email: string
  mobile: string
  designation: string
  department: string
  status: string
  mfaRequired: boolean
  password: string
  roles: string[]
}

type FormErrors = Partial<Record<keyof UserForm, string>>

const EMPTY_FORM: UserForm = {
  username: '', fullName: '', email: '', mobile: '', designation: '', department: 'REGISTRATION',
  status: 'ACTIVE', mfaRequired: true, password: '', roles: [],
}

const STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'DISABLED', label: 'Disabled' },
] as const

const STATUS_FILTERS = [{ value: 'ALL', label: 'All' }, ...STATUSES] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE = /^\+?[0-9][0-9 -]{6,18}[0-9]$/

function validate(form: UserForm, creating: boolean): FormErrors {
  const errors: FormErrors = {}
  if (form.username.trim().length === 0) errors.username = 'Enter a username.'
  if (form.fullName.trim().length === 0) errors.fullName = 'Enter the full name.'
  if (form.email.trim().length > 0 && !EMAIL.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.mobile.trim().length > 0 && !MOBILE.test(form.mobile.trim())) errors.mobile = 'Enter a valid phone number.'
  if (creating && form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (form.roles.length === 0) errors.roles = 'Select at least one role.'
  return errors
}

function initials(name: string) {
  return name.split(/\s+/).filter((part) => part.length > 0).slice(0, 2).map((part) => part[0].toUpperCase()).join('')
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const { snapshot } = useAdminSnapshot()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['value']>('ALL')
  const [roleFilter, setRoleFilter] = useState('')
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const load = async () => {
    try {
      const result = await get<{ users: AdminUser[]; roles: Role[] }>('/api/admin/users')
      setUsers(result.users)
      setRoles(result.roles)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const roleName = useMemo(() => new Map(roles.map((role) => [role.code, role.name])), [roles])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) =>
      (statusFilter === 'ALL' || u.status === statusFilter)
      && (roleFilter.length === 0 || u.roles.includes(roleFilter))
      && (term.length === 0 || [u.full_name, u.username, u.email, u.mobile, u.designation, u.department]
        .some((value) => (value ?? '').toLowerCase().includes(term))))
  }, [users, search, statusFilter, roleFilter])

  const count = (status: string) => users.filter((u) => u.status === status).length

  const saved = async (message: string) => {
    setEditing(null)
    setInfo(message)
    setError('')
    await load()
  }

  return (
    <div className="dashboard-page adm-page">
      <AdminHeader
        title="User administration"
        stateName={snapshot?.state?.state_name}
        subtitle="Create officer accounts, assign roles and control sign-in access."
        actions={<button className="primary" onClick={() => { setInfo(''); setEditing('new') }}>+ Add user</button>}
      />
      <Banner kind="error" message={error} />
      <Banner kind="success" message={info} />

      <div className="adm-stats">
        <StatCard label="Total users" value={users.length} />
        <StatCard label="Active" value={count('ACTIVE')} tone="success" />
        <StatCard label="Locked" value={count('LOCKED')} tone="warning" />
        <StatCard label="Disabled" value={count('DISABLED')} tone="danger" />
      </div>

      <Panel title="Users" actions={<span className="muted">{visible.length} of {users.length} shown</span>}>
        <div className="adm-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, username, email or phone" />
          <label className="ad-filter">
            <span>Role</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
            </select>
          </label>
          <div className="ad-filter">
            <span>Status</span>
            <Segmented label="Status filter" value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} />
          </div>
        </div>
        {loading ? <p className="muted">Loading users…</p> : visible.length === 0 ? (
          <p className="adm-empty">No users match these filters.</p>
        ) : (
          <div className="ad-table-scroll">
            <table className="grid adm-users">
              <thead><tr><th>User</th><th>Contact</th><th>Department</th><th>Roles</th><th>MFA</th><th>Status</th><th /></tr></thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="clickable" onClick={() => { setInfo(''); setEditing(u) }}>
                    <td>
                      <div className="adm-user-cell">
                        <span className="adm-avatar">{initials(u.full_name)}</span>
                        <div><strong>{u.full_name}</strong><span className="cell-subtext">{u.username}{u.designation ? ` · ${u.designation}` : ''}</span></div>
                      </div>
                    </td>
                    <td>{u.email ?? '—'}<span className="cell-subtext">{u.mobile ?? 'No phone'}</span></td>
                    <td>{humanize(u.department)}</td>
                    <td><div className="chips">{u.roles.map((code) => <span className="chip" key={code} title={code}>{roleName.get(code) ?? code}</span>)}</div></td>
                    <td><span className={u.mfa_required ? 'adm-badge on' : 'adm-badge'}>{u.mfa_required ? 'Required' : 'Off'}</span></td>
                    <td><StatusPill status={u.status} /></td>
                    <td className="num"><button className="outline" onClick={(e) => { e.stopPropagation(); setInfo(''); setEditing(u) }}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing !== null ? (
        <UserDrawer
          user={editing === 'new' ? null : editing}
          roles={roles}
          isSelf={editing !== 'new' && editing.id === currentUser?.id}
          onClose={() => setEditing(null)}
          onSaved={(message) => void saved(message)}
        />
      ) : null}
    </div>
  )
}

function UserDrawer({ user, roles, isSelf, onClose, onSaved }: {
  user: AdminUser | null
  roles: Role[]
  isSelf: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const creating = user === null
  const [form, setForm] = useState<UserForm>(() => user === null ? EMPTY_FORM : {
    username: user.username, fullName: user.full_name, email: user.email ?? '', mobile: user.mobile ?? '',
    designation: user.designation ?? '', department: user.department, status: user.status,
    mfaRequired: user.mfa_required, password: '', roles: user.roles,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const change = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const toggleRole = (code: string) => change('roles', form.roles.includes(code) ? form.roles.filter((r) => r !== code) : [...form.roles, code])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(form, creating)
    setErrors(found)
    if (Object.values(found).some((message) => message !== undefined)) return
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, username: form.username.trim(), fullName: form.fullName.trim(), password: form.password.length === 0 ? undefined : form.password }
      if (creating) await post('/api/admin/users', payload, true)
      else await put(`/api/admin/users/${user.id}`, payload)
      onSaved(creating ? `User ${payload.username} created.` : `User ${payload.username} updated.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="adm-drawer-backdrop" onClick={onClose}>
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby="adm-drawer-title" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <header className="adm-drawer-head">
            <div>
              <span className="eyebrow">{creating ? 'New account' : 'Edit account'}</span>
              <h2 id="adm-drawer-title">{creating ? 'Add user' : form.fullName || user.username}</h2>
            </div>
            <button type="button" className="adm-close" aria-label="Close" onClick={onClose}>×</button>
          </header>

          <div className="adm-drawer-body">
            <Banner kind="error" message={error} />

            <section className="adm-form-section">
              <h3>Account</h3>
              <div className="form-grid two">
                <TextField label="Username" value={form.username} onChange={(v) => change('username', v)} error={errors.username} required disabled={!creating} hint={creating ? 'Used to sign in. It cannot be changed later.' : 'Usernames cannot be changed.'} autoComplete="off" />
                <TextField label="Full name" value={form.fullName} onChange={(v) => change('fullName', v)} error={errors.fullName} required />
              </div>
              {creating ? (
                <label className="field">
                  <span>Temporary password <b className="req">*</b></span>
                  <div className="adm-input-action">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => change('password', e.target.value)} autoComplete="new-password" aria-invalid={errors.password !== undefined} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
                  </div>
                  {errors.password !== undefined ? <span className="field-error">{errors.password}</span> : <small className="adm-hint">At least 8 characters. Share it with the user securely.</small>}
                </label>
              ) : null}
            </section>

            <section className="adm-form-section">
              <h3>Contact and posting</h3>
              <div className="form-grid two">
                <TextField label="Email" type="email" value={form.email} onChange={(v) => change('email', v)} error={errors.email} placeholder="name@department.gov.in" />
                <TextField label="Phone" type="tel" value={form.mobile} onChange={(v) => change('mobile', v)} error={errors.mobile} placeholder="+91 98765 43210" />
                <TextField label="Designation" value={form.designation} onChange={(v) => change('designation', v)} placeholder="e.g. Sub-Registrar" />
                <label className="field">
                  <span>Department <b className="req">*</b></span>
                  <select value={form.department} onChange={(e) => change('department', e.target.value)}>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="adm-form-section">
              <h3>Access</h3>
              <div className="adm-setting">
                <div><strong>Account status</strong><span>Locked and disabled users cannot sign in.</span></div>
                <Segmented label="Account status" value={form.status} options={STATUSES} onChange={(v) => change('status', v)} />
              </div>
              <div className="adm-setting">
                <div><strong>Multi-factor authentication</strong><span>Ask for a one-time code at every sign-in.</span></div>
                <Switch label="Multi-factor authentication" checked={form.mfaRequired} onChange={(v) => change('mfaRequired', v)} />
              </div>
            </section>

            <section className="adm-form-section">
              <h3>Roles <b className="req">*</b> <span className="muted">{form.roles.length} selected</span></h3>
              {errors.roles !== undefined ? <span className="field-error">{errors.roles}</span> : null}
              <div className="adm-role-grid">
                {roles.map((role) => {
                  const selected = form.roles.includes(role.code)
                  const locked = isSelf && role.code === 'STATE_ADMIN'
                  return (
                    <label key={role.code} className={selected ? 'adm-role selected' : 'adm-role'} title={locked ? 'You cannot remove your own administrator role.' : undefined}>
                      <input type="checkbox" checked={selected} disabled={locked} onChange={() => toggleRole(role.code)} />
                      <span>
                        <strong>{role.name}</strong>
                        <small>{role.description ?? role.code}</small>
                        <em>{humanize(role.department)}</em>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          </div>

          <footer className="adm-drawer-foot">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : creating ? 'Create user' : 'Save changes'}</button>
          </footer>
        </form>
      </aside>
    </div>
  )
}

function TextField({ label, value, onChange, error, hint, required = false, disabled = false, type = 'text', placeholder, autoComplete }: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="field">
      <span>{label}{required ? <b className="req"> *</b> : null}</span>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={error !== undefined} onChange={(e) => onChange(e.target.value)} />
      {error !== undefined ? <span className="field-error">{error}</span> : hint !== undefined ? <small className="adm-hint">{hint}</small> : null}
    </label>
  )
}

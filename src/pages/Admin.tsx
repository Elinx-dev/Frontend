import { useEffect, useState } from 'react'

import { ApiError, get, post, put } from '../api'
import type { Row } from '../types'
import { Banner, Field, Panel, StatusPill } from '../ui'

interface AdminUser {
  id: number
  username: string
  full_name: string
  email: string | null
  mobile: string | null
  designation: string | null
  department: string
  status: string
  mfa_required: boolean
  roles: string[]
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

const emptyUser: UserForm = {
  username: '', fullName: '', email: '', mobile: '', designation: '', department: 'ADMIN',
  status: 'ACTIVE', mfaRequired: true, password: '', roles: [],
}

const text = (row: Row, key: string) => row[key] === null || row[key] === undefined ? '' : String(row[key])

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'config'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [roles, setRoles] = useState<Row[]>([])
  const [form, setForm] = useState<UserForm>(emptyUser)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [config, setConfig] = useState<Row>({})
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e))
  const loadUsers = () => get<{ users: AdminUser[]; roles: Row[] }>('/api/admin/users')
    .then((result) => { setUsers(result.users); setRoles(result.roles) }).catch(fail)
  const loadConfig = () => get<Row>('/api/config/admin').then(setConfig).catch(fail)

  useEffect(() => { void loadUsers(); void loadConfig() }, [])

  const startAdd = () => { setEditingId(null); setForm(emptyUser); setError(''); setInfo('') }
  const startEdit = (user: AdminUser) => {
    setEditingId(user.id)
    setForm({ username: user.username, fullName: user.full_name, email: user.email ?? '', mobile: user.mobile ?? '',
      designation: user.designation ?? '', department: user.department, status: user.status,
      mfaRequired: user.mfa_required, password: '', roles: user.roles })
    setError(''); setInfo('')
  }
  const change = (key: keyof UserForm, value: string | boolean | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const toggleRole = (role: string) => change('roles', form.roles.includes(role) ? form.roles.filter((item) => item !== role) : [...form.roles, role])

  const saveUser = async () => {
    setError(''); setInfo('')
    try {
      if (form.roles.length === 0) throw new Error('Select at least one role.')
      const payload = { ...form, password: form.password.length === 0 ? undefined : form.password }
      if (editingId === null) await post('/api/admin/users', payload, true)
      else await put(`/api/admin/users/${editingId}`, payload)
      setInfo(editingId === null ? 'User created.' : 'User updated.')
      startAdd()
      await loadUsers()
    } catch (e) { fail(e) }
  }

  const updateModule = async (module: Row) => {
    try {
      await put(`/api/config/admin/modules/${encodeURIComponent(text(module, 'module'))}`, {
        enabled: Boolean(module.enabled), mode: text(module, 'mode'), ownerDepartment: text(module, 'owner_department'),
        slaDays: module.sla_days === null ? null : Number(module.sla_days), notes: text(module, 'notes'),
      })
      setInfo(`Module ${text(module, 'module')} updated.`); await loadConfig()
    } catch (e) { fail(e) }
  }
  const updateFlag = async (flag: Row) => {
    try {
      await put(`/api/config/admin/feature-flags/${encodeURIComponent(text(flag, 'flag_code'))}`, { enabled: Boolean(flag.enabled) })
      setInfo(`Feature flag ${text(flag, 'flag_code')} updated.`); await loadConfig()
    } catch (e) { fail(e) }
  }
  const updateWorkflow = async (workflow: Row) => {
    try {
      await put(`/api/config/admin/workflows/${text(workflow, 'id')}`, { status: text(workflow, 'status') })
      setInfo(`Workflow ${text(workflow, 'workflow_code')} updated.`); await loadConfig()
    } catch (e) { fail(e) }
  }

  const modules = (config.modules as Row[] | undefined) ?? []
  const flags = (config.featureFlags as Row[] | undefined) ?? []
  const workflows = (config.workflows as Row[] | undefined) ?? []
  const stateName = text((config.state as Row | undefined) ?? {}, 'state_name')

  return <>
    <div className="section-heading admin-heading"><div><p className="eyebrow">State administration</p><h1>Administration</h1></div><span className="muted">Manage access and live platform configuration</span></div>
    <div className="tabs" role="tablist"><button className={tab === 'users' ? 'tab active' : 'tab'} onClick={() => setTab('users')}>Users and roles</button><button className={tab === 'config' ? 'tab active' : 'tab'} onClick={() => setTab('config')}>Workflow and configuration</button></div>
    <Banner kind="error" message={error} /><Banner kind="success" message={info} />
    {tab === 'users' ? <>
      <Panel title={editingId === null ? 'Add user' : `Edit user ${form.username}`} actions={<button onClick={startAdd}>Clear</button>}>
        <div className="row">
          <Field label="Username" value={form.username} onChange={(value) => change('username', value)} required />
          <Field label="Full name" value={form.fullName} onChange={(value) => change('fullName', value)} required />
          <Field label="Email" value={form.email} onChange={(value) => change('email', value)} type="email" />
          <Field label="Phone" value={form.mobile} onChange={(value) => change('mobile', value)} />
          <Field label="Designation" value={form.designation} onChange={(value) => change('designation', value)} />
          <Field label="Department" value={form.department} onChange={(value) => change('department', value)} options={['REGISTRATION','SURVEY','REVENUE','ADMIN','PUBLIC'].map((value) => ({ value, label: value }))} />
          <Field label="Status" value={form.status} onChange={(value) => change('status', value)} options={['ACTIVE','LOCKED','DISABLED'].map((value) => ({ value, label: value }))} />
          {editingId === null ? <Field label="Temporary password" value={form.password} onChange={(value) => change('password', value)} type="password" required /> : null}
        </div>
        <label className="check"><input type="checkbox" checked={form.mfaRequired} onChange={(event) => change('mfaRequired', event.target.checked)} /> MFA required</label>
        <h3>Roles</h3><div className="role-list">{roles.map((role) => <label className="check" key={text(role, 'code')}><input type="checkbox" checked={form.roles.includes(text(role, 'code'))} onChange={() => toggleRole(text(role, 'code'))} /> <strong>{text(role, 'code')}</strong> <span className="muted">{text(role, 'name')}</span></label>)}</div>
        <div className="actions"><button className="primary" onClick={() => void saveUser()}>{editingId === null ? 'Create user' : 'Save user'}</button></div>
      </Panel>
      <Panel title={`Users in ${stateName}`}>
        <table className="grid"><thead><tr><th>User</th><th>Contact</th><th>Department</th><th>Roles</th><th>Status</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.full_name}</strong><br /><span className="muted">{user.username}</span></td><td>{user.email ?? '—'}<br />{user.mobile ?? '—'}</td><td>{user.department}</td><td><div className="chips">{user.roles.map((role) => <span className="chip" key={role}>{role}</span>)}</div></td><td><StatusPill status={user.status} /></td><td><button onClick={() => startEdit(user)}>Edit</button></td></tr>)}</tbody></table>
      </Panel>
    </> : <>
      <Panel title="State modules"><table className="grid"><thead><tr><th>Module</th><th>Mode</th><th>Enabled</th><th>Owner</th><th>SLA days</th><th>Notes</th><th /></tr></thead><tbody>{modules.map((module, index) => <tr key={text(module, 'id') || index}><td><strong>{text(module, 'module')}</strong></td><td><select value={text(module, 'mode')} onChange={(event) => { module.mode = event.target.value; setConfig({ ...config }) }}><option>FACILITATE</option><option>RECORD</option><option>DISABLED</option></select></td><td><input type="checkbox" checked={Boolean(module.enabled)} onChange={(event) => { module.enabled = event.target.checked; setConfig({ ...config }) }} /></td><td><input value={text(module, 'owner_department')} onChange={(event) => { module.owner_department = event.target.value; setConfig({ ...config }) }} /></td><td><input className="small-input" type="number" value={text(module, 'sla_days')} onChange={(event) => { module.sla_days = event.target.value; setConfig({ ...config }) }} /></td><td><input value={text(module, 'notes')} onChange={(event) => { module.notes = event.target.value; setConfig({ ...config }) }} /></td><td><button onClick={() => void updateModule(module)}>Save</button></td></tr>)}</tbody></table></Panel>
      <Panel title="Feature flags"><table className="grid"><thead><tr><th>Flag</th><th>Description</th><th>Enabled</th><th /></tr></thead><tbody>{flags.map((flag, index) => <tr key={text(flag, 'id') || index}><td><strong>{text(flag, 'flag_code')}</strong></td><td>{text(flag, 'description')}</td><td><input type="checkbox" checked={Boolean(flag.enabled)} onChange={(event) => { flag.enabled = event.target.checked; setConfig({ ...config }) }} /></td><td><button onClick={() => void updateFlag(flag)}>Save</button></td></tr>)}</tbody></table></Panel>
      <Panel title="Workflow definitions"><p className="muted">Workflow stages and transitions remain versioned in the database. Change the lifecycle status here; edit a published workflow by creating a new version.</p><table className="grid"><thead><tr><th>Deed type</th><th>Workflow</th><th>Version</th><th>Status</th><th /></tr></thead><tbody>{workflows.map((workflow, index) => <tr key={text(workflow, 'id') || index}><td>{text(workflow, 'deed_type_code')}</td><td>{text(workflow, 'workflow_code')}</td><td>{text(workflow, 'version')}</td><td><select value={text(workflow, 'status')} onChange={(event) => { workflow.status = event.target.value; setConfig({ ...config }) }}><option>DRAFT</option><option>PUBLISHED</option><option>RETIRED</option></select></td><td><button onClick={() => void updateWorkflow(workflow)}>Save</button></td></tr>)}</tbody></table></Panel>
    </>}
  </>
}

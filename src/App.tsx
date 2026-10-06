import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuthProvider, homeRouteFor, useAuth } from './auth'
import {
  AdminIcon,
  AuditIcon,
  CalendarIcon,
  ClockIcon,
  ShieldCheckIcon,
  DashboardIcon,
  FlagIcon,
  ListIcon,
  ModulesIcon,
  PropertyIcon,
  QueueIcon,
  SignOutIcon,
  TransferIcon,
  UsersIcon,
  WorkflowIcon,
} from './icons'
import AdminUsers from './pages/admin/AdminUsers'
import FeatureFlags from './pages/admin/FeatureFlags'
import StateModules from './pages/admin/StateModules'
import WorkflowDefinitions from './pages/admin/WorkflowDefinitions'
import AdminDashboard from './pages/AdminDashboard'
import AuditTrail from './pages/AuditTrail'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import Profile from './pages/Profile'
import PropertyCreate from './pages/PropertyCreate'
import PropertyDetail from './pages/PropertyDetail'
import PropertySearch from './pages/PropertySearch'
import PublicView from './pages/PublicView'
import RevenueQueue from './pages/RevenueQueue'
import SiteVisitPlan from './pages/vao/SiteVisitPlan'
import SlotBooking from './pages/vao/SlotBooking'
import VaoDashboard from './pages/vao/VaoDashboard'
import VerificationDetail from './pages/vao/VerificationDetail'
import VerificationQueue from './pages/vao/VerificationQueue'
import ResetPassword from './pages/ResetPassword'
import Survey from './pages/Survey'
import SurveyorQueue from './pages/SurveyorQueue'
import TransactionDetail from './pages/TransactionDetail'
import TransactionQueue from './pages/TransactionQueue'
import TransactionStart from './pages/TransactionStart'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (user === null) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (user === null) return <Navigate to="/login" replace />
  if (!user.roles.includes('STATE_ADMIN') && !user.roles.includes('CENTRAL_ADMIN')) return <Navigate to={homeRouteFor(user)} replace />
  return <Shell>{children}</Shell>
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (user === null) return null
  const has = (role: string) => user.roles.includes(role)
  const canAdminister = has('STATE_ADMIN') || has('CENTRAL_ADMIN')
  const adminState = new URLSearchParams(window.location.search).get('stateCode') ?? user.stateCode
  const adminStateQuery = `?stateCode=${encodeURIComponent(adminState)}`
  const isVao = has('VAO') && !canAdminister
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" to={homeRouteFor(user)}>
          <span className="brand-mark">S</span>
          <span className="brand-text">
            <strong>SLATE</strong>
            <small>Secured Land Asset Token Exchange</small>
          </span>
        </Link>
        {canAdminister ? <div className="side-section"><span>Overview</span><NavLink to={`/admin/dashboard${adminStateQuery}`}><DashboardIcon />{has('CENTRAL_ADMIN') ? 'Central Dashboard' : 'State Dashboard'}</NavLink></div> : null}
        {isVao ? (
          <div className="side-section">
            <div className="side-portal"><ShieldCheckIcon />VAO Officer Portal</div>
            <NavLink to="/vao" end><DashboardIcon />Dashboard</NavLink>
            <NavLink to="/vao/site-visits"><CalendarIcon />Site Visit Plan</NavLink>
            <NavLink to="/vao/slots"><ClockIcon />Slot Booking</NavLink>
            <NavLink to="/vao/verification"><ShieldCheckIcon />Verification Queue</NavLink>
            <NavLink to="/properties" end><ListIcon />Property List</NavLink>
          </div>
        ) : null}
        {isVao ? null : <div className="side-section">
          <span>Registration</span>
          {has('REGISTRATION_OFFICER') ? <NavLink to="/ro" end><DashboardIcon />Dashboard</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/properties/new"><PropertyIcon />Mint Property</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/transactions/new"><TransferIcon />Initiate Transaction</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <Link to="/ro"><QueueIcon />Pending Queue</Link> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/properties" end><ListIcon />Property List</NavLink> : null}
          <NavLink to={canAdminister ? `/audit${adminStateQuery}` : '/audit'}><AuditIcon />Audit Trail</NavLink>
        </div>}
        {canAdminister ? (
          <div className="side-section">
            <span>Administration</span>
            <div className="side-group" role="group" aria-labelledby="side-group-admin">
              <div className="side-group-title" id="side-group-admin"><AdminIcon />Users and configuration</div>
              <NavLink to={`/admin/users${adminStateQuery}`}><UsersIcon />User administration</NavLink>
              <NavLink to={`/admin/modules${adminStateQuery}`}><ModulesIcon />State modules</NavLink>
              <NavLink to={`/admin/feature-flags${adminStateQuery}`}><FlagIcon />Feature flags</NavLink>
              <NavLink to={`/admin/workflows${adminStateQuery}`}><WorkflowIcon />Workflow definitions</NavLink>
            </div>
          </div>
        ) : null}
        <div className="side-section">
          <span>Network</span>
          <p>Besu QBFT · chainId 2026<br />Block #18,442</p>
          <small className="network-up">● 4/4 validators up</small>
        </div>
        <button className="side-signout" onClick={() => void logout().then(() => navigate('/login'))}>
          <SignOutIcon />
          Sign out
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          {isVao ? <VaoBreadcrumb /> : <strong>{user.roles.includes('REGISTRATION_OFFICER') ? 'Registration Officer Dashboard' : 'SLATE Workspace'}</strong>}
          <div className="topbar-user">
            <div className="user-meta">{user.fullName} · {user.designation ?? user.roles[0]}<br />{user.department ?? 'State Administration'} · {user.stateCode}</div>
            <span className="avatar">{initials(user.fullName)}</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

const VAO_PAGES: [string, string][] = [
  ['/vao/site-visits', 'Site Visit Plan'],
  ['/vao/slots', 'Slot Booking'],
  ['/vao/verification', 'Verification Queue'],
  ['/properties', 'Property List'],
]

function VaoBreadcrumb() {
  const { pathname } = useLocation()
  const page = VAO_PAGES.find(([prefix]) => pathname.startsWith(prefix))
  const detail = pathname.startsWith('/vao/verification/') ? decodeURIComponent(pathname.split('/')[3] ?? '') : ''
  return (
    <nav className="topbar-crumbs" aria-label="Breadcrumb">
      <Link to="/vao">VAO Officer Portal</Link>
      {page === undefined ? null : <><span>›</span>{detail === '' ? <em>{page[1]}</em> : <Link to={page[0]}>{page[1]}</Link>}</>}
      {detail === '' ? null : <><span>›</span><em className="mono">{detail}</em></>}
    </nav>
  )
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function LandingRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  return <Navigate to={user === null ? '/login' : homeRouteFor(user)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/public" element={<PublicView />} />
          <Route path="/ro" element={<Protected><TransactionQueue /></Protected>} />
          <Route path="/audit" element={<Protected><AuditTrail /></Protected>} />
          <Route path="/properties" element={<Protected><PropertySearch /></Protected>} />
          <Route path="/properties/new" element={<Protected><PropertyCreate /></Protected>} />
          <Route path="/properties/:propertyRef" element={<Protected><PropertyDetail /></Protected>} />
          <Route path="/transactions/new" element={<Protected><TransactionStart /></Protected>} />
          <Route path="/transactions/:txnRef" element={<Protected><TransactionDetail /></Protected>} />
          <Route path="/surveyor" element={<Protected><SurveyorQueue /></Protected>} />
          <Route path="/survey/:txnRef" element={<Protected><Survey /></Protected>} />
          <Route path="/vao" element={<Protected><VaoDashboard /></Protected>} />
          <Route path="/vao/site-visits" element={<Protected><SiteVisitPlan /></Protected>} />
          <Route path="/vao/slots" element={<Protected><SlotBooking /></Protected>} />
          <Route path="/vao/verification" element={<Protected><VerificationQueue /></Protected>} />
          <Route path="/vao/verification/:txnRef" element={<Protected><VerificationDetail /></Protected>} />
          <Route path="/tahsildar" element={<Protected><RevenueQueue role="TAHSILDAR" /></Protected>} />
          <Route path="/admin/dashboard" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
          <Route path="/admin/modules" element={<AdminOnly><StateModules /></AdminOnly>} />
          <Route path="/admin/feature-flags" element={<AdminOnly><FeatureFlags /></AdminOnly>} />
          <Route path="/admin/workflows" element={<AdminOnly><WorkflowDefinitions /></AdminOnly>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

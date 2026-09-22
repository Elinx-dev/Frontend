import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuthProvider, homeRouteFor, useAuth } from './auth'
import {
  AdminIcon,
  AuditIcon,
  DashboardIcon,
  ListIcon,
  PropertyIcon,
  QueueIcon,
  SignOutIcon,
  TransferIcon,
} from './icons'
import Admin from './pages/Admin'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import Profile from './pages/Profile'
import PropertyCreate from './pages/PropertyCreate'
import PropertyDetail from './pages/PropertyDetail'
import PropertySearch from './pages/PropertySearch'
import PublicView from './pages/PublicView'
import RevenueQueue from './pages/RevenueQueue'
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

function AdminOnly() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (user === null) return <Navigate to="/login" replace />
  if (!user.roles.includes('STATE_ADMIN')) return <Navigate to={homeRouteFor(user)} replace />
  return <Shell><Admin /></Shell>
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (user === null) return null
  const has = (role: string) => user.roles.includes(role)
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
        <div className="side-section">
          <span>Registration</span>
          {has('REGISTRATION_OFFICER') ? <NavLink to="/ro"><DashboardIcon />Dashboard</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/properties/new"><PropertyIcon />Property Entry</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/transactions/new"><TransferIcon />Initiate Transaction</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/ro"><QueueIcon />Pending Queue</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/properties" end><ListIcon />Property List</NavLink> : null}
          {has('REGISTRATION_OFFICER') ? <NavLink to="/ro"><AuditIcon />Audit Trail</NavLink> : null}
        </div>
        {has('STATE_ADMIN') ? <div className="side-section"><span>Administration</span><NavLink to="/admin"><AdminIcon />Users and configuration</NavLink></div> : null}
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
          <strong>{user.roles.includes('REGISTRATION_OFFICER') ? 'Registration Officer Dashboard' : 'SLATE Workspace'}</strong>
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
          <Route path="/properties" element={<Protected><PropertySearch /></Protected>} />
          <Route path="/properties/new" element={<Protected><PropertyCreate /></Protected>} />
          <Route path="/properties/:propertyRef" element={<Protected><PropertyDetail /></Protected>} />
          <Route path="/transactions/new" element={<Protected><TransactionStart /></Protected>} />
          <Route path="/transactions/:txnRef" element={<Protected><TransactionDetail /></Protected>} />
          <Route path="/surveyor" element={<Protected><SurveyorQueue /></Protected>} />
          <Route path="/survey/:txnRef" element={<Protected><Survey /></Protected>} />
          <Route path="/vao" element={<Protected><RevenueQueue role="VAO" /></Protected>} />
          <Route path="/tahsildar" element={<Protected><RevenueQueue role="TAHSILDAR" /></Protected>} />
          <Route path="/admin" element={<AdminOnly />} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

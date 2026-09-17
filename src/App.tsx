import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuthProvider, homeRouteFor, useAuth } from './auth'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Profile from './pages/Profile'
import PropertyDetail from './pages/PropertyDetail'
import PropertySearch from './pages/PropertySearch'
import PublicView from './pages/PublicView'
import RevenueQueue from './pages/RevenueQueue'
import Survey from './pages/Survey'
import SurveyorQueue from './pages/SurveyorQueue'
import TransactionDetail from './pages/TransactionDetail'
import TransactionQueue from './pages/TransactionQueue'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (user === null) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (user === null) return null
  const has = (role: string) => user.roles.includes(role)
  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to={homeRouteFor(user)}>
          SLATE
        </Link>
        <nav>
          {has('REGISTRATION_OFFICER') ? <Link to="/ro">Registration</Link> : null}
          {has('REGISTRATION_OFFICER') ? <Link to="/properties">Properties</Link> : null}
          {has('SURVEYOR') ? <Link to="/surveyor">Survey</Link> : null}
          {has('VAO') ? <Link to="/vao">VAO</Link> : null}
          {has('TAHSILDAR') ? <Link to="/tahsildar">Tahsildar</Link> : null}
          {has('STATE_ADMIN') ? <Link to="/admin">Admin</Link> : null}
          <Link to="/public">Public</Link>
          <Link to="/profile">{user.fullName}</Link>
        </nav>
        <button
          className="link"
          onClick={() => {
            void logout().then(() => navigate('/login'))
          }}
        >
          Sign out
        </button>
      </header>
      <main>{children}</main>
    </div>
  )
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
          <Route path="/public" element={<PublicView />} />
          <Route path="/ro" element={<Protected><TransactionQueue /></Protected>} />
          <Route path="/properties" element={<Protected><PropertySearch /></Protected>} />
          <Route path="/properties/:propertyRef" element={<Protected><PropertyDetail /></Protected>} />
          <Route path="/transactions/:txnRef" element={<Protected><TransactionDetail /></Protected>} />
          <Route path="/surveyor" element={<Protected><SurveyorQueue /></Protected>} />
          <Route path="/survey/:txnRef" element={<Protected><Survey /></Protected>} />
          <Route path="/vao" element={<Protected><RevenueQueue role="VAO" /></Protected>} />
          <Route path="/tahsildar" element={<Protected><RevenueQueue role="TAHSILDAR" /></Protected>} />
          <Route path="/admin" element={<Protected><Admin /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

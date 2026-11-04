import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

import slateMark from '../assets/slate-mark-light.png'

/** Header for the no-login public pages: the same SLATE brand bar as the signed-in modules. */
export default function PublicShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="brand public-brand" to="/public">
          <img className="brand-mark" src={slateMark} alt="SLATE logo" />
          <span className="brand-text">
            <strong>SLATE</strong>
            <small>Secured Land Asset Token Exchange</small>
          </span>
        </Link>
        <nav className="public-nav" aria-label="Public pages">
          <NavLink to="/public" end>Property search</NavLink>
          <Link to="/login" className="public-signin">Officer sign in</Link>
        </nav>
      </header>
      <div className="public-titlebar">
        <strong>{title}</strong>
        <span>Public view · Tamil Nadu land records</span>
      </div>
      <main className="public-main">{children}</main>
    </div>
  )
}

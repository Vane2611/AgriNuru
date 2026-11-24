import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthPageLayoutProps = {
  children: ReactNode
  page: 'login' | 'register'
}

export function AuthPageLayout({ children, page }: AuthPageLayoutProps) {
  return (
    <main className={`auth-page auth-page--${page}`}>
      <section aria-label="Grinab account" className="auth-form-side">
        <Link aria-label="Grinab home" className="auth-brand" to="/login">
          <span aria-hidden="true" className="auth-brand-mark">
            <i className="bi bi-leaf-fill" />
          </span>
          <span>Grinab</span>
        </Link>
        <div className="auth-form-content">{children}</div>
        <p className="auth-form-footer">
          Practical information for the decisions behind every harvest.
        </p>
      </section>

      <aside aria-hidden="true" className="auth-story-side">
        <div className="auth-story-topline">
          <span className="auth-story-rule" />
          <span>GROW WITH CLARITY</span>
        </div>
        <div className="auth-story-copy">
          <div className="auth-story-icon">
            <i className="bi bi-flower1" />
          </div>
          <p className="auth-story-kicker">Your farm. Your next step.</p>
          <p className="auth-story-heading">
            Better decisions,
            <br />
            season by season.
          </p>
          <p className="auth-story-description">
            Keep your farm records together and make sense of the choices from
            planting through to market.
          </p>
        </div>
        <div className="auth-landscape">
          <span className="auth-landscape-sun" />
          <span className="auth-landscape-hill auth-landscape-hill--back" />
          <span className="auth-landscape-hill auth-landscape-hill--front" />
          <span className="auth-landscape-row auth-landscape-row--one" />
          <span className="auth-landscape-row auth-landscape-row--two" />
          <span className="auth-landscape-row auth-landscape-row--three" />
        </div>
        <div className="auth-story-footer">
          <span>AGRICULTURE, INFORMED BY YOUR EXPERIENCE</span>
          <i className="bi bi-arrow-up-right" />
        </div>
      </aside>
    </main>
  )
}

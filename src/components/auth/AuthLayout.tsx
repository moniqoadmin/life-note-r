import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './auth.css'
import { FacebookIcon, GoogleIcon, TwitterIcon } from './icons'

interface AuthLayoutProps {
  title: string
  switchText?: ReactNode
  children: ReactNode
  showSocial?: boolean
  socialLabel?: string
  footer?: ReactNode
}

const SOCIAL_PROVIDERS = [
  { name: 'Google', icon: <GoogleIcon /> },
  { name: 'Twitter', icon: <TwitterIcon /> },
  { name: 'Facebook', icon: <FacebookIcon /> },
]

export function AuthLayout({
  title,
  switchText,
  children,
  showSocial = false,
  socialLabel = 'OR',
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo-mark" aria-label="Life Note home">
          LN
        </Link>

        <div className="auth-form-head">
          <h1>{title}</h1>
          {switchText && <p>{switchText}</p>}
        </div>

        {children}

        {showSocial && (
          <>
            <div className="auth-divider">{socialLabel}</div>
            <div className="auth-social-stack">
              {SOCIAL_PROVIDERS.map((provider) => (
                <button key={provider.name} type="button" className="auth-social-btn">
                  {provider.icon}
                  <span>Continue with {provider.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {footer && <div className="auth-card-footer">{footer}</div>}
      </div>
    </div>
  )
}

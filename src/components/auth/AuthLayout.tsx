import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
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
  onGoogleSuccess?: (idToken: string) => void
  onGoogleError?: () => void
  googlePending?: boolean
  googleErrorMessage?: string
}

const OTHER_SOCIAL_PROVIDERS = [
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
  onGoogleSuccess,
  onGoogleError,
  googlePending = false,
  googleErrorMessage,
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
            {googleErrorMessage && (
              <p className="auth-form-error auth-social-error" role="alert">
                {googleErrorMessage}
              </p>
            )}
            <div className="auth-social-stack">
              {onGoogleSuccess ? (
                <div className="auth-social-google" aria-busy={googlePending}>
                  <GoogleLogin
                    onSuccess={(credentialResponse: CredentialResponse) => {
                      if (credentialResponse.credential) {
                        onGoogleSuccess(credentialResponse.credential)
                      } else {
                        onGoogleError?.()
                      }
                    }}
                    onError={() => onGoogleError?.()}
                    text="continue_with"
                    shape="rectangular"
                    theme="outline"
                    width="300"
                  />
                </div>
              ) : (
                <button type="button" className="auth-social-btn" disabled>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>
              )}

              {OTHER_SOCIAL_PROVIDERS.map((provider) => (
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

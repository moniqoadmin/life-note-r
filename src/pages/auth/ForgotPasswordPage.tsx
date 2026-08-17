import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { MailCheckIcon } from '../../components/auth/icons'
import { useForgotPassword } from '../../hooks/useAuth'
import { ForgotPasswordSchema } from '../../schemas/auth'

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [sentTo, setSentTo] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()

    const result = ForgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setError(result.error.issues[0]?.message)
      return
    }

    setError(undefined)
    forgotPassword.mutate(result.data, {
      onSuccess: (response) => setSentTo(response.email),
    })
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your email"
        switchText="We sent password reset instructions to your inbox."
        footer={
          <Link to="/login" className="auth-back-link">
            ← Back to sign in
          </Link>
        }
      >
        <div className="auth-success">
          <span className="auth-success-icon">
            <MailCheckIcon />
          </span>
          <p>
            If an account exists for <strong>{sentTo}</strong>, you&rsquo;ll receive a link to
            reset your password shortly.
          </p>
          <p>
            Didn&rsquo;t get the email?{' '}
            <button
              type="button"
              className="auth-resend"
              onClick={() => forgotPassword.mutate({ email: sentTo })}
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? 'Resending…' : 'Resend it'}
            </button>
          </p>
          <p>
            <Link to={`/reset-password?email=${encodeURIComponent(sentTo)}`} className="auth-link">
              I have a code — reset my password
            </Link>
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      switchText="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="auth-back-link">
          ← Back to sign in
        </Link>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          error={error}
          onChange={(event) => {
            setEmail(event.target.value)
            if (error) setError(undefined)
          }}
        />

        {forgotPassword.isError && (
          <p className="auth-form-error" role="alert">
            Something went wrong. Please try again.
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={forgotPassword.isPending}>
          {forgotPassword.isPending ? (
            <span className="auth-spinner" aria-label="Sending reset link" />
          ) : (
            'Send reset link'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { PasswordField } from '../../components/auth/PasswordField'
import { useLogin } from '../../hooks/useAuth'
import { LoginSchema } from '../../schemas/auth'

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { registered?: boolean; verified?: boolean; resetComplete?: boolean } | null
  const registered = Boolean(state?.registered)
  const verified = Boolean(state?.verified)
  const resetComplete = Boolean(state?.resetComplete)

  const login = useLogin()
  const [values, setValues] = useState({ email: '', password: '' })
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function updateField(field: 'email' | 'password', value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const result = LoginSchema.safeParse({ ...values, remember })
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'email' | 'password'
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    login.mutate(result.data, {
      onSuccess: () => navigate('/'),
      onError: (error) => {
        if (error.code === 'email_not_verified') {
          navigate(`/verify-email?email=${encodeURIComponent(result.data.email)}`)
        }
      },
    })
  }

  return (
    <AuthLayout
      title="Welcome back"
      switchText={
        <>
          Don&rsquo;t have an account? <Link to="/register">Sign up</Link>
        </>
      }
      showSocial
      socialLabel="Or sign in with"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {registered && (
          <p className="auth-form-success" role="status">
            Account created. Sign in to get started.
          </p>
        )}

        {verified && (
          <p className="auth-form-success" role="status">
            Email verified. You can now sign in.
          </p>
        )}

        {resetComplete && (
          <p className="auth-form-success" role="status">
            Password updated. Sign in with your new password.
          </p>
        )}

        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => updateField('email', event.target.value)}
        />

        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
        />

        <div className="auth-row">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>

        {login.isError && login.error.code !== 'email_not_verified' && (
          <p className="auth-form-error" role="alert">
            {login.error.message}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={login.isPending}>
          {login.isPending ? <span className="auth-spinner" aria-label="Signing in" /> : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}

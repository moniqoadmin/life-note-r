import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { PasswordField } from '../../components/auth/PasswordField'
import { useGoogleAuth, useRegister } from '../../hooks/useAuth'
import { RegisterSchema } from '../../schemas/auth'

type Field = 'name' | 'email' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<Field, string>>

const initialValues = { name: '', email: '', password: '', confirmPassword: '' }

export function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()
  const googleAuth = useGoogleAuth()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [googleError, setGoogleError] = useState(false)

  function handleGoogleSuccess(idToken: string) {
    setGoogleError(false)
    googleAuth.mutate(idToken, {
      onSuccess: () => navigate('/dashboard', { replace: true }),
      onError: () => setGoogleError(true),
    })
  }

  function updateField(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const result = RegisterSchema.safeParse(values)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as Field
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    register.mutate(result.data, {
      // OTP email verification temporarily disabled:
      // onSuccess: () =>
      //   navigate(`/verify-email?email=${encodeURIComponent(result.data.email)}`, {
      //     state: { registered: true },
      //   }),
      onSuccess: () => navigate('/login', { state: { registered: true } }),
    })
  }

  return (
    <AuthLayout
      title="Get Started"
      switchText={
        <>
          Already have an account? <Link to="/login">Sign In</Link>
        </>
      }
      showSocial
      socialLabel="Or sign up with"
      onGoogleSuccess={handleGoogleSuccess}
      onGoogleError={() => setGoogleError(true)}
      googlePending={googleAuth.isPending}
      googleErrorMessage={googleError ? 'Google sign-in failed. Please try again.' : undefined}
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Jordan Lee"
          value={values.name}
          error={errors.name}
          onChange={(event) => updateField('name', event.target.value)}
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
        />

        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => updateField('confirmPassword', event.target.value)}
        />

        {register.isError && (
          <p className="auth-form-error" role="alert">
            {register.error.message}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={register.isPending}>
          {register.isPending ? (
            <span className="auth-spinner" aria-label="Creating account" />
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

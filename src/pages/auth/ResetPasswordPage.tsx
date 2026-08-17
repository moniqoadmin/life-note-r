import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { PasswordField } from '../../components/auth/PasswordField'
import { useResetPassword } from '../../hooks/useAuth'
import { ResetPasswordSchema } from '../../schemas/auth'

type Field = 'email' | 'code' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<Field, string>>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resetPassword = useResetPassword()

  const [values, setValues] = useState({
    email: searchParams.get('email') ?? '',
    code: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  function updateField(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const result = ResetPasswordSchema.safeParse(values)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as Field
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    const { confirmPassword: _confirmPassword, ...input } = result.data
    resetPassword.mutate(input, {
      onSuccess: () => navigate('/login', { state: { resetComplete: true } }),
    })
  }

  return (
    <AuthLayout
      title="Reset your password"
      switchText="Enter the code we sent you and choose a new password."
      footer={
        <Link to="/login" className="auth-back-link">
          ← Back to sign in
        </Link>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          error={errors.email}
          onChange={(event) => updateField('email', event.target.value)}
        />

        <FormField
          label="Reset code"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={values.code}
          error={errors.code}
          onChange={(event) => updateField('code', event.target.value.replace(/\D/g, ''))}
        />

        <PasswordField
          label="New password"
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

        {resetPassword.isError && (
          <p className="auth-form-error" role="alert">
            {resetPassword.error.message}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={resetPassword.isPending}>
          {resetPassword.isPending ? (
            <span className="auth-spinner" aria-label="Resetting password" />
          ) : (
            'Reset password'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

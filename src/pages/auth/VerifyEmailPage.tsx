import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { FormField } from '../../components/auth/FormField'
import { useResendOtp, useVerifyOtp } from '../../hooks/useAuth'
import { VerifyOtpSchema } from '../../schemas/auth'

type FieldErrors = Partial<Record<'email' | 'code', string>>

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const verifyOtp = useVerifyOtp()
  const resendOtp = useResendOtp()

  const [values, setValues] = useState({
    email: searchParams.get('email') ?? '',
    code: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [resendMessage, setResendMessage] = useState<string>()

  function updateField(field: 'email' | 'code', value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setResendMessage(undefined)

    const result = VerifyOtpSchema.safeParse(values)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'email' | 'code'
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    verifyOtp.mutate(result.data, {
      onSuccess: () => navigate('/login', { state: { verified: true } }),
    })
  }

  function handleResend() {
    setResendMessage(undefined)
    if (!values.email) {
      setErrors((prev) => ({ ...prev, email: 'Email is required to resend a code' }))
      return
    }
    resendOtp.mutate(
      { email: values.email },
      { onSuccess: (response) => setResendMessage(response.message) },
    )
  }

  return (
    <AuthLayout
      title="Verify your email"
      switchText="Enter the 6-digit code we sent to your email address."
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
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={values.code}
          error={errors.code}
          onChange={(event) => updateField('code', event.target.value.replace(/\D/g, ''))}
        />

        {verifyOtp.isError && (
          <p className="auth-form-error" role="alert">
            {verifyOtp.error.message}
          </p>
        )}

        {resendMessage && (
          <p className="auth-form-success" role="status">
            {resendMessage}
          </p>
        )}

        <button type="submit" className="auth-submit" disabled={verifyOtp.isPending}>
          {verifyOtp.isPending ? <span className="auth-spinner" aria-label="Verifying" /> : 'Verify email'}
        </button>

        <button
          type="button"
          className="auth-resend"
          onClick={handleResend}
          disabled={resendOtp.isPending}
        >
          {resendOtp.isPending ? 'Sending…' : 'Resend code'}
        </button>
      </form>
    </AuthLayout>
  )
}

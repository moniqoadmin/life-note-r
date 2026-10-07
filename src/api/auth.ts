import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from '../schemas/auth'

export interface AuthUser {
  id: string
  name: string | null
  email: string
}

export interface MessageResponse {
  message: string
}

export interface PasswordResetResponse {
  email: string
}

export class AuthApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}
import { BASE_URL } from './baseUrl'


async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new AuthApiError(data?.error ?? 'Something went wrong. Please try again.')
  }

  return data as T
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/csrf`, { credentials: 'include' })
  const data = await response.json()
  return data.csrfToken as string
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const csrfToken = await getCsrfToken()

  const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    credentials: 'include',
    body: new URLSearchParams({
      email: input.email,
      password: input.password,
      csrfToken,
      callbackUrl: '/',
      json: 'true',
    }),
  })

  const data = await response.json().catch(() => null)
  const redirectUrl = data?.url as string | undefined
  const error = redirectUrl ? new URL(redirectUrl, window.location.origin).searchParams.get('error') : null
  const code = redirectUrl ? new URL(redirectUrl, window.location.origin).searchParams.get('code') : null

  if (!response.ok || error) {
    if (code === 'email_not_verified') {
      throw new AuthApiError('Please verify your email before signing in.', 'email_not_verified')
    }
    throw new AuthApiError('Invalid email or password.', code ?? error ?? undefined)
  }

  const session = await getSession()
  if (!session) {
    throw new AuthApiError('Signed in, but no session was returned.')
  }
  return session
}

export async function googleLogin(idToken: string): Promise<AuthUser> {
  const csrfToken = await getCsrfToken()

  const response = await fetch(`${BASE_URL}/api/auth/callback/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    credentials: 'include',
    body: new URLSearchParams({ idToken, csrfToken, callbackUrl: '/', json: 'true' }),
  })

  const data = await response.json().catch(() => null)
  const redirectUrl = data?.url as string | undefined
  const error = redirectUrl ? new URL(redirectUrl, window.location.origin).searchParams.get('error') : null

  if (!response.ok || error) {
    throw new AuthApiError('Google sign-in failed. Please try again.', error ?? undefined)
  }

  const session = await getSession()
  if (!session) {
    throw new AuthApiError('Signed in, but no session was returned.')
  }
  return session
}

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken()
  await fetch(`${BASE_URL}/api/auth/signout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'include',
    body: new URLSearchParams({ csrfToken }),
  })
}

export async function getSession(): Promise<AuthUser | null> {
  const response = await fetch(`${BASE_URL}/api/auth/session`, { credentials: 'include' })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  return data?.user ?? null
}

export async function register(input: RegisterInput): Promise<MessageResponse> {
  return postJson('/api/auth/register', {
    name: input.name,
    email: input.email,
    password: input.password,
  })
}

export async function verifyOtp(input: VerifyOtpInput): Promise<MessageResponse> {
  return postJson('/api/auth/verify-otp', input)
}

export async function resendOtp(input: ResendOtpInput): Promise<MessageResponse> {
  return postJson('/api/auth/resend-otp', input)
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<PasswordResetResponse> {
  await postJson<MessageResponse>('/api/auth/forgot-password', input)
  return { email: input.email }
}

export async function resetPassword(input: ResetPasswordInput): Promise<MessageResponse> {
  return postJson('/api/auth/reset-password', input)
}

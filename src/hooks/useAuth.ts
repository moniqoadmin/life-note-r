import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AuthApiError,
  getSession,
  googleLogin,
  login,
  logout,
  register,
  requestPasswordReset,
  resendOtp,
  resetPassword,
  verifyOtp,
} from '../api/auth'

export const sessionKey = ['session'] as const

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: getSession,
    staleTime: 1000 * 30,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof login>>, AuthApiError, Parameters<typeof login>[0]>({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(sessionKey, user)
    },
  })
}

export function useGoogleAuth() {
  const queryClient = useQueryClient()
  return useMutation<Awaited<ReturnType<typeof googleLogin>>, AuthApiError, string>({
    mutationFn: googleLogin,
    onSuccess: (user) => {
      queryClient.setQueryData(sessionKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(sessionKey, null)
    },
  })
}

export function useRegister() {
  return useMutation<Awaited<ReturnType<typeof register>>, AuthApiError, Parameters<typeof register>[0]>({
    mutationFn: register,
  })
}

export function useVerifyOtp() {
  return useMutation<Awaited<ReturnType<typeof verifyOtp>>, AuthApiError, Parameters<typeof verifyOtp>[0]>({
    mutationFn: verifyOtp,
  })
}

export function useResendOtp() {
  return useMutation<Awaited<ReturnType<typeof resendOtp>>, AuthApiError, Parameters<typeof resendOtp>[0]>({
    mutationFn: resendOtp,
  })
}

export function useForgotPassword() {
  return useMutation<
    Awaited<ReturnType<typeof requestPasswordReset>>,
    AuthApiError,
    Parameters<typeof requestPasswordReset>[0]
  >({
    mutationFn: requestPasswordReset,
  })
}

export function useResetPassword() {
  return useMutation<
    Awaited<ReturnType<typeof resetPassword>>,
    AuthApiError,
    Parameters<typeof resetPassword>[0]
  >({
    mutationFn: resetPassword,
  })
}

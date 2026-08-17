import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

export type LoginInput = z.infer<typeof LoginSchema>

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number')

export const RegisterSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterInput = z.infer<typeof RegisterSchema>

export const ForgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>

export const VerifyOtpSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  code: z.string().length(6, 'Enter the 6-digit code'),
})

export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>

export const ResendOtpSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

export type ResendOtpInput = z.infer<typeof ResendOtpSchema>

export const ResetPasswordSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    code: z.string().length(6, 'Enter the 6-digit code'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type ResetPasswordFormInput = z.infer<typeof ResetPasswordSchema>
export type ResetPasswordInput = Omit<ResetPasswordFormInput, 'confirmPassword'>

import { useState, type InputHTMLAttributes } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'
import { FormField } from './FormField'

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
}

export function PasswordField({ label, error, id, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <FormField
      label={label}
      error={error}
      id={id}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          className="auth-toggle-visibility"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
      {...props}
    />
  )
}

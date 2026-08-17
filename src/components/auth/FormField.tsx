import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  endAdornment?: ReactNode
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, endAdornment, id, className, ...props }, ref) => {
    const generatedId = useId()
    const fieldId = id ?? generatedId
    const errorId = `${fieldId}-error`

    return (
      <div className="auth-field">
        <label htmlFor={fieldId}>{label}</label>
        <div className="auth-input-wrap">
          <input
            ref={ref}
            id={fieldId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={['auth-input', error ? 'has-error' : '', className].filter(Boolean).join(' ')}
            {...props}
          />
          {endAdornment}
        </div>
        {error && (
          <p id={errorId} className="auth-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

FormField.displayName = 'FormField'

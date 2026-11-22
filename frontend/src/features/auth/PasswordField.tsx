import { useState } from 'react'

type PasswordFieldProps = {
  autoComplete: 'current-password' | 'new-password'
  id: string
  label: string
  name: string
  onChange: (value: string) => void
  value: string
  error?: string
}

export function PasswordField({
  autoComplete,
  id,
  label,
  name,
  onChange,
  value,
  error,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-field">
      <label className="form-label auth-label" htmlFor={id}>
        {label}
      </label>
      <div className="auth-input-wrap">
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={`form-control auth-input${error ? ' is-invalid' : ''}`}
          id={id}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <i
            aria-hidden="true"
            className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`}
          />
        </button>
      </div>
      {error && (
        <div className="auth-field-error" id={`${id}-error`}>
          {error}
        </div>
      )}
    </div>
  )
}

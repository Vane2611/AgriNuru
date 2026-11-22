import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthPageLayout } from './AuthPageLayout'
import { PasswordField } from './PasswordField'
import { useAuth } from '../../app/providers/AuthProvider'
import { ApiError } from '../../services/resources/authApi'
import './auth-pages.css'

type RegistrationValues = {
  fullName: string
  username: string
  email: string
  phoneNumber: string
  password: string
  confirmPassword: string
}

const initialValues: RegistrationValues = {
  fullName: '',
  username: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
}

export function RegisterPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submissionError, setSubmissionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!successMessage) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 1600)
    return () => window.clearTimeout(timeoutId)
  }, [navigate, successMessage])

  function updateValue(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      if (field === 'password') {
        delete next.confirmPassword
      }
      return next
    })
    setSubmissionError('')
    setSuccessMessage('')
  }

  function mapFieldErrors(error: ApiError) {
    const fieldMap: Record<string, keyof RegistrationValues | 'general'> = {
      full_name: 'fullName',
      username: 'username',
      email: 'email',
      phone_number: 'phoneNumber',
      password: 'password',
      confirm_password: 'confirmPassword',
      non_field_errors: 'general',
    }
    const nextErrors: Record<string, string> = {}

    for (const [field, messages] of Object.entries(error.fields)) {
      const target = fieldMap[field]
      if (target && target !== 'general' && messages[0]) {
        nextErrors[target] = messages[0]
      }
    }

    if (!Object.keys(nextErrors).length && error.detail) {
      setSubmissionError(error.detail)
    } else if (error.fields.non_field_errors?.[0]) {
      setSubmissionError(error.fields.non_field_errors[0])
    } else if (!Object.keys(nextErrors).length) {
      setSubmissionError(
        error.status === 0
          ? 'Unable to connect to AgriNuru. Check your connection and try again.'
          : 'Registration could not be completed. Please review your information.',
      )
    }

    setErrors(nextErrors)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setSubmissionError('')
    setSuccessMessage('')
    const nextErrors: Record<string, string> = {}
    const requiredFields: Array<[keyof RegistrationValues, string]> = [
      ['fullName', 'Enter your full name.'],
      ['username', 'Choose a username.'],
      ['email', 'Enter your email address.'],
      ['phoneNumber', 'Enter your phone number.'],
      ['password', 'Create a password.'],
      ['confirmPassword', 'Confirm your password.'],
    ]

    for (const [field, message] of requiredFields) {
      if (!values[field].trim()) {
        nextErrors[field] = message
      }
    }
    if (
      values.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
    ) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (
      values.password &&
      values.confirmPassword &&
      values.password !== values.confirmPassword
    ) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await register({
        full_name: values.fullName.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        phone_number: values.phoneNumber.trim(),
        password: values.password,
        confirm_password: values.confirmPassword,
      })
      setSuccessMessage(
        'Account created successfully. You can now sign in to AgriNuru.',
      )
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 0) {
          setSubmissionError(
            'Unable to connect to AgriNuru. Check your connection and try again.',
          )
        } else if (Object.keys(error.fields).length > 0) {
          mapFieldErrors(error)
        } else if (error.detail) {
          setSubmissionError(error.detail)
        } else {
          setSubmissionError(
            'Registration could not be completed. Please try again.',
          )
        }
      } else {
        setSubmissionError(
          'Unable to connect to AgriNuru. Check your connection and try again.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function renderTextField(
    field: 'fullName' | 'username' | 'email' | 'phoneNumber',
    label: string,
    type: 'text' | 'email' | 'tel',
    autoComplete: string,
  ) {
    const inputId = `register-${field}`
    const errorId = `${inputId}-error`
    return (
      <div className="auth-field">
        <label className="form-label auth-label" htmlFor={inputId}>
          {label}
        </label>
        <input
          aria-describedby={errors[field] ? errorId : undefined}
          aria-invalid={Boolean(errors[field])}
          autoComplete={autoComplete}
          className={`form-control auth-input${errors[field] ? ' is-invalid' : ''}`}
          id={inputId}
          name={field}
          onChange={(event) => updateValue(field, event.target.value)}
          required
          type={type}
          value={values[field]}
        />
        {errors[field] && (
          <div className="auth-field-error" id={errorId}>
            {errors[field]}
          </div>
        )}
      </div>
    )
  }

  return (
    <AuthPageLayout page="register">
      <h1 className="auth-heading">Create your AgriNuru account</h1>
      <p className="auth-intro">
        Bring your farm records together and make more informed decisions about
        production and markets.
      </p>

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="auth-form-grid">
          {renderTextField('fullName', 'Full name', 'text', 'name')}
          {renderTextField('username', 'Username', 'text', 'username')}
          {renderTextField('email', 'Email address', 'email', 'email')}
          {renderTextField('phoneNumber', 'Phone number', 'tel', 'tel')}
        </div>

        <div className="auth-form-grid">
          <PasswordField
            autoComplete="new-password"
            error={errors.password}
            id="register-password"
            label="Password"
            name="password"
            onChange={(value) => updateValue('password', value)}
            value={values.password}
          />
          <PasswordField
            autoComplete="new-password"
            error={errors.confirmPassword}
            id="register-confirm-password"
            label="Confirm password"
            name="confirmPassword"
            onChange={(value) => updateValue('confirmPassword', value)}
            value={values.confirmPassword}
          />
        </div>

        <button
          className="btn auth-submit"
          disabled={isSubmitting || Boolean(successMessage)}
          type="submit"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </button>
        {submissionError && (
          <p className="auth-form-status" role="alert">
            {submissionError}
          </p>
        )}
        {successMessage && (
          <p className="auth-form-status" role="status">
            {successMessage}
          </p>
        )}
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <Link className="auth-link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  )
}

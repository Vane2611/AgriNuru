import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthPageLayout } from './AuthPageLayout'
import { PasswordField } from './PasswordField'
import { useAuth } from '../../app/providers/AuthProvider'
import { ApiError } from '../../services/resources/authApi'
import './auth-pages.css'

export function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submissionError, setSubmissionError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setSubmissionError('')
    const nextErrors: Record<string, string> = {}
    if (!usernameOrEmail.trim()) {
      nextErrors.usernameOrEmail = 'Enter your username or email address.'
    }
    if (!password) {
      nextErrors.password = 'Enter your password.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await login(usernameOrEmail.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setSubmissionError(
            'Invalid username/email or password. Please try again.',
          )
        } else if (error.status === 0) {
          setSubmissionError(
            'Unable to connect to Grinab. Check your connection and try again.',
          )
        } else {
          setSubmissionError(
            'Sign-in could not be completed. Please try again.',
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

  return (
    <AuthPageLayout page="login">
      <h1 className="auth-heading">Welcome back</h1>
      <p className="auth-intro">
        Sign in to manage your farm and make informed agricultural decisions.
      </p>

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="form-label auth-label" htmlFor="login-identity">
            Username or email
          </label>
          <input
            aria-describedby={
              errors.usernameOrEmail ? 'login-identity-error' : undefined
            }
            aria-invalid={Boolean(errors.usernameOrEmail)}
            autoComplete="username"
            className={`form-control auth-input${errors.usernameOrEmail ? ' is-invalid' : ''}`}
            id="login-identity"
            name="usernameOrEmail"
            onChange={(event) => {
              setUsernameOrEmail(event.target.value)
              setErrors((current) => {
                const next = { ...current }
                delete next.usernameOrEmail
                return next
              })
              setSubmissionError('')
            }}
            required
            type="text"
            value={usernameOrEmail}
          />
          {errors.usernameOrEmail && (
            <div className="auth-field-error" id="login-identity-error">
              {errors.usernameOrEmail}
            </div>
          )}
        </div>

        <PasswordField
          autoComplete="current-password"
          error={errors.password}
          id="login-password"
          label="Password"
          name="password"
          onChange={(value) => {
            setPassword(value)
            setErrors((current) => {
              const next = { ...current }
              delete next.password
              return next
            })
            setSubmissionError('')
          }}
          value={password}
        />

        <div className="auth-form-options">
          <label className="form-check auth-checkbox">
            <input
              checked={rememberMe}
              className="form-check-input"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <span>Remember me</span>
          </label>
          <a
            className="auth-link"
            href="#forgot-password"
            onClick={(event) => event.preventDefault()}
          >
            Forgot password?
          </a>
        </div>

        <button
          className="btn auth-submit"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
        {submissionError && (
          <p className="auth-form-status" role="alert">
            {submissionError}
          </p>
        )}
      </form>

      <p className="auth-switch">
        New to Grinab?{' '}
        <Link className="auth-link" to="/register">
          Create an account
        </Link>
      </p>
    </AuthPageLayout>
  )
}
